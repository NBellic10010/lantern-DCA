import { suiService } from './sui';
import dotenv from 'dotenv';
import { connectDB } from './db';
import { Plan, Trade } from './models/Plan';
import { getCoinDecimals, buildSimpleSwapTransaction } from './cetus';

dotenv.config();

const POLLING_INTERVAL_MS = 10 * 1000; // 10 seconds fallback
const EXECUTION_INTERVAL_MS = 5 * 1000; // Check strategy conditions every 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// 辅助函数：格式化金额 (考虑精度)
async function formatAmount(amount: number, coinType: string): Promise<number> {
    const decimals = await getCoinDecimals(coinType);
    return amount / Math.pow(10, decimals);
}

interface ProcessingStatus {
    planId: string;
    retries: number;
    lastDigest?: string;
}

export async function runKeeperLoop() {
    console.log("🚀 Starting Keeper Bot...");
    await connectDB();

    // Track processing status for retry logic
    const processingStatus = new Map<string, ProcessingStatus>();

    // --- Helper: 保存交易记录到数据库 ---
    const saveTradeToDb = async (
        planId: string,
        owner: string,
        stepIndex: number,
        inputAmount: number,
        outputAmount: number,
        inputCoin: string,
        outputCoin: string,
        txDigest: string,
        priceAtExecution: number
    ) => {
        try {
            // 检查是否已存在
            const existing = await Trade.findOne({ tradeId: txDigest });
            if (existing) return;

            await Trade.create({
                tradeId: txDigest,
                planId,
                owner,
                stepIndex,
                inputAmount,
                outputAmount,
                inputCoin,
                outputCoin,
                txDigest,
                priceAtExecution
            });
            console.log(`💾 Trade saved to DB: ${txDigest}`);
        } catch (e) {
            console.error(`❌ Failed to save trade for plan ${planId}:`, e);
        }
    };

    // --- Helper: 执行单个 Plan ---
    const executePlan = async (planId: string): Promise<boolean> => {
        console.log(`[Keeper] Executing plan: ${planId}`);

        try {
            const plan = await suiService.getPlanState(planId);
            if (!plan) {
                console.warn(`[Keeper] Plan ${planId} not found on chain`);
                processingStatus.delete(planId);
                return true; // Remove from queue
            }

            // 检查 Plan 是否已完成
            if (!plan.active || plan.current_step_index >= plan.steps.length) {
                console.log(`[Keeper] Plan ${planId} completed`);
                await Plan.updateOne({ planId }, { status: 'completed' });
                processingStatus.delete(planId);
                return true;
            }

            // 检查触发条件
            const shouldExecute = await suiService.checkTrigger(plan);
            if (!shouldExecute) {
                console.log(`[Keeper] Plan ${planId} trigger not met, skipping`);
                return false;
            }

            // 获取当前步骤信息
            const currentStep = plan.steps[plan.current_step_index];
            const amountToSwap = currentStep?.input_amount || plan.totalAmount;
            console.log(`[Keeper] Step ${plan.current_step_index}: amount=${amountToSwap}`);

            // 1. 推进步骤 (链上)
            console.log(`[Keeper] Building PTB for ${planId}...`);
            const txb = await suiService.buildExecuteDcaTransaction(plan);

            // 检查是否需要真实执行
            if (!process.env.KEEPER_PRIVATE_KEY) {
                console.log(`⚠️ KEEPER_PRIVATE_KEY not set, skipping execution`);
                return false;
            }

            // 执行链上交易
            const result = await suiService.signAndExecute(txb);

            if (!result.success) {
                console.error(`[Keeper] On-chain execution failed for ${planId}:`, result.error);

                // 更新重试计数
                const status = processingStatus.get(planId) || { planId, retries: 0 };
                status.retries++;
                processingStatus.set(planId, status);

                if (status.retries >= MAX_RETRIES) {
                    console.error(`[Keeper] Max retries reached for ${planId}, marking as failed`);
                    await Plan.updateOne({ planId }, { status: 'failed' });
                    processingStatus.delete(planId);
                    return true;
                }

                return false;
            }

            console.log(`[Keeper] On-chain transaction executed: ${result.digest}`);

            // 等待交易确认
            const confirmed = await suiService.waitForTransaction(result.digest);
            if (!confirmed) {
                console.warn(`[Keeper] Transaction ${result.digest} not confirmed, will retry`);
                return false;
            }

            // 2. 执行 Swap (使用 Cetus SDK)
            console.log(`[Keeper] Executing swap via Cetus SDK...`);
            let inputAmountFormatted = 0;
            let outputAmountFormatted = 0;

            try {
                const decimals = await getCoinDecimals(plan.inputType);
                const amountInLamports = Math.floor(amountToSwap * Math.pow(10, decimals));

                // 构建并执行 swap 交易
                const swapTx = await buildSimpleSwapTransaction(
                    plan.inputType,
                    plan.outputType,
                    amountInLamports.toString(),
                    100 // 1% slippage
                );

                // 执行 swap 交易
                const sdkResult = await suiService.signAndExecute(swapTx);

                if (sdkResult.success && sdkResult.digest) {
                    console.log(`[Keeper] Swap executed: ${sdkResult.digest}`);
                    inputAmountFormatted = await formatAmount(amountToSwap, plan.inputType);
                    // 简化：假设 output 是 input 的 95%（考虑滑点）
                    outputAmountFormatted = inputAmountFormatted * 0.95;
                } else {
                    console.warn(`[Keeper] Swap SDK execution failed:`, sdkResult.error);
                    inputAmountFormatted = await formatAmount(amountToSwap, plan.inputType);
                    outputAmountFormatted = 0;
                }
            } catch (swapErr) {
                console.error(`[Keeper] Swap error:`, swapErr);
                inputAmountFormatted = await formatAmount(amountToSwap, plan.inputType);
                outputAmountFormatted = 0;
            }

            // 3. 保存交易记录到数据库
            await saveTradeToDb(
                planId,
                plan.owner,
                plan.current_step_index,
                inputAmountFormatted,
                outputAmountFormatted,
                plan.inputType,
                plan.outputType,
                result.digest,
                0
            );

            // 更新计划状态
            await Plan.updateOne(
                { planId },
                {
                    $inc: { 'stats.totalTrades': 1 },
                    lastExecutedAt: new Date()
                }
            );

            // 检查是否完成
            const updatedPlan = await suiService.getPlanState(planId);
            if (updatedPlan && (!updatedPlan.active || updatedPlan.current_step_index >= updatedPlan.steps.length)) {
                console.log(`[Keeper] Plan ${planId} fully completed`);
                await Plan.updateOne({ planId }, { status: 'completed' });
                processingStatus.delete(planId);
            }

            return true;

        } catch (err) {
            console.error(`[Keeper] Error processing plan ${planId}:`, err);

            const status = processingStatus.get(planId) || { planId, retries: 0 };
            status.retries++;
            processingStatus.set(planId, status);

            if (status.retries >= MAX_RETRIES) {
                console.error(`[Keeper] Max retries reached for ${planId}, marking as failed`);
                await Plan.updateOne({ planId }, { status: 'failed' });
                processingStatus.delete(planId);
                return true;
            }

            return false;
        }
    };

    // --- Listener A: Real-time Subscription (Primary) ---
    try {
        console.log("📡 Subscribing to on-chain events...");
        await suiService.subscribeToEvents();
        console.log("✅ Event subscriptions active");
    } catch (e) {
        console.error("❌ Failed to start Event Subscription:", e);
        console.log("⚠️ Falling back to polling only...");
    }

    // --- Listener B: Polling Fallback (Backup) ---
    setInterval(async () => {
        try {
            console.log(`🔄 Polling for missed plans...`);
            await suiService.scanForNewPlans();
        } catch (e) {
            console.error("Polling Error (Plans):", e);
        }
    }, POLLING_INTERVAL_MS);

    // --- Listener C: Execution Confirmation Polling ---
    setInterval(async () => {
        try {
            await suiService.scanForExecutedSteps();
        } catch (e) {
            console.error("Polling Error (Steps):", e);
        }
    }, POLLING_INTERVAL_MS * 2);

    // --- Executor Loop (Main Logic) ---
    setInterval(async () => {
        const queueLength = suiService.pendingQueue.length;
        if (queueLength === 0) return;

        console.log(`⚡ Processing ${queueLength} plans from queue...`);

        // Process queue with concurrency control (max 5 at a time)
        const batchSize = Math.min(queueLength, 5);
        const batch = suiService.pendingQueue.splice(0, batchSize);

        const results = await Promise.all(
            batch.map(planId => executePlan(planId))
        );

        // Re-queue failed plans
        for (let i = 0; i < batch.length; i++) {
            if (!results[i]) {
                const planId = batch[i];
                const status = processingStatus.get(planId);
                if (status && status.retries < MAX_RETRIES) {
                    // Re-queue with delay
                    setTimeout(() => {
                        if (!suiService.pendingQueue.includes(planId)) {
                            suiService.pendingQueue.push(planId);
                        }
                    }, RETRY_DELAY_MS);
                }
            }
        }

    }, EXECUTION_INTERVAL_MS);

    console.log("✅ Keeper loop initialized successfully");
}
