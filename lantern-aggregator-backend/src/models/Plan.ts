import mongoose, { Document, Schema } from 'mongoose';

// Plan 状态枚举
export enum PlanStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

// Strategy Step 接口 (对应 Move 中的 StrategyStep)
export interface IStrategyStep {
    triggerType: number; // 0=Time, 1=PriceBelow, 2=PriceAbove
    triggerValue: number; // 时间间隔(ms) 或 价格阈值
    actionPercent: number; // 0-100
    slippageTolerance: number; // Basis points
    executedAt?: Date; // 执行时间
    completedAt?: Date; // 完成时间
}

// Plan 文档接口
export interface IPlan extends Document {
    planId: string; // 链上 Object ID
    owner: string; // 用户地址
    inputType: string; // 投入的币种 (如 0x...::usdc::USDC)
    outputType: string; // 产出的币种 (如 0x...::sui::SUI)
    inputAmount: number; // 总投入金额 (最小精度，如 6位)
    remainingAmount: number; // 剩余金额
    currentStepIndex: number; // 当前步骤索引
    steps: IStrategyStep[]; // 策略步骤列表
    status: PlanStatus;
    createdAt: Date;
    updatedAt: Date;
}

// Trade 文档接口
export interface ITrade extends Document {
    tradeId: string; // 交易唯一标识 (可以用 digest)
    planId: string; // 关联的 Plan ID
    owner: string; // 用户地址
    stepIndex: number; // 执行的步骤索引
    inputAmount: number; // 投入金额
    outputAmount: number; // 产出金额
    inputCoin: string; // 投入币种
    outputCoin: string; // 产出币种
    txDigest: string; // 交易哈希
    priceAtExecution: number; // 执行时价格
    createdAt: Date;
}

const StrategyStepSchema = new Schema<IStrategyStep>({
    triggerType: { type: Number, required: true },
    triggerValue: { type: Number, required: true },
    actionPercent: { type: Number, required: true },
    slippageTolerance: { type: Number, required: true },
    executedAt: { type: Date },
    completedAt: { type: Date }
}, { _id: false });

const PlanSchema = new Schema<IPlan>({
    planId: { type: String, required: true, unique: true, index: true },
    owner: { type: String, required: true, index: true },
    inputType: { type: String, required: true },
    outputType: { type: String, required: true },
    inputAmount: { type: Number, required: true },
    remainingAmount: { type: Number, required: true },
    currentStepIndex: { type: Number, default: 0 },
    steps: { type: [StrategyStepSchema], required: true },
    status: {
        type: String,
        enum: Object.values(PlanStatus),
        default: PlanStatus.ACTIVE
    }
}, {
    timestamps: true
});

const TradeSchema = new Schema<ITrade>({
    tradeId: { type: String, required: true, unique: true, index: true },
    planId: { type: String, required: true, index: true },
    owner: { type: String, required: true, index: true },
    stepIndex: { type: Number, required: true },
    inputAmount: { type: Number, required: true },
    outputAmount: { type: Number, required: true },
    inputCoin: { type: String, required: true },
    outputCoin: { type: String, required: true },
    txDigest: { type: String, required: true },
    priceAtExecution: { type: Number }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

// 复合索引：查询用户所有 Plan
PlanSchema.index({ owner: 1, createdAt: -1 });
// 复合索引：查询用户的所有交易
TradeSchema.index({ owner: 1, createdAt: -1 });
// 查询某个 Plan 的所有交易
TradeSchema.index({ planId: 1, createdAt: -1 });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);

