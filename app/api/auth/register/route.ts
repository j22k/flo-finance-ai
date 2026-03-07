import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'

const registerSchema = z.object({
    name: z.string().min(1, 'Name is required').trim(),
    email: z.string().email('Invalid email format').toLowerCase(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
    try {
        await connectDB()

        const body = await req.json()
        const validation = registerSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.errors },
                { status: 422 }
            )
        }

        const { name, email, password } = validation.data

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
        }

        const user = await User.create({ name, email, password })

        return NextResponse.json(
            {
                message: 'Account created',
                user: { id: user._id.toString(), name: user.name, email: user.email },
            },
            { status: 201 }
        )
    } catch (error) {
        console.error('Register error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
