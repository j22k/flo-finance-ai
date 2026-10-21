import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { buildFinancialContext } from './financialContext'

describe('buildFinancialContext — card payment exclusion', () => {
    it('excludes card_payment transactions from this month\'s expenses and category totals', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const today = new Date()
        await Transaction.create([
            { userId, title: 'Groceries', amount: 2000, type: 'expense', category: 'Food', date: today },
            { userId, title: 'Payment to HDFC Millennia', amount: 9000, type: 'card_payment', category: 'Card Payment', date: today },
        ])

        const context = await buildFinancialContext(userId.toString(), 'Test User')

        expect(context.thisMonth.expenses).toBe(2000)
        expect(context.topCategories.find(c => c.category === 'Card Payment')).toBeUndefined()
    })
})
