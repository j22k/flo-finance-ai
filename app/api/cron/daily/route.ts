import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { generateDueRecurringTransactions } from '@/lib/recurringGenerator'
import { checkAndSendBudgetAlerts } from '@/lib/budgetAlerts'
import { checkAndSendCardDueReminders } from '@/lib/cardAlerts'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        await connectDB()

        const now = new Date()
        const [recurringResult, alertResult, cardReminderResult] = await Promise.allSettled([
            generateDueRecurringTransactions(now),
            checkAndSendBudgetAlerts(now),
            checkAndSendCardDueReminders(now),
        ])

        // Promise.allSettled never rejects, so a failed branch wouldn't
        // otherwise reach the catch block below or get logged anywhere.
        if (recurringResult.status === 'rejected') {
            console.error('Daily cron: recurring generation failed:', recurringResult.reason)
        }
        if (alertResult.status === 'rejected') {
            console.error('Daily cron: budget alert check failed:', alertResult.reason)
        }
        if (cardReminderResult.status === 'rejected') {
            console.error('Daily cron: card due-reminder check failed:', cardReminderResult.reason)
        }

        return NextResponse.json({
            message: 'Daily cron completed',
            recurring: recurringResult.status === 'fulfilled' ? recurringResult.value : { error: String(recurringResult.reason) },
            budgetAlerts: alertResult.status === 'fulfilled' ? alertResult.value : { error: String(alertResult.reason) },
            cardReminders: cardReminderResult.status === 'fulfilled' ? cardReminderResult.value : { error: String(cardReminderResult.reason) },
        })
    } catch (error) {
        console.error('Daily cron error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
