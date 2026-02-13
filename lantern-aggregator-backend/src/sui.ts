import { SuiClient, getFullnodeUrl, SuiEvent, SuiEventFilter as RpcSuiEventFilter, TransactionEffects } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getCetusPrice, getSdk, getPool } from './cetus';
import { Transaction } from '@mysten/sui/transactions';
import { getCoinDecimals } from './cetus';
import { connectDB, getCursorModel, ICursor } from './db';
import { Plan, Trade, IPlan, ITrade } from './models/Plan';

// 从环境变量读取配置
const PACKAGE_ID: string = process.env.PACKAGE_ID || "";
if (!PACKAGE_ID) {
    throw new Error("PACKAGE_ID is not set in .env");
}
const DCA_MODULE = "dca_plan";
const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";
const CURSOR_KEY_PLAN_EVENTS = "plan_events_cursor";
const CURSOR_KEY_STEP_EVENTS = "step_events_cursor";

// Cetus Protocol Global Config ID (从环境变量获取，或尝试动态查询)
let CETUS_CONFIG_ID: string = process.env.CETUS_CONFIG_ID || "";

async function getCetusConfigId(): Promise<string> {
    if (CETUS_CONFIG_ID) return CETUS_CONFIG_ID;

    if (process.env.CETUS_CONFIG_ID) {
        CETUS_CONFIG_ID = process.env.CETUS_CONFIG_ID;
        return CETUS_CONFIG_ID;
    }

    try {
        const sdk = getSdk();
        const commonPairs = [
            ["0x2::sui::SUI", "0x5f759...::usdc::USDC"],
            ["0x2::sui::SUI", "0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS"],
        ];

        for (const pair of commonPairs) {
            try {
                const pools = await sdk.Pool.getPoolByCoins(pair);
                if (pools && pools.length > 0) {
                    const poolAny = pools[0] as any;
                    // Cetus SDK pool object 通常有 config_id
                    if (poolAny.config_id) {
                        CETUS_CONFIG_ID = poolAny.config_id;
                        console.log(`[SuiService] Auto-detected Cetus Config ID: ${CETUS_CONFIG_ID}`);
                        return CETUS_CONFIG_ID;
                    }
                    // 也可能嵌套在更深层
                    if (poolAny.clmm_config?.global_config_id) {
                        CETUS_CONFIG_ID = poolAny.clmm_config.global_config_id;
                        console.log(`[SuiService] Auto-detected Cetus Config ID from clmm_config: ${CETUS_CONFIG_ID}`);
                        return CETUS_CONFIG_ID;
                    }
                }
            } catch (e) { /* continue */ }
        }
    } catch (e) {
        console.warn("[SuiService] Could not auto-detect Cetus Config ID:", e);
    }

    throw new Error("CETUS_CONFIG_ID is not set in .env and auto-detection failed");
}

interface DCAPlanState {
    id: string;
    owner: string;
    current_step_index: number;
    active: boolean;
    steps: any[];
    inputType: string;
    outputType: string;
    totalAmount: number;
    remainingAmount: number;
}

interface ExecutionResult {
    digest: string;
    success: boolean;
    events?: SuiEvent[];
    error?: string;
}

interface SuiService {
    pendingQueue: string[];
    getPlanState(planId: string): Promise<DCAPlanState | null>;
    subscribeToEvents(): Promise<void>;
    scanForNewPlans(): Promise<void>;
    scanForExecutedSteps(): Promise<void>;
    checkTrigger(plan: DCAPlanState): Promise<boolean>;
    buildExecuteDcaTransaction(plan: DCAPlanState): Promise<Transaction>;
    signAndExecute(txb: Transaction): Promise<ExecutionResult>;
    waitForTransaction(digest: string, timeout?: number): Promise<boolean>;
}

class SuiServiceImpl implements SuiService {
    public pendingQueue: string[] = [];
    private client: SuiClient;
    private keeperKeypair: Ed25519Keypair | null = null;
    private unsubscribePlanEvents: (() => Promise<void>) | null = null;
    private unsubscribeStepEvents: (() => Promise<void>) | null = null;

