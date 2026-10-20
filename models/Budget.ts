import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBudget extends Document {
    userId: Types.ObjectId
    category: string
    limitAmount: number
    month: number
    year: number
    alert80SentAt?: Date | null
    alert100SentAt?: Date | null
    createdAt: Date
    updatedAt: Date
}

const budgetSchema = new Schema<IBudget>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
        },
        limitAmount: {
            type: Number,
            required: [true, 'Limit amount is required'],
            min: [0.01, 'Limit must be positive'],
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
        alert80SentAt: {
            type: Date,
            default: null,
        },
        alert100SentAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
)

budgetSchema.index({ userId: 1, category: 1, month: 1, year: 1 }, { unique: true })

const Budget = mongoose.models.Budget || mongoose.model<IBudget>('Budget', budgetSchema)
export default Budget
