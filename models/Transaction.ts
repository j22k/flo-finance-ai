import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ITransaction extends Document {
    userId: Types.ObjectId
    title: string
    amount: number
    type: 'income' | 'expense' | 'card_payment'
    category: string
    date: Date
    note?: string
    isLent?: boolean
    repaid?: boolean
    paymentMethod?: 'cash' | 'upi' | 'card' | 'bank'
    cardId?: Types.ObjectId
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
            enum: ['income', 'expense', 'card_payment'],
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
        isLent: {
            type: Boolean,
            default: false,
        },
        repaid: {
            type: Boolean,
            default: false,
        },
        paymentMethod: {
            type: String,
            enum: ['cash', 'upi', 'card', 'bank'],
            default: 'cash',
        },
        cardId: {
            type: Schema.Types.ObjectId,
            ref: 'Card',
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
