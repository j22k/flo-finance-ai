import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { signAccessToken } from '@/lib/auth'

function putRequest(body: unknown, token: string, url: string) {
    return new NextRequest(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('PUT /api/transactions/[id] — card_payment immutability', () => {
    it('rejects changing a card_payment row\'s type away from card_payment', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const cardId = new Types.ObjectId()
        const payment = await Transaction.create({
            userId, cardId, title: 'Payment to Test Card', amount: 9000,
            type: 'card_payment', category: 'Card Payment', date: new Date(),
        })

        const { PUT } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = putRequest({ type: 'expense' }, token, `http://localhost/api/transactions/${payment._id}`)
        const res = await PUT(req, { params: { id: payment._id.toString() } })

        expect(res.status).toBe(400)

        const reloaded = await Transaction.findById(payment._id)
        expect(reloaded!.type).toBe('card_payment')
        expect(reloaded!.amount).toBe(9000)
    })

    it('still allows editing unrelated fields (note) on a card_payment row', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const cardId = new Types.ObjectId()
        const payment = await Transaction.create({
            userId, cardId, title: 'Payment to Test Card', amount: 9000,
            type: 'card_payment', category: 'Card Payment', date: new Date(),
        })

        const { PUT } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = putRequest({ note: 'paid via UPI' }, token, `http://localhost/api/transactions/${payment._id}`)
        const res = await PUT(req, { params: { id: payment._id.toString() } })

        expect(res.status).toBe(200)
        const reloaded = await Transaction.findById(payment._id)
        expect(reloaded!.note).toBe('paid via UPI')
        expect(reloaded!.type).toBe('card_payment')
    })
})

describe('PUT /api/transactions/[id] — cardId clears when paymentMethod leaves card', () => {
    it('clears cardId when paymentMethod changes from card to cash', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const cardId = new Types.ObjectId()
        const tx = await Transaction.create({
            userId, title: 'Dinner', amount: 1200, type: 'expense', category: 'Food',
            date: new Date(), paymentMethod: 'card', cardId,
        })

        const { PUT } = await import('./route')
        const token = signAccessToken(userId.toString(), 'user')
        const req = putRequest({ paymentMethod: 'cash' }, token, `http://localhost/api/transactions/${tx._id}`)
        const res = await PUT(req, { params: { id: tx._id.toString() } })

        expect(res.status).toBe(200)
        const reloaded = await Transaction.findById(tx._id)
        expect(reloaded!.paymentMethod).toBe('cash')
        expect(reloaded!.cardId).toBeNull()
    })
})
