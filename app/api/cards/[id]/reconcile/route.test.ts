import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'
import Transaction from '@/models/Transaction'
import { signAccessToken } from '@/lib/auth'

function postRequest(url: string, body: unknown, token: string) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/cards/[id]/reconcile', () => {
    it('computes a positive difference when the bank figure is higher than the app\'s', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Reconcile Test', last4: '4242', creditLimit: 10000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 })
        await Transaction.create({ userId, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

        const { POST } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = postRequest(`http://localhost/api/cards/${card._id}/reconcile`, { bankOutstanding: 1200 }, token)
        const res = await POST(req, { params: { id: card._id.toString() } })
        const body = await res.json()

        expect(body.computedOutstanding).toBe(1000)
        expect(body.difference).toBe(200)
    })

    it('rejects a missing bankOutstanding', async () => {
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = postRequest('http://localhost/api/cards/x/reconcile', {}, token)
        const res = await POST(req, { params: { id: new Types.ObjectId().toString() } })
        expect(res.status).toBe(422)
    })
})
