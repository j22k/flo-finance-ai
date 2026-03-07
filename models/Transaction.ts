import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ITransaction extends Document {
    userId: Types.ObjectId
    title: string
    amount: number
    type: 'income' | 'expense'
    category: string
    date: Date
    note?: string
    createdAt: Date
    updatedAt: Date
}

const transactionSchema = new Schema<ITransaction>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be positive'],
        },
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: [true, 'Type is required'],
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
        },
        note: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
)

transactionSchema.index({ userId: 1, date: -1 })
transactionSchema.index({ userId: 1, category: 1 })

const Transaction =
    mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', transactionSchema)
export default Transaction
