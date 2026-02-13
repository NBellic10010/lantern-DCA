import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { runKeeperLoop } from './keeper';
import { suiService, dbService } from './sui';
import { getCetusPrice, getCoinDecimals, CETUS_TRADING_PAIRS, getAllPairsInfo, PoolInfo, AllPoolsResponse } from './cetus';
import { connectDB } from './db';

// USDC 地址配置 (从环境变量读取)
const USDC_ADDRESS = process.env.USDC_ADDRESS;
if (!USDC_ADDRESS) {
    console.warn("⚠️ USDC_ADDRESS not set in .env, using placeholder");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Basic Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get User Plans Endpoint
app.get('/api/plans', async (req: Request, res: Response) => {
    const { user } = req.query;
    if (!user || typeof user !== 'string') {
        return res.status(400).json({ error: "Missing 'user' address" });
    }

    try {
        const plans = await dbService.getPlansByOwner(user);
        res.json(plans);
    } catch (error) {
        console.error("Error fetching plans:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get User Trades Endpoint
app.get('/api/trades', async (req: Request, res: Response) => {
    const { user } = req.query;
    if (!user || typeof user !== 'string') {
        return res.status(400).json({ error: "Missing 'user' address" });
    }

    try {
        const trades = await dbService.getTradesByOwner(user);
        res.json(trades);
    } catch (error) {
        console.error("Error fetching trades:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get User DCA Yield Endpoint
app.get('/api/yields', async (req: Request, res: Response) => {
    const { user } = req.query;
    if (!user || typeof user !== 'string') {
        return res.status(400).json({ error: "Missing 'user' address" });
    }

    try {
        // 1. Fetch Trades from DB
        const trades = await dbService.getTradesByOwner(user);

        if (trades.length === 0) {
            return res.json({
                message: "No DCA history found for this user.",
                totalInvested: "0.00",
                totalCurrentValue: "0.00",
                roi: "0.00%",
                breakdown: []
            });
        }

        // 获取 USD 锚定币地址 (用于计算 USD 价值)
        const usdcAddress = USDC_ADDRESS || "0x5f759...::usdc::USDC";

        // 2. 按币种分组统计
        const breakdown: Record<string, { invested: number; currentValue: number; amount: number }> = {};
        const pricePromises: Promise<void>[] = [];
        const prices: Record<string, number> = {};
        const decimalsCache: Record<string, number> = {};
        const coinsToFetch: Set<string> = new Set();

        // 收集需要获取精度的币种
        for (const trade of trades) {
            coinsToFetch.add(trade.inputCoin);
            coinsToFetch.add(trade.outputCoin);

            // 初始化 breakdown
            if (!breakdown[trade.outputCoin]) {
                breakdown[trade.outputCoin] = { invested: 0, currentValue: 0, amount: 0 };
            }

            // 如果还没查过这个币种的价格，添加到异步任务
            if (prices[trade.outputCoin] === undefined && trade.outputCoin !== usdcAddress) {
                pricePromises.push(
                    getCetusPrice(trade.outputCoin, usdcAddress).then(price => {
                        prices[trade.outputCoin] = price || 0;
                    })
                );
            }
        }

        // 3. 并行获取所有精度
        const decimalsPromises: Promise<void>[] = [];
        for (const coin of coinsToFetch) {
            decimalsPromises.push(
                getCoinDecimals(coin).then(d => {
                    decimalsCache[coin] = d;
                })
            );
        }

        // 等待精度和价格获取完成
        await Promise.all([...decimalsPromises, ...pricePromises]);

        // 4. 计算各币种金额
        for (const trade of trades) {
            // --- 处理投入资产 (Input) ---
            const inputDecimals = decimalsCache[trade.inputCoin] || 9;
            const inputAmount = Number(trade.inputAmount) / Math.pow(10, inputDecimals);

            if (!breakdown[trade.inputCoin]) {
                breakdown[trade.inputCoin] = { invested: 0, currentValue: 0, amount: 0 };
            }
            breakdown[trade.inputCoin].invested += inputAmount;
            breakdown[trade.inputCoin].amount += inputAmount;

            // --- 处理产出资产 (Output) ---
            const outputDecimals = decimalsCache[trade.outputCoin] || 9;
            const outputAmount = Number(trade.outputAmount) / Math.pow(10, outputDecimals);
            breakdown[trade.outputCoin].amount += outputAmount;
        }

        // 5. 计算各币种当前价值
        for (const coin of Object.keys(breakdown)) {
            if (coin === usdcAddress) {
                // USDC 本身等于 USD 价值
                breakdown[coin].currentValue = breakdown[coin].amount;
            } else {
                const price = prices[coin] || 0;
                breakdown[coin].currentValue = breakdown[coin].amount * price;
            }
        }

        // 6. 计算总体 ROI
        let totalInvested = 0;
        let totalCurrentValue = 0;

        for (const coin of Object.keys(breakdown)) {
            totalInvested += breakdown[coin].invested;
            totalCurrentValue += breakdown[coin].currentValue;
        }

        const roi = totalInvested > 0
            ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
            : 0;

        // 7. 格式化输出
        const breakdownArray = Object.entries(breakdown).map(([coin, data]) => ({
            coin,
            invested: data.invested.toFixed(2),
            currentValue: data.currentValue.toFixed(2),
            amount: data.amount.toFixed(4)
        }));

        res.json({
            totalInvested: totalInvested.toFixed(2),
            totalCurrentValue: totalCurrentValue.toFixed(2),
            roi: roi.toFixed(2) + "%",
            breakdown: breakdownArray
        });

    } catch (error) {
        console.error("Yield calculation error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get Cetus Price Endpoint
app.get('/api/price', async (req: Request, res: Response) => {
    const { from, to } = req.query;
    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
        return res.status(400).json({ error: "Missing 'from' or 'to' query parameter" });
    }

    try {
        const price = await getCetusPrice(from, to);
        if (price) {
            res.json({ from, to, price });
        } else {
            res.status(404).json({ error: "Price not found or pool not available" });
        }
    } catch (error) {
        console.error("Price fetch error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ================= Cetus Pools API =================

/**
 * 获取所有主流交易对信息
 * GET /api/cetus/pairs
 */
app.get('/api/cetus/pairs', async (req: Request, res: Response) => {
    try {
        const result = await getAllPairsInfo(CETUS_TRADING_PAIRS);
        res.json(result);
    } catch (error) {
        console.error("Cetus pairs fetch error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 获取单个交易对信息
 * GET /api/cetus/pair/:name
 */
app.get('/api/cetus/pair/:name', async (req: Request, res: Response) => {
    const { name } = req.params;

    try {
        // 查找对应的交易对
        const pair = CETUS_TRADING_PAIRS.find(p =>
            p.name.toLowerCase() === name.toLowerCase() ||
            p.name.replace('/', '-').toLowerCase() === name.toLowerCase()
        );

        if (!pair) {
            return res.status(404).json({
                error: "Pair not found",
                availablePairs: CETUS_TRADING_PAIRS.map(p => p.name)
            });
        }

        const poolInfo = await getAllPairsInfo([pair]);
        const pairInfo = poolInfo.pairs[0];

        res.json(pairInfo);
    } catch (error) {
        console.error("Cetus pair fetch error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * 获取交易对列表（简要信息）
 * GET /api/cetus/pair-list
 */
app.get('/api/cetus/pair-list', async (req: Request, res: Response) => {
    const list = CETUS_TRADING_PAIRS.map(p => ({
        name: p.name,
        base: p.base,
        quote: p.quote
    }));
    res.json({
        pairs: list,
        total: list.length
    });
});

/**
 * 批量获取价格
 * GET /api/cetus/prices?pairs=SUI/USDC,USDC/CETUS
 */
app.get('/api/cetus/prices', async (req: Request, res: Response) => {
    const { pairs } = req.query;

    if (!pairs || typeof pairs !== 'string') {
        return res.status(400).json({ error: "Missing 'pairs' query parameter" });
    }

    try {
        const pairNames = pairs.split(',').map(p => p.trim());
        const results: Record<string, { price: number | null; name: string }> = {};

        for (const name of pairNames) {
            const pair = CETUS_TRADING_PAIRS.find(p =>
                p.name.toLowerCase() === name.toLowerCase()
            );

            if (pair) {
                const price = await getCetusPrice(pair.base, pair.quote);
                results[name] = { price, name };
            } else {
                results[name] = { price: null, name };
            }
        }

        res.json({
            prices: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Batch price fetch error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ================= Start Server =================
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await connectDB(); // 连接数据库
    // Start Keeper Bot in background
    runKeeperLoop();
});
