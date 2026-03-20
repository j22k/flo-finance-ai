import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICategory extends Document {
    userId: Types.ObjectId
    name: string
    type: 'income' | 'expense' // So a user knows which categories apply to what
    color?: string
    createdAt: Date
    updatedAt: Date
}

const categorySchema = new Schema<ICategory>(
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
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: [true, 'Type is required'],
        },
        color: {
            type: String,
            trim: true,
            default: '#cbd5e1'
        },
    },
    {
        timestamps: true,
    }
)

categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true })

const Category =
    mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema)
export default Category
