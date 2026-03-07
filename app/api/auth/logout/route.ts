import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { verifyRefreshToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        const refreshToken = req.cookies.get('refreshToken')?.value

        if (refreshToken) {
            const decoded = verifyRefreshToken(refreshToken)
            if (decoded) {
                await connectDB()
                await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: '' })
            }
        }

        const response = NextResponse.json({ message: 'Logged out' })
        response.cookies.set('refreshToken', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 0,
        })

        return response
    } catch (error) {
        console.error('Logout error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