    constructor() {
        this.client = new SuiClient({ url: getFullnodeUrl('testnet') });

        if (process.env.KEEPER_PRIVATE_KEY) {
            this.keeperKeypair = Ed25519Keypair.fromSecretKey(process.env.KEEPER_PRIVATE_KEY);
            console.log("[SuiService] Keeper Keypair initialized.");
        }
    }

    // ==================== Event Subscription ====================

    /**
     * Start real-time event subscriptions for new plans and executed steps
     */
    async subscribeToEvents(): Promise<void> {
        console.log("[SuiService] Starting event subscriptions...");
        await connectDB();

        // Subscribe to PlanCreated events
        const planEventType: RpcSuiEventFilter = {
            MoveEventType: `${PACKAGE_ID}::${DCA_MODULE}::PlanCreated`
        };
        const unsubPlan = await this.client.subscribeEvent({
            filter: planEventType,
            onMessage: async (event: SuiEvent) => {
                console.log(`[Subscription] New PlanCreated event received: ${event.id}`);
                await this.handleNewPlanEvent(event);
            }
        });
        this.unsubscribePlanEvents = async () => { await unsubPlan(); };
        console.log("[SuiService] Subscribed to PlanCreated events.");

        // Subscribe to StepExecuted events (for execution confirmation)
        const stepEventType: RpcSuiEventFilter = {
            MoveEventType: `${PACKAGE_ID}::${DCA_MODULE}::StepExecuted`
        };
        const unsubStep = await this.client.subscribeEvent({
            filter: stepEventType,
            onMessage: async (event: SuiEvent) => {
                console.log(`[Subscription] StepExecuted event received: ${event.id}`);
                await this.handleStepExecutedEvent(event);
            }
        });
        this.unsubscribeStepEvents = async () => { await unsubStep(); };
        console.log("[SuiService] Subscribed to StepExecuted events.");
    }

    /**
     * Unsubscribe from all events
     */
    async unsubscribeFromEvents(): Promise<void> {
        if (this.unsubscribePlanEvents) {
            await this.unsubscribePlanEvents();
            this.unsubscribePlanEvents = null;
        }
        if (this.unsubscribeStepEvents) {
            await this.unsubscribeStepEvents();
            this.unsubscribeStepEvents = null;
        }
        console.log("[SuiService] Unsubscribed from all events.");
    }

    /**
     * Handle new PlanCreated event from subscription
     * 1. Check if plan exists in DB
     * 2. Fetch plan details from chain
     * 3. Save to database
     * 4. Add to pending queue for execution
     */
    private async handleNewPlanEvent(event: SuiEvent): Promise<void> {
        const parsed = event.parsedJson as any;
        if (!parsed?.plan_id) return;

        const planId = parsed.plan_id;
        console.log(`[SuiService] New PlanCreated event received: ${planId}`);

        try {
            // 1. Check if plan already exists in DB
            const existing = await Plan.findOne({ planId });
            if (existing) {
                console.log(`[SuiService] Plan ${planId} already exists in DB`);
                // Still add to queue in case it was missed
                if (!this.pendingQueue.includes(planId)) {
                    this.pendingQueue.push(planId);
                }
                return;
            }

            // 2. Fetch plan details from chain
            const planState = await this.getPlanState(planId);
            if (!planState) {
                console.warn(`[SuiService] Plan ${planId} not found on chain`);
                return;
            }

            // 3. Parse steps
            const parsedSteps = this.parseSteps(planState.steps);

            // 4. Calculate amounts with proper decimals
            const inputDecimals = await getCoinDecimals(planState.inputType);
            const totalAmount = planState.totalAmount / Math.pow(10, inputDecimals);
            const remainingAmount = planState.remainingAmount / Math.pow(10, inputDecimals);

            // 5. Save to database
            await Plan.create({
                planId: planState.id,
                owner: planState.owner,
                inputType: planState.inputType,
                outputType: planState.outputType,
                inputAmount: totalAmount,
                remainingAmount: remainingAmount,
                currentStepIndex: planState.current_step_index,
                steps: parsedSteps,
                status: 'active'
            });
            console.log(`[SuiService] Plan ${planId} saved to DB`);

        } catch (e) {
            console.error(`[SuiService] Failed to save plan ${planId}:`, e);
        }

        // 6. Add to pending queue for execution
        if (!this.pendingQueue.includes(planId)) {
            this.pendingQueue.push(planId);
            console.log(`[SuiService] Added ${planId} to pending queue (total: ${this.pendingQueue.length})`);
        }
    }

