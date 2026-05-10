import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import { generateAndSendMonthlyReport } from '@/lib/reports'
import { subMonths } from 'date-fns'

export async function GET(req: NextRequest) {
    // 1. Verify Cron Secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        await connectDB()

        // Get all users
        const users = await User.find({})
        
        // We want reports for the PREVIOUS month
        const lastMonth = subMonths(new Date(), 1)

        console.log(`Starting automated monthly reports for ${users.length} users...`)

        const results = await Promise.allSettled(
            users.map(user => generateAndSendMonthlyReport(user, lastMonth))
        )

        const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
        const failed = results.length - successful

        return NextResponse.json({
            message: 'Cron job completed',
            summary: {
                totalUsers: users.length,
                successful,
                failed
            }
        })
    } catch (error) {
        console.error('Cron job error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
