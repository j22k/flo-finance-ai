import { describe, it, expect, afterEach } from 'vitest'
import connectDB from './mongodb'
import Card from '@/models/Card'
import User from '@/models/User'
import { checkAndSendCardDueReminders } from './cardAlerts'

describe('checkAndSendCardDueReminders', () => {
    // checkAndSendCardDueReminders scans every active card with no userId
    // scoping (it's a cron job, not a per-user route) — without cleanup, a
    // card left over from an earlier test gets re-evaluated by a later
    // test's run and can trip its own dedup logic against a new reference
    // time, corrupting that test's remindersSent count.
    afterEach(async () => {
        await connectDB()
        await Card.deleteMany({})
        await User.deleteMany({})
    })

    it('sends the 5-day reminder exactly once for a given due date', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const today = new Date()
        // dueDate = today + 5 days: statementDate = today, dueDaysAfterStatement = 5
        const statementDay = today.getDate()
        const card = await Card.create({ userId: user._id, name: 'Due Soon', last4: '4242', creditLimit: 10000, apr: 36, statementDay, dueDaysAfterStatement: 5 })

        const first = await checkAndSendCardDueReminders(today)
        expect(first.remindersSent).toBe(1)

        const reloaded = await Card.findById(card._id)
        expect(reloaded!.reminder5SentAt).not.toBeNull()

        // Running it again the same day must not re-send.
        const second = await checkAndSendCardDueReminders(today)
        expect(second.remindersSent).toBe(0)
    })

    it('does not send reminders for a soft-deleted card', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const today = new Date()
        const card = await Card.create({ userId: user._id, name: 'Gone', last4: '9999', creditLimit: 1000, apr: 10, statementDay: today.getDate(), dueDaysAfterStatement: 5, isActive: false })

        const result = await checkAndSendCardDueReminders(today)
        expect(result.remindersSent).toBe(0)
    })

    it('resets all three reminder flags once the due date rolls to a new cycle', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const card = await Card.create({
            userId: user._id, name: 'Rolled Over', last4: '1234', creditLimit: 1000, apr: 10,
            statementDay: 1, dueDaysAfterStatement: 20,
            remindersForDueDate: new Date(2020, 0, 1), reminder5SentAt: new Date(2020, 0, 1), reminder2SentAt: new Date(2020, 0, 1), reminder0SentAt: new Date(2020, 0, 1),
        })
        await checkAndSendCardDueReminders(new Date())
        const reloaded = await Card.findById(card._id)
        expect(reloaded!.remindersForDueDate).not.toEqual(new Date(2020, 0, 1))
    })
})