    /**
     * Parse steps from chain data
     */
    private parseSteps(steps: any[]): any[] {
        if (!steps || !Array.isArray(steps)) return [];

        return steps.map((step, index) => ({
            index,
            triggerType: step.trigger?.tag || 0,
            triggerVal: step.trigger_val || 0,
            inputAmount: step.input_amount || 0,
            slippageTolerance: step.slippage_tolerance || 0
        }));
    }

    /**
     * Handle StepExecuted event from subscription (execution confirmation)
     */
    private async handleStepExecutedEvent(event: SuiEvent): Promise<void> {
        const parsed = event.parsedJson as any;
        if (!parsed?.plan_id) return;

        const { plan_id, step_index, amount_in, amount_out } = parsed;
        console.log(`[SuiService] Plan ${plan_id} step ${step_index} executed. In: ${amount_in}, Out: ${amount_out}`);

        // Update local pending queue - remove completed plan
        const queueIndex = this.pendingQueue.indexOf(plan_id);
        if (queueIndex > -1) {
            // For multi-step plans, keep in queue for next step
            // For single-step plans, remove
            const plan = await this.getPlanState(plan_id);
            if (plan && plan.current_step_index >= plan.steps.length - 1) {
                this.pendingQueue.splice(queueIndex, 1);
                console.log(`[SuiService] Plan ${plan_id} completed, removed from queue.`);
            }
        }
    }

    // ==================== Polling Fallback ====================

    /**
     * Poll for new plans using cursor-based approach
     */
    async scanForNewPlans(): Promise<void> {
        try {
            let cursor: string | undefined = await this.getCursor(CURSOR_KEY_PLAN_EVENTS);

            const events = await this.client.queryEvents({
                query: {
                    MoveEventType: `${PACKAGE_ID}::${DCA_MODULE}::PlanCreated`
                } as RpcSuiEventFilter,
                cursor: cursor ? { txDigest: cursor, eventSeq: "0" as any } : undefined,
                limit: 50,
                order: 'descending'
            });

            if (events.data.length === 0) return;

            // Process events in reverse order (oldest first) to maintain order
            const eventsToProcess = events.data.reverse();

            for (const event of eventsToProcess) {
                const parsed = event.parsedJson as any;
                if (parsed?.plan_id && !this.pendingQueue.includes(parsed.plan_id)) {
                    console.log(`[Polling] Found new plan: ${parsed.plan_id}`);
                    this.pendingQueue.push(parsed.plan_id);
                }
            }

            // Update cursor to the newest event
            if (events.data.length > 0) {
                const newestEvent = events.data[0];
                if (newestEvent?.id) {
                    await this.saveCursor(CURSOR_KEY_PLAN_EVENTS, newestEvent.id.txDigest);
                }
            }

        } catch (e) {
            console.error("[SuiService] Polling Error (Plans):", e);
        }
    }

    /**
     * Poll for executed steps (backup for subscription confirmation)
     */
    async scanForExecutedSteps(): Promise<void> {
        try {
            let cursor: string | undefined = await this.getCursor(CURSOR_KEY_STEP_EVENTS);

            const events = await this.client.queryEvents({
                query: {
                    MoveEventType: `${PACKAGE_ID}::${DCA_MODULE}::StepExecuted`
                } as RpcSuiEventFilter,
                cursor: cursor ? { txDigest: cursor, eventSeq: "0" as any } : undefined,
                limit: 50,
                order: 'descending'
            });

            if (events.data.length === 0) return;

            // Process events
            for (const event of events.data) {
                await this.handleStepExecutedEvent(event);
            }

            // Update cursor
            if (events.data.length > 0) {
                const newestEvent = events.data[0];
                if (newestEvent?.id) {
                    await this.saveCursor(CURSOR_KEY_STEP_EVENTS, newestEvent.id.txDigest);
                }
            }

        } catch (e) {
            console.error("[SuiService] Polling Error (Steps):", e);
        }
    }

    // ==================== Cursor Management ====================

    private async getCursor(key: string): Promise<string | undefined> {
        try {
            const CursorModel = getCursorModel();
            const cursor = await CursorModel.findOne({ key });
            return cursor?.value;
        } catch (e) {
            return undefined;
        }
    }

