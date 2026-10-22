import { describe, it, expect, vi } from 'vitest'
import { Types } from 'mongoose'
import connectDB from './mongodb'
import Transaction from '@/models/Transaction'
import { generateAndSendMonthlyReport } from './reports'

// sendEmail hits the real Resend API when RESEND_API_KEY is set (it is, in
// .env.local) — mock it so this test asserts on the generated HTML without
// making a real network call, same pattern as lib/cardAlerts.test.ts.
vi.mock('./email', () => ({
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

describe('generateAndSendMonthlyReport', () => {
    it('no longer renders the "Spending by Category" table (replaced by the chart alone)', async () => {
        await connectDB()
        const { sendEmail } = await import('./email')
        const userId = new Types.ObjectId()
        const user = { _id: userId, name: 'Test User', email: 'test@example.com' }
        await Transaction.create({ userId, title: 'Groceries', amount: 500, type: 'expense', category: 'Food', date: new Date() })

        await generateAndSendMonthlyReport(user)

        const html = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0].html
        expect(html).not.toContain('Spending by Category')
        expect(html).toContain('Expense Distribution')
    })

    it('omits the chart section entirely when there is no expense data for the period', async () => {
        await connectDB()
        const { sendEmail } = await import('./email')
        const userId = new Types.ObjectId()
        const user = { _id: userId, name: 'No Spend User', email: 'nospend@example.com' }

        await generateAndSendMonthlyReport(user)

        const html = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0].html
        expect(html).not.toContain('Expense Distribution')
        expect(html).not.toContain('Spending by Category')
    })
})
