import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { signAccessToken, signRefreshToken } from '@/lib/auth'

const loginSchema = z.object({
    email: z.string().email('Invalid email').toLowerCase(),
    password: z.string().min(1, 'Password required'),
})

export async function POST(req: NextRequest) {
    try {
        await connectDB()

        const body = await req.json()
        const validation = loginSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.errors },
                { status: 422 }
            )
        }

        const { email, password } = validation.data

        const user = await User.findOne({ email })
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        const isMatch = await user.comparePassword(password)
        if (!isMatch) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        const accessToken = signAccessToken(user._id.toString())
        const refreshToken = signRefreshToken(user._id.toString())

        // Store hashed refresh token
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
        user.refreshTokenHash = refreshTokenHash
        await user.save()

        const response = NextResponse.json({
            accessToken,
            user: { id: user._id.toString(), name: user.name, email: user.email },
        })

        response.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
        })

        return response
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
