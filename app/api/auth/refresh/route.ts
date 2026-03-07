import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { verifyRefreshToken, signAccessToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const refreshToken = req.cookies.get('refreshToken')?.value

        if (!refreshToken) {
            return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
        }

        const decoded = verifyRefreshToken(refreshToken)
        if (!decoded) {
            return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
        }

        await connectDB()
        const user = await User.findById(decoded.userId)

        if (!user || !user.refreshTokenHash) {
            return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
        }

        const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
        }

        const accessToken = signAccessToken(user._id.toString())

        return NextResponse.json({ accessToken })
    } catch (error) {
        console.error('Refresh error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
