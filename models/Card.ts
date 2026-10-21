import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICard extends Document {
    userId: Types.ObjectId
    name: string
    last4: string
    creditLimit: number
    apr: number
    statementDay: number
    dueDaysAfterStatement: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

const cardSchema = new Schema<ICard>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        last4: {
            type: String,
            required: [true, 'Last 4 digits are required'],
            match: [/^\d{4}$/, 'Must be exactly 4 digits'],
        },
        creditLimit: {
            type: Number,
            required: [true, 'Credit limit is required'],
            min: [0.01, 'Credit limit must be positive'],
        },
        apr: {
            type: Number,
            required: [true, 'APR is required'],
            min: [0, 'APR cannot be negative'],
        },
        statementDay: {
            type: Number,
            required: [true, 'Statement day is required'],
            min: 1,
            max: 31,
        },
        dueDaysAfterStatement: {
            type: Number,
            required: [true, 'Due days after statement is required'],
            min: [1, 'Due days must be positive'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
)

cardSchema.index({ userId: 1 })

const Card = mongoose.models.Card || mongoose.model<ICard>('Card', cardSchema)
export default Card
