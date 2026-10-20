import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { generateDueRecurringTransactions } from '@/lib/recurringGenerator'
import { checkAndSendBudgetAlerts } from '@/lib/budgetAlerts'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        await connectDB()

        const now = new Date()
        const [recurringResult, alertResult] = await Promise.allSettled([
            generateDueRecurringTransactions(now),
            checkAndSendBudgetAlerts(now),
        ])

        return NextResponse.json({
            message: 'Daily cron completed',
            recurring: recurringResult.status === 'fulfilled' ? recurringResult.value : { error: String(recurringResult.reason) },
            budgetAlerts: alertResult.status === 'fulfilled' ? alertResult.value : { error: String(alertResult.reason) },
        })
    } catch (error) {
        console.error('Daily cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
