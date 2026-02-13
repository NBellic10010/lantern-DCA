import { initTestnetSDK, CetusClmmSDK, TickMath, SwapModule } from '@cetusprotocol/cetus-sui-clmm-sdk';
import BN from 'bn.js';
import { Transaction } from '@mysten/sui/transactions';

// 单例模式，避免重复连接
let cetusSdk: CetusClmmSDK | null = null;

// 币种精度缓存
const decimalsCache: Record<string, number> = {
    '0x2::sui::SUI': 9,
    '0x5f759...::usdc::USDC': 6,
    '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS': 9,
    '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::wbtc::WBTC': 8,
    '0x27da7d8af36ba819615df9524abff1d2dd2b450b1bf5df6bfd66366f19e02120::fdusdc::FDUSD': 6,
    '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::sca::SCA': 9,
    '0x2::apt::APT': 8,
    '0x4da4526f270434c585d756d0c92856615124376a6d6de157d2e4f52964b63906::vsb::VSB': 9,
};

// ================= SDK 初始化 =================

export function getSdk(): CetusClmmSDK {
    if (!cetusSdk) {
        cetusSdk = initTestnetSDK(process.env.FULL_NODE_URL || '');
    }
    return cetusSdk;
}

// ================= 主流币对配置 =================

// Cetus Testnet 主流交易对配置
export const CETUS_TRADING_PAIRS = [
    { base: '0x2::sui::SUI', quote: '0x5f759...::usdc::USDC', name: 'SUI/USDC' },
    { base: '0x2::sui::SUI', quote: '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS', name: 'SUI/CETUS' },
    { base: '0x2::sui::SUI', quote: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::wbtc::WBTC', name: 'SUI/WBTC' },
    { base: '0x2::sui::SUI', quote: '0x27da7d8af36ba819615df9524abff1d2dd2b450b1bf5df6bfd66366f19e02120::fdusdc::FDUSD', name: 'SUI/FDUSD' },
    { base: '0x5f759...::usdc::USDC', quote: '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS', name: 'USDC/CETUS' },
    { base: '0x5f759...::usdc::USDC', quote: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::wbtc::WBTC', name: 'USDC/WBTC' },
    { base: '0x5f759...::usdc::USDC', quote: '0x27da7d8af36ba819615df9524abff1d2dd2b450b1bf5df6bfd66366f19e02120::fdusdc::FDUSD', name: 'USDC/FDUSD' },
    { base: '0x5f759...::usdc::USDC', quote: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::sca::SCA', name: 'USDC/SCA' },
    { base: '0x5f759...::usdc::USDC', quote: '0x2::apt::APT', name: 'USDC/APT' },
    { base: '0x5f759...::usdc::USDC', quote: '0x4da4526f270434c585d756d0c92856615124376a6d6de157d2e4f52964b63906::vsb::VSB', name: 'USDC/VSB' },
    { base: '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS', quote: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::wbtc::WBTC', name: 'CETUS/WBTC' },
    { base: '0xceb3307f36d1a805c352b3703e17d2381682e1d96e0a85b3c5a39424da452a69::cetus::CETUS', quote: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::sca::SCA', name: 'CETUS/SCA' },
    { base: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::wbtc::WBTC', quote: '0x27da7d8af36ba819615df9524abff1d2dd2b450b1bf5df6bfd66366f19e02120::fdusdc::FDUSD', name: 'WBTC/FDUSD' },
    { base: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::sca::SCA', quote: '0x2::sui::SUI', name: 'SCA/SUI' },
    { base: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::sca::SCA', quote: '0x5f759...::usdc::USDC', name: 'SCA/USDC' },
    { base: '0x2::sui::SUI', quote: '0x2::apt::APT', name: 'SUI/APT' },
    { base: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::vsb::VSB', quote: '0x2::sui::SUI', name: 'VSB/SUI' },
    { base: '0x5d4b302506645cfe1a597a5bec98df5c4fc79324::vsb::VSB', quote: '0x5f759...::usdc::USDC', name: 'VSB/USDC' },
    { base: '0x27da7d8af36ba819615df9524abff1d2dd2b450b1bf5df6bfd66366f19e02120::fdusdc::FDUSD', quote: '0x2::sui::SUI', name: 'FDUSD/SUI' },
];


/**
 * 获取交易对池子
 * 返回第一个池子（通常也是流动性最好的），找不到则抛错
 */
export async function getPool(coinTypeA: string, coinTypeB: string) {
    const sdk = getSdk();
    const pools = await sdk.Pool.getPoolByCoins([coinTypeA, coinTypeB]);

    if (!pools || pools.length === 0) {
        throw new Error(`No pool found for ${coinTypeA} and ${coinTypeB}`);
    }

    // 注意：生产环境建议 liquidity 根据排序后再取第一个
    return pools[0];
}

/**
 * 获取池子 ID
 */
export async function getPoolId(coinTypeA: string, coinTypeB: string): Promise<string> {
    const pool = await getPool(coinTypeA, coinTypeB);
    const poolAny = pool as any;

    // 尝试多种可能的字段名
    return poolAny.pool_address ||
           poolAny.poolId ||
           poolAny.pool_object_id ||
           poolAny.id ||
           "";
}

// ================= 价格查询 =================

export async function getCetusPrice(fromCoinType: string, toCoinType: string): Promise<number | null> {
    try {
        const pool = await getPool(fromCoinType, toCoinType);

        const poolCoinTypeA = pool.coinTypeA;
        const poolCoinTypeB = pool.coinTypeB;

        if (!poolCoinTypeA || !poolCoinTypeB) {
            throw new Error(`Pool missing coin types`);
        }

        // 判断方向
        const isA2B = poolCoinTypeA === fromCoinType;

        // 获取精度
        const decimalsA = await getCoinDecimals(pool.coinTypeA);
        const decimalsB = await getCoinDecimals(pool.coinTypeB);

        // 计算价格
        const priceOfA = TickMath.sqrtPriceX64ToPrice(
            new BN(pool.current_sqrt_price),
            decimalsA,
            decimalsB
        );

        const priceNum = priceOfA.toNumber();

        // 如果是 B -> A，需要取倒数
        if (!isA2B) {
            if (priceNum === 0) return 0;
            return 1 / priceNum;
        }

        return priceNum;

    } catch (error) {
        console.error("❌ Error calculating Cetus price:", error);
        return null;
    }
}

// ================= 多池子信息查询 =================

export interface PoolInfo {
    name: string;
    base: string;
    quote: string;
    price: number | null;
    liquidity: number | null;
    feeRate: number | null;
    volume24h?: number;
    poolAddress: string | null;
    lastUpdated: string;
}

export interface AllPoolsResponse {
    pairs: PoolInfo[];
    totalPairs: number;
    availablePairs: number;
    lastUpdated: string;
}

/**
 * 获取单个交易对的详细信息
 */
export async function getPairInfo(base: string, quote: string, name: string): Promise<PoolInfo> {
    try {
        const pool = await getPool(base, quote);
        const decimalsA = await getCoinDecimals(pool.coinTypeA);
        const decimalsB = await getCoinDecimals(pool.coinTypeB);

        // 计算价格
        const price = await getCetusPrice(base, quote);

        // 提取池子地址
        const poolAny = pool as any;
        const poolAddress = poolAny.pool_address || poolAny.poolId || poolAny.id || null;

        return {
            name,
            base,
            quote,
            price,
            liquidity: pool.liquidity ? Number(pool.liquidity) : null,
            feeRate: pool.fee_rate ? Number(pool.fee_rate) / 10000 : null, // ppm to percentage
            poolAddress,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.warn(`[Cetus] Failed to get info for ${name}:`, error);
        return {
            name,
            base,
            quote,
            price: null,
            liquidity: null,
            feeRate: null,
            poolAddress: null,
            lastUpdated: new Date().toISOString()
        };
    }
}

/**
 * 获取所有主流交易对的详细信息
 * @param pairs 可选的自定义交易对数组，默认为 CETUS_TRADING_PAIRS
 */
export async function getAllPairsInfo(pairs = CETUS_TRADING_PAIRS): Promise<AllPoolsResponse> {
    const startTime = Date.now();

    // 并行查询所有池子信息
    const promises = pairs.map(pair =>
        getPairInfo(pair.base, pair.quote, pair.name)
    );

    const results = await Promise.all(promises);

    const availablePairs = results.filter(p => p.price !== null).length;

    const elapsed = Date.now() - startTime;
    console.log(`[Cetus] Fetched ${availablePairs}/${pairs.length} pairs in ${elapsed}ms`);

    return {
        pairs: results,
        totalPairs: pairs.length,
        availablePairs,
        lastUpdated: new Date().toISOString()
    };
}

/**
 * 获取池子当前价格（简化版）
 */
export async function getSimplePrice(base: string, quote: string): Promise<number | null> {
    return getCetusPrice(base, quote);
}

/**
 * 根据币种获取其与 USDC 的价格
 */
export async function getPriceVsUsdc(coinType: string): Promise<number | null> {
    const usdcType = '0x5f759...::usdc::USDC';

    // 如果本身就是 USDC
    if (coinType.includes('usdc') || coinType.includes('USDC')) {
        return 1;
    }

    try {
        return await getCetusPrice(coinType, usdcType);
    } catch {
        return null;
    }
}

/**
 * 获取交易对排序后的币种（确保 A < B）
 */
function sortCoinTypes(coinTypeA: string, coinTypeB: string): [string, string] {
    return coinTypeA < coinTypeB ? [coinTypeA, coinTypeB] : [coinTypeB, coinTypeA];
}

/**
 * 格式化流动性数值（转为可读格式）
 */
export function formatLiquidity(liquidity: number | null, decimalsA: number, decimalsB: number): string {
    if (liquidity === null) return 'N/A';

    // 流动性是虚数的平方，格式化需要考虑两种代币
    // 这里返回原始值，前端可以根据需要转换
    return liquidity.toExponential(4);
}

export async function getCoinDecimals(coinType: string): Promise<number> {
    if (decimalsCache[coinType] !== undefined) {
        return decimalsCache[coinType];
    }

    // 常用币种硬编码缓存
    if (coinType.endsWith('::sui::SUI')) return 9;
    if (coinType.endsWith('::usdc::USDC')) return 6;
    if (coinType.endsWith('::cetus::CETUS')) return 9;

    const sdk = getSdk();

    try {
        const metadata = await sdk.fullClient.getCoinMetadata({ coinType });
        const decimals = metadata?.decimals ?? 9;
        decimalsCache[coinType] = decimals;
        return decimals;
    } catch (error) {
        console.error(`❌ Error fetching decimals for ${coinType}:`, error);
        return 9; // Fallback
    }
}

// ================= Swap 交易构建 =================

/**
 * 获取滑点阈值
 * @param amountLimit 预期输出的最小（或输入的最大）金额
 * @param slippageBps 滑点（bps），例如 100 = 1%
 * @param byAmountIn true 表示固定输入，false 表示固定输出
 */
function calculateAmountLimit(amountLimit: string, slippageBps: number, byAmountIn: boolean): string {
    const amount = new BN(amountLimit);

    // 如果是固定输入，需要计算最小输出 (amount * (1 - slippage))
    // 如果是固定输出，需要计算最大输入 (amount * (1 + slippage))
    const slippageMultiplier = byAmountIn
        ? new BN(10000).sub(new BN(slippageBps))  // 10000 - slippage
        : new BN(10000).add(new BN(slippageBps)); // 10000 + slippage

    const result = amount.mul(slippageMultiplier).div(new BN(10000));
    return result.toString();
}

/**
 * 构建 Cetus Swap 交易
 * @param params 构建参数
 * @returns 交易对象
 */
export async function buildCetusSwapTransaction(params: {
    poolId: string;
    coinTypeA: string;
    coinTypeB: string;
    a2b: boolean;           // true: A -> B, false: B -> A
    byAmountIn: boolean;    // true: 固定输入金额, false: 固定输出金额
    amount: string;         // 金额（字符串格式）
    slippageBps: number;    // 滑点（bps），例如 100 = 1%
    inputCoin: string;      // 输入币种地址
    outputCoin: string;     // 输出币种地址
}): Promise<Transaction> {
    const sdk = getSdk();
    const swapModule = new SwapModule(sdk);

    // 1. 预计算 swap 结果
    const pool = await getPool(params.coinTypeA, params.coinTypeB);

    // 如果输入币种不是池子的 A，需要调整参数
    const actualA2B = pool.coinTypeA === params.inputCoin ? params.a2b : !params.a2b;

    // 2. 构建 SwapParams
    // 注意：amount 和 amount_limit 需要是字符串格式
    const amountLimit = calculateAmountLimit(
        params.amount,
        params.slippageBps,
        params.byAmountIn
    );

    const swapParams = {
        pool_id: params.poolId,
        coinTypeA: params.coinTypeA,
        coinTypeB: params.coinTypeB,
        a2b: actualA2B,
        by_amount_in: params.byAmountIn,
        amount: params.amount,
        amount_limit: amountLimit,
    };

    // 3. 如果是固定输入，需要包含 gas estimation
    if (params.byAmountIn) {
        const decimalsA = await getCoinDecimals(params.coinTypeA);
        const decimalsB = await getCoinDecimals(params.coinTypeB);
        const poolAny = pool as any;

        const gasEstimateArg = {
            byAmountIn: params.byAmountIn,
            slippage: { numerator: new BN(params.slippageBps), denominator: new BN(10000) },
            decimalsA,
            decimalsB,
            swapTicks: poolAny.swap_ticks || [],
            currentPool: pool,
        };

        return await swapModule.createSwapTransactionPayload(swapParams, gasEstimateArg);
    }

    // 4. 如果是固定输出
    return await swapModule.createSwapTransactionPayload(swapParams);
}

/**
 * 简化版：构建简单的 A -> B Swap 交易
 * @param inputCoinType 输入币种
 * @param outputCoinType 输出币种
 * @param amount 输入金额（最小精度）
 * @param slippageBps 滑点 bps
 */
export async function buildSimpleSwapTransaction(
    inputCoinType: string,
    outputCoinType: string,
    amount: string,
    slippageBps: number = 100 // 默认 1% 滑点
): Promise<Transaction> {
    // 1. 获取池子信息
    const pool = await getPool(inputCoinType, outputCoinType);
    const poolId = await getPoolId(inputCoinType, outputCoinType);

    // 2. 确定方向
    const isA2B = pool.coinTypeA === inputCoinType;

    // 3. 构建交易
    return await buildCetusSwapTransaction({
        poolId,
        coinTypeA: pool.coinTypeA,
        coinTypeB: pool.coinTypeB,
        a2b: isA2B,
        byAmountIn: true,  // 固定输入金额
        amount: amount,
        slippageBps: slippageBps,
        inputCoin: inputCoinType,
        outputCoin: outputCoinType,
    });
}
