import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
    name: string
    email: string
    password: string
    refreshTokenHash: string
    createdAt: Date
    updatedAt: Date
    comparePassword(candidate: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 8,
        },
        refreshTokenHash: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
)

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next()
    this.password = await bcrypt.hash(this.password, 12)
    next()
})

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password)
}

const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema)
export default User
