import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IContribution {
    amount: number
    date: Date
    note?: string
}

export interface IGoal extends Document {
    userId: Types.ObjectId
    title: string
    targetAmount: number
    targetDate: Date
    currentAmount: number
    contributions: IContribution[]
    createdAt: Date
    updatedAt: Date
}

const contributionSchema = new Schema<IContribution>(
    {
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0.01, 'Amount must be positive'],
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
        note: {
            type: String,
            trim: true,
        },
    },
    { _id: false }
)

const goalSchema = new Schema<IGoal>(
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
        targetAmount: {
            type: Number,
            required: [true, 'Target amount is required'],
            min: [0.01, 'Target amount must be positive'],
        },
        targetDate: {
            type: Date,
            required: [true, 'Target date is required'],
        },
        currentAmount: {
            type: Number,
            default: 0,
        },
        contributions: {
            type: [contributionSchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
)

goalSchema.index({ userId: 1, createdAt: -1 })

const Goal = mongoose.models.Goal || mongoose.model<IGoal>('Goal', goalSchema)
export default Goal
