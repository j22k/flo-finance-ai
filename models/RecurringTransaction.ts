import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IRecurringTransaction extends Document {
    userId: Types.ObjectId
    title: string
    amount: number
    type: 'income' | 'expense'
    category: string
    note?: string
    frequency: 'weekly' | 'monthly' | 'yearly'
    startDate: Date
    nextRunDate: Date
    endDate?: Date
    isActive: boolean
    lastGeneratedAt?: Date
    createdAt: Date
    updatedAt: Date
}

const recurringTransactionSchema = new Schema<IRecurringTransaction>(
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
        note: {
            type: String,
            trim: true,
        },
        frequency: {
            type: String,
            enum: ['weekly', 'monthly', 'yearly'],
            required: [true, 'Frequency is required'],
        },
        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },
        nextRunDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastGeneratedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
)

recurringTransactionSchema.index({ isActive: 1, nextRunDate: 1 })

const RecurringTransaction =
    mongoose.models.RecurringTransaction ||
    mongoose.model<IRecurringTransaction>('RecurringTransaction', recurringTransactionSchema)
export default RecurringTransaction
