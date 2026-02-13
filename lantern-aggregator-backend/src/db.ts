import mongoose, { Schema, Document } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lantern-aggregator';

let isConnected = false;

// --- Cursor Model for Event Polling ---
export interface ICursor {
    key: string;
    value: string;
    updatedAt: Date;
}

const CursorSchema = new Schema<ICursor>({
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now }
});

let CursorModel: mongoose.Model<ICursor> | null = null;

export function getCursorModel(): mongoose.Model<ICursor> {
    if (!CursorModel) {
        CursorModel = mongoose.models.Cursor || mongoose.model<ICursor>('Cursor', CursorSchema);
    }
    return CursorModel;
}

export async function connectDB(): Promise<void> {
    if (isConnected) {
        console.log('✅ Using existing MongoDB connection');
        return;
    }

    try {
        await mongoose.connect(MONGODB_URI);
        isConnected = true;
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

export async function disconnectDB(): Promise<void> {
    if (!isConnected) return;
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 MongoDB disconnected');
}

