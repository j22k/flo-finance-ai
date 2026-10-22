import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'
import Transaction from '@/models/Transaction'
import { signAccessToken } from '@/lib/auth'

function getRequest(url: string, token: string) {
    return new NextRequest(url, { headers: { Authorization: `Bearer ${token}` } })
}

function postRequest(url: string, body: unknown, token: string) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('GET /api/cards/[id]/summary', () => {
    it('computes outstanding as spends minus payments, excluding other cards and other users', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Test Card', last4: '4242', creditLimit: 10000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 })
        const otherCard = await Card.create({ userId, name: 'Other Card', last4: '9999', creditLimit: 5000, apr: 20, statementDay: 1, dueDaysAfterStatement: 15 })

        await Transaction.create([
            { userId, title: 'Spend 1', amount: 3000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id },
            { userId, title: 'Spend 2', amount: 2000, type: 'expense', category: 'Food', date: new Date(), cardId: card._id },
            { userId, title: 'Payment', amount: 1000, type: 'card_payment', category: 'Card Payment', date: new Date(), cardId: card._id },
            { userId, title: 'Other card spend', amount: 500, type: 'expense', category: 'Food', date: new Date(), cardId: otherCard._id },
        ])

        const { GET } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = getRequest(`http://localhost/api/cards/${card._id}/summary`, token)
        const res = await GET(req, { params: { id: card._id.toString() } })
        const body = await res.json()

        expect(body.outstanding).toBe(4000) // 3000 + 2000 - 1000
        expect(body.availableLimit).toBe(6000) // 10000 - 4000
        expect(body.usagePercent).toBe(40)
    })

    it('includes cycle dates and a daily interest estimate alongside the existing balance fields', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Interest Test', last4: '4242', creditLimit: 10000, apr: 36.5, statementDay: new Date().getDate(), dueDaysAfterStatement: 20 })
        await Transaction.create({ userId, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        const { GET } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = getRequest(`http://localhost/api/cards/${card._id}/summary`, token)
        const res = await GET(req, { params: { id: card._id.toString() } })
        const body = await res.json()

        expect(body.outstanding).toBe(1000)
        expect(body.dueDate).toBeDefined()
        expect(body.cycleStart).toBeDefined()
        // 1000 * 0.365 / 365 = 1 rupee/day — an exact, easy-to-check APR.
        expect(body.dailyInterestEstimate).toBeCloseTo(1, 2)
    })
})

describe('POST /api/cards/[id]/payments', () => {
    it('creates a card_payment transaction that the real analytics/categories route excludes', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Test Card', last4: '4242', creditLimit: 10000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 })
        const token = signAccessToken(userId.toString(), 'user')

        // payments/ is a sibling of summary/ under [id]/, not nested inside it —
        // this test file lives at app/api/cards/[id]/summary/route.test.ts.
        const { POST: recordPayment } = await import('../payments/route')
        const payReq = postRequest(`http://localhost/api/cards/${card._id}/payments`, { amount: 2000, date: new Date().toISOString() }, token)
        const payRes = await recordPayment(payReq, { params: { id: card._id.toString() } })
        expect(payRes.status).toBe(201)

        const { GET: categoriesGet } = await import('@/app/api/analytics/categories/route')
        const now = new Date()
        const catReq = getRequest(`http://localhost/api/analytics/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, token)
        const catRes = await categoriesGet(catReq, {})
        const catBody = await catRes.json()

        expect(catBody.categories.find((c: any) => c.category === 'Card Payment')).toBeUndefined()
    })
})