    private async saveCursor(key: string, value: string): Promise<void> {
        try {
            const CursorModel = getCursorModel();
            await CursorModel.findOneAndUpdate(
                { key },
                { key, value, updatedAt: new Date() },
                { upsert: true, new: true }
            );
        } catch (e) {
            console.error(`[SuiService] Failed to save cursor ${key}:`, e);
        }
    }

    // ==================== Plan State ====================

    async getPlanState(planId: string): Promise<DCAPlanState | null> {
        try {
            const resp = await this.client.getObject({
                id: planId,
                options: { showContent: true }
            });

            if (!resp.data || !resp.data.content) return null;

            const fields = (resp.data.content as any).fields;
            const types = await this.getPlanTypes(planId);

            let totalAmount = 0;
            let remainingAmount = 0;

            if (fields.principal?.fields?.value) {
                totalAmount = Number(fields.principal.fields.value) || 0;
            }
            if (fields.accumulated_output?.fields?.value) {
                remainingAmount = Number(fields.accumulated_output.fields.value) || 0;
            }

            return {
                id: planId,
                owner: fields.owner,
                current_step_index: Number(fields.current_step_index),
                active: fields.active,
                steps: fields.steps || [],
                inputType: types.inputType,
                outputType: types.outputType,
                totalAmount,
                remainingAmount
            };
        } catch (error) {
            console.error(`[SuiService] Error fetching plan ${planId}:`, error);
            return null;
        }
    }

    private async getPlanTypes(planId: string): Promise<{inputType: string, outputType: string}> {
        try {
            const events = await this.client.queryEvents({
                query: {
                    MoveEventType: `${PACKAGE_ID}::${DCA_MODULE}::PlanCreated`
                } as RpcSuiEventFilter,
                limit: 100,
                order: 'descending'
            });

            const event = events.data.find(e => (e.parsedJson as any)?.plan_id === planId);
            if (!event?.parsedJson) return { inputType: "", outputType: "" };

            const json = event.parsedJson as any;
            const inputAssetBytes = json.input_asset;

            let inputType = "";
            if (Array.isArray(inputAssetBytes)) {
                inputType = new TextDecoder().decode(new Uint8Array(inputAssetBytes));
            } else if (typeof inputAssetBytes === 'string') {
                try {
                    const bytes = Buffer.from(inputAssetBytes, 'base64');
                    inputType = new TextDecoder().decode(bytes);
                } catch {
                    inputType = inputAssetBytes;
                }
            }

            // 从 input_asset 推断 outputType
            let outputType = "";
            if (inputType.includes('usdc') || inputType.includes('USDC')) {
                outputType = "0x2::sui::SUI";
            } else if (inputType.includes('sui') || inputType.includes('SUI')) {
                outputType = "0x5f759...::usdc::USDC";
            } else if (inputType.includes('wbtc') || inputType.includes('WBTC')) {
                outputType = "0x2::sui::SUI";
            } else {
                outputType = "0x2::sui::SUI";
            }

            console.log(`[SuiService] Resolved types for plan ${planId}: ${inputType} -> ${outputType}`);
            return { inputType, outputType };
        } catch (e) {
            console.warn(`[SuiService] Could not fetch types for plan ${planId}:`, e);
            return { inputType: "", outputType: "" };
        }
    }

    // ==================== Trigger Check ====================

    async checkTrigger(plan: DCAPlanState): Promise<boolean> {
        const stepIndex = plan.current_step_index;
        const step = plan.steps[stepIndex];

        if (!step) {
            console.log(`[SuiService] Plan ${plan.id} has no step at index ${stepIndex}.`);
            return false;
        }

        const triggerType = step.trigger?.tag || 0;

        if (triggerType === 0) {
            console.log("[SuiService] Time trigger - passing to on-chain verification.");
            return true;
        } else {
            // Price trigger
            if (!plan.inputType || !plan.outputType) {
                console.warn("[SuiService] Plan missing inputType or outputType");
                return false;
            }

            const price = await getCetusPrice(plan.inputType, plan.outputType);
            if (!price) {
                console.warn("[SuiService] Could not fetch price for trigger check");
                return false;
            }

            const inputDecimals = await getCoinDecimals(plan.inputType);
            const outputDecimals = await getCoinDecimals(plan.outputType);
            const triggerVal = Number(step.trigger_val);

            let targetPrice: number;
            if (inputDecimals >= outputDecimals) {
                targetPrice = triggerVal / Math.pow(10, inputDecimals - outputDecimals);
            } else {
                targetPrice = triggerVal * Math.pow(10, outputDecimals - inputDecimals);
            }

            console.log(`[SuiService] Price Trigger: Current ${price.toFixed(6)} vs Target ${targetPrice.toFixed(6)}`);
            return price <= targetPrice;
        }
    }

