import mongoose, { Document, Schema } from 'mongoose';

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

// 复合索引：查询用户的所有交易
TradeSchema.index({ owner: 1, createdAt: -1 });
// 查询某个 Plan 的所有交易
TradeSchema.index({ planId: 1, createdAt: -1 });

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);

