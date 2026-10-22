import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { Types } from 'mongoose'
import connectDB from './mongodb'
import Card from '@/models/Card'
import User from '@/models/User'
import Transaction from '@/models/Transaction'
import { checkAndSendCardDueReminders } from './cardAlerts'

// sendEmail hits the real Resend API when RESEND_API_KEY is set (it is, in
// .env.local) — without mocking it, a test that actually crosses a reminder
// threshold makes a real network call, which is slow enough to time out
// under a full-suite run and sends real email to a fake address either way.
vi.mock('./email', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// checkAndSendCardDueReminders scans every active card with no userId
// scoping (it's a cron job, not a per-user route) — without cleanup, a card
// left over from an earlier test gets re-evaluated by a later test's run
// and can trip its own dedup logic against a new reference time, corrupting
// that test's remindersSent count. Cleanup is scoped to each test's own
// created users (and anything linked to them) rather than the whole shared
// MongoMemoryServer, so a parallel test file's data is never at risk.
let testUserIds: Types.ObjectId[] = []

function trackUser(userId: Types.ObjectId) {
    testUserIds.push(userId)
}

describe('checkAndSendCardDueReminders', () => {
    beforeEach(() => {
        testUserIds = []
    })

    afterEach(async () => {
        await connectDB()
        await User.deleteMany({ _id: { $in: testUserIds } })
        await Card.deleteMany({ userId: { $in: testUserIds } })
        await Transaction.deleteMany({ userId: { $in: testUserIds } })
    })

    it('sends the 5-day reminder exactly once for a given due date', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const today = new Date()
        // dueDate = today + 5 days: statementDate = today, dueDaysAfterStatement = 5
        const statementDay = today.getDate()
        const card = await Card.create({ userId: user._id, name: 'Due Soon', last4: '4242', creditLimit: 10000, apr: 36, statementDay, dueDaysAfterStatement: 5 })
        await Transaction.create({ userId: user._id, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        const first = await checkAndSendCardDueReminders(today)
        expect(first.remindersSent).toBe(1)

        const reloaded = await Card.findById(card._id)
        expect(reloaded!.reminder5SentAt).not.toBeNull()

        // Running it again the same day must not re-send.
        const second = await checkAndSendCardDueReminders(today)
        expect(second.remindersSent).toBe(0)
    })

    it('does not re-send across different times on the same calendar day (cron can fire at any time)', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const earlyRun = new Date()
        earlyRun.setHours(0, 0, 1, 0)
        const lateRun = new Date(earlyRun)
        lateRun.setHours(23, 59, 59, 0)

        const card = await Card.create({ userId: user._id, name: 'Due Soon', last4: '4242', creditLimit: 10000, apr: 36, statementDay: earlyRun.getDate(), dueDaysAfterStatement: 5 })
        await Transaction.create({ userId: user._id, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        const first = await checkAndSendCardDueReminders(earlyRun)
        expect(first.remindersSent).toBe(1)

        // Same calendar day, nearly 24 hours later — must still be deduped.
        const second = await checkAndSendCardDueReminders(lateRun)
        expect(second.remindersSent).toBe(0)
    })

    it('does not send a due-soon reminder for a due date more than a day in the past', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const today = new Date()
        // dueDaysAfterStatement is required to be >=1, and statementDay is
        // clamped to a real calendar day, so a due date 10 days in the past
        // is reached with a statement day far enough back in the cycle.
        const statementDay = today.getDate()
        const card = await Card.create({ userId: user._id, name: 'Long Overdue', last4: '5555', creditLimit: 10000, apr: 36, statementDay, dueDaysAfterStatement: 1 })
        await Transaction.create({ userId: user._id, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        // Advance the cron's reference date 10 days past the due date
        // (statementDate=today, dueDate=today+1) without changing the card.
        const tenDaysAfterDue = new Date(today)
        tenDaysAfterDue.setDate(tenDaysAfterDue.getDate() + 11)

        const result = await checkAndSendCardDueReminders(tenDaysAfterDue)
        expect(result.remindersSent).toBe(0)
    })

    it('does not send reminders when nothing is owed on the card', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const today = new Date()
        const card = await Card.create({ userId: user._id, name: 'Paid Off', last4: '6666', creditLimit: 10000, apr: 36, statementDay: today.getDate(), dueDaysAfterStatement: 5 })
        // No transactions at all — outstanding is 0.

        const result = await checkAndSendCardDueReminders(today)
        expect(result.remindersSent).toBe(0)
    })

    it('does not send reminders for a soft-deleted card', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const today = new Date()
        const card = await Card.create({ userId: user._id, name: 'Gone', last4: '9999', creditLimit: 1000, apr: 10, statementDay: today.getDate(), dueDaysAfterStatement: 5, isActive: false })

        const result = await checkAndSendCardDueReminders(today)
        expect(result.remindersSent).toBe(0)
    })

    it('escapes HTML in names and includes the amount owed in the reminder email', async () => {
        await connectDB()
        const { sendEmail } = await import('./email')
        const user = await User.create({ name: 'O\'Brien & <Admin>', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
        const today = new Date()
        const card = await Card.create({ userId: user._id, name: '<script>Card</script>', last4: '7777', creditLimit: 10000, apr: 36, statementDay: today.getDate(), dueDaysAfterStatement: 5 })
        await Transaction.create({ userId: user._id, title: 'Spend', amount: 1500, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        await checkAndSendCardDueReminders(today)

        const call = (sendEmail as any).mock.calls.find((c: any) => c[0].to === user.email)
        expect(call).toBeDefined()
        const html = call[0].html as string
        expect(html).not.toContain('<script>Card</script>')
        expect(html).toContain('&lt;script&gt;Card&lt;/script&gt;')
        expect(html).toContain('O&#39;Brien &amp; &lt;Admin&gt;')
        expect(html).toContain('1,500')
    })

    it('keeps checking other cards when one card errors out', async () => {
        await connectDB()
        const brokenUser = await User.create({ name: 'Broken', email: `broken${Date.now()}@example.com`, password: 'password123' })
        trackUser(brokenUser._id)
        const okUser = await User.create({ name: 'OK', email: `ok${Date.now()}@example.com`, password: 'password123' })
        trackUser(okUser._id)
        const today = new Date()
        const brokenCard = await Card.create({ userId: brokenUser._id, name: 'Broken Card', last4: '1111', creditLimit: 10000, apr: 36, statementDay: today.getDate(), dueDaysAfterStatement: 5 })
        await Transaction.create({ userId: brokenUser._id, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: brokenCard._id })
        const okCard = await Card.create({ userId: okUser._id, name: 'OK Card', last4: '2222', creditLimit: 10000, apr: 36, statementDay: today.getDate(), dueDaysAfterStatement: 5 })
        await Transaction.create({ userId: okUser._id, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: okCard._id })

        const realFindById = User.findById.bind(User)
        const spy = vi.spyOn(User, 'findById').mockImplementation((id: any) => {
            if (id.toString() === brokenUser._id.toString()) throw new Error('simulated lookup failure')
            return realFindById(id)
        })

        try {
            const result = await checkAndSendCardDueReminders(today)
            // The broken card's failure must not prevent the OK card's
            // reminder from being checked and sent.
            expect(result.remindersSent).toBe(1)
            const reloadedOk = await Card.findById(okCard._id)
            expect(reloadedOk!.reminder5SentAt).not.toBeNull()
        } finally {
            spy.mockRestore()
        }
    })

    it('resets all three reminder flags once the due date rolls to a new cycle', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        trackUser(user._id)
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