    // ==================== Transaction Building ====================

    async buildExecuteDcaTransaction(plan: DCAPlanState): Promise<Transaction> {
        const txb = new Transaction();
        txb.setGasBudget(100000000); // 0.1 SUI gas budget

        const coinTypeA = plan.inputType;
        const coinTypeB = plan.outputType;

        if (!coinTypeA || !coinTypeB) {
            throw new Error("Plan missing inputType or outputType");
        }

        // 构建简化版 DCA 执行交易
        // 合约只负责推进步骤，实际 swap 由 Keeper 使用 SDK 在链下执行

        // 1. 推进步骤
        txb.moveCall({
            target: `${PACKAGE_ID}::dca_types::advance_step`,
            typeArguments: [coinTypeA, coinTypeB],
            arguments: [
                txb.object(plan.id),
                txb.pure.u64(Date.now()),
                txb.object(CLOCK_ID)
            ]
        });

        return txb;
    }

    /**
     * 获取 Keeper 地址
     */
    getKeeperAddress(): string {
        return process.env.KEEPER_ADDRESS || "0x05dd4b6d3d3b1e4c6e7d8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9";
    }

    // ==================== Transaction Execution ====================

    async signAndExecute(txb: Transaction): Promise<ExecutionResult> {
        if (!this.keeperKeypair) {
            return { digest: "", success: false, error: "Keeper Keypair missing" };
        }

        try {
            const response = await this.client.signAndExecuteTransaction({
                transaction: txb,
                signer: this.keeperKeypair,
                options: {
                    showEffects: true,
                    showEvents: true,
                },
            });

            if (response.effects?.status.status === 'failure') {
                console.error("[SuiService] Transaction Failed:", response.effects.status.error);
                return {
                    digest: response.digest || "",
                    success: false,
                    error: response.effects.status.error
                };
            }

            return {
                digest: response.digest || "",
                success: true,
                events: response.events || []
            };
        } catch (e) {
            console.error("[SuiService] Execution Error:", e);
            return { digest: "", success: false, error: String(e) };
        }
    }

    async waitForTransaction(digest: string, timeout: number = 60000): Promise<boolean> {
        if (!digest) return false;
        try {
            const response = await this.client.waitForTransaction({
                digest,
                timeout,
                pollInterval: 2000
            });
            return response.effects?.status.status === 'success';
        } catch (e) {
            console.error(`[SuiService] waitForTransaction failed for ${digest}:`, e);
            return false;
        }
    }
}

export const suiService = new SuiServiceImpl();

export class DbService {
    async getPlansByOwner(owner: string): Promise<IPlan[]> {
        try {
            return await Plan.find({ owner }).sort({ createdAt: -1 });
        } catch (error) {
            console.error(`[DbService] Error fetching plans for ${owner}:`, error);
            return [];
        }
    }

    async getTradesByOwner(owner: string): Promise<ITrade[]> {
        try {
            return await Trade.find({ owner }).sort({ createdAt: -1 });
        } catch (error) {
            console.error(`[DbService] Error fetching trades for ${owner}:`, error);
            return [];
        }
    }

    async getPlanById(planId: string): Promise<IPlan | null> {
        try {
            return await Plan.findOne({ planId });
        } catch (error) {
            console.error(`[DbService] Error fetching plan ${planId}:`, error);
            return null;
        }
    }

    async getTradeByDigest(digest: string): Promise<ITrade | null> {
        try {
            return await Trade.findOne({ txDigest: digest });
        } catch (error) {
            console.error(`[DbService] Error fetching trade by digest ${digest}:`, error);
            return null;
        }
    }
}

export const dbService = new DbService();
