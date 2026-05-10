import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import User from '@/models/User'
import { getAuthUser } from '@/lib/auth-server'
import { sendEmail } from '@/lib/email'
import { generateAndSendMonthlyReport } from '@/lib/reports'
import { subMonths } from 'date-fns'

export async function POST(req: NextRequest) {
    try {
        const auth = getAuthUser(req)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await connectDB()
        const user = await User.findById(auth.userId)
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Generate report for the PREVIOUS month
        const lastMonth = subMonths(new Date(), 1)
        const result = await generateAndSendMonthlyReport(user, lastMonth)

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Report sent successfully' })
    } catch (error) {
        console.error('Email report error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
