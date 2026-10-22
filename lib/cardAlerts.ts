import { Types } from 'mongoose'
import { startOfDay, format } from 'date-fns'
import connectDB from './mongodb'
import Card from '@/models/Card'
import User from '@/models/User'
import Transaction from '@/models/Transaction'
import { computeCardCycle } from './cardCycle'
import { sendEmail } from './email'

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function daysUntil(target: Date, from: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.round((target.getTime() - from.getTime()) / msPerDay)
}

// Same spends-minus-payments aggregation used by the summary/reconcile
// routes and the AI intents — a card with nothing owed shouldn't generate
// due-soon reminders forever.
async function computeOutstanding(userId: Types.ObjectId, cardId: Types.ObjectId): Promise<number> {
    const result = await Transaction.aggregate([
        {
            $match: {
                userId,
                cardId,
                type: { $in: ['expense', 'card_payment'] },
            },
        },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ])
    const totals = new Map(result.map((r) => [r._id as string, r.total as number]))
    const spends = totals.get('expense') || 0
    const payments = totals.get('card_payment') || 0
    return spends - payments
}

export async function checkAndSendCardDueReminders(date: Date = new Date()) {
    await connectDB()

    const today = startOfDay(date)
    const cards = await Card.find({ isActive: true })

    let checked = 0
    let remindersSent = 0

    for (const card of cards) {
        checked++

        try {
            const { dueDate } = computeCardCycle(card, today)

            // A stale remindersForDueDate (from a prior cycle) means the due
            // date has rolled over since the last check — reset all three
            // flags so this new cycle's reminders can fire again.
            if (!card.remindersForDueDate || card.remindersForDueDate.getTime() !== dueDate.getTime()) {
                card.remindersForDueDate = dueDate
                card.reminder5SentAt = null
                card.reminder2SentAt = null
                card.reminder0SentAt = null
            }

            const outstanding = await computeOutstanding(card.userId, card._id as Types.ObjectId)
            const daysLeft = daysUntil(dueDate, today)

            // Nothing owed: a card sitting at zero or a credit balance would
            // otherwise get "payment due" reminders forever.
            //
            // daysLeft < -1: the due date is more than a day in the past —
            // this happens for roughly a third of every cycle (between the
            // due date and the next statement), so treating every negative
            // daysLeft as "due now" would fire an immediate reminder for an
            // already-stale date on every card's first check. A 1-day grace
            // still catches a due-today reminder that a missed cron run
            // pushed slightly late.
            let threshold: 0 | 2 | 5 | null = null
            if (outstanding > 0 && daysLeft >= -1) {
                if (daysLeft <= 0 && !card.reminder0SentAt) threshold = 0
                else if (daysLeft <= 2 && !card.reminder2SentAt) threshold = 2
                else if (daysLeft <= 5 && !card.reminder5SentAt) threshold = 5
            }

            if (threshold !== null) {
                const user = await User.findById(card.userId)
                if (user) {
                    const { success } = await sendEmail({
                        to: user.email,
                        subject: `Payment due soon: ${card.name}`,
                        html: `<p>Hello ${escapeHtml(user.name)},</p><p>Your payment of <strong>₹${outstanding.toLocaleString()}</strong> for <strong>${escapeHtml(card.name)}</strong> is due on ${format(dueDate, 'MMMM d, yyyy')}.</p>`,
                    })
                    // Only stamp on a confirmed send — sendEmail swallows its
                    // own errors and resolves {success:false}, same as
                    // budgetAlerts.
                    if (success) {
                        if (threshold === 0) card.reminder0SentAt = new Date()
                        else if (threshold === 2) card.reminder2SentAt = new Date()
                        else card.reminder5SentAt = new Date()
                        remindersSent++
                    }
                }
            }

            await card.save()
        } catch (error) {
            // One card's failure (a bad lookup, a save validation error)
            // must not stop every other user's reminder check.
            console.error(`Card due-reminder check failed for card ${card._id}:`, error)
        }
    }

    return { checked, remindersSent }
}
