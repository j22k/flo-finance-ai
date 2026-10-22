import connectDB from './mongodb'
import Card from '@/models/Card'
import User from '@/models/User'
import { computeCardCycle } from './cardCycle'
import { sendEmail } from './email'

function daysUntil(target: Date, from: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.ceil((target.getTime() - from.getTime()) / msPerDay)
}

export async function checkAndSendCardDueReminders(date: Date = new Date()) {
    await connectDB()

    const cards = await Card.find({ isActive: true })

    let checked = 0
    let remindersSent = 0

    for (const card of cards) {
        checked++

        const { dueDate } = computeCardCycle(card, date)

        // A stale remindersForDueDate (from a prior cycle) means the due date
        // has rolled over since the last check — reset all three flags so
        // this new cycle's reminders can fire again.
        if (!card.remindersForDueDate || card.remindersForDueDate.getTime() !== dueDate.getTime()) {
            card.remindersForDueDate = dueDate
            card.reminder5SentAt = null
            card.reminder2SentAt = null
            card.reminder0SentAt = null
        }

        const daysLeft = daysUntil(dueDate, date)
        let threshold: 0 | 2 | 5 | null = null
        if (daysLeft <= 0 && !card.reminder0SentAt) threshold = 0
        else if (daysLeft <= 2 && !card.reminder2SentAt) threshold = 2
        else if (daysLeft <= 5 && !card.reminder5SentAt) threshold = 5

        if (threshold !== null) {
            const user = await User.findById(card.userId)
            if (user) {
                const { success } = await sendEmail({
                    to: user.email,
                    subject: `Payment due soon: ${card.name}`,
                    html: `<p>Hello ${user.name},</p><p>Your payment for <strong>${card.name}</strong> is due on ${dueDate.toLocaleDateString()}.</p>`,
                })
                // Only stamp on a confirmed send — sendEmail swallows its own
                // errors and resolves {success:false}, same as budgetAlerts.
                if (success) {
                    if (threshold === 0) card.reminder0SentAt = new Date()
                    else if (threshold === 2) card.reminder2SentAt = new Date()
                    else card.reminder5SentAt = new Date()
                    remindersSent++
                }
            }
        }

        await card.save()
    }

    return { checked, remindersSent }
}
