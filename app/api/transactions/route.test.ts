import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import { signAccessToken } from '@/lib/auth'

function postRequest(body: unknown, token: string) {
    return new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/transactions — payment method', () => {
    it('accepts paymentMethod:"card" with a cardId', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = postRequest({ title: 'Dinner', amount: 1200, type: 'expense', category: 'Food', date: '2026-10-21', paymentMethod: 'card', cardId: new Types.ObjectId().toString() }, token)
        const res = await POST(req, {})
        expect(res.status).toBe(201)
    })

    it('rejects paymentMethod:"card" with no cardId', async () => {
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = postRequest({ title: 'Dinner', amount: 1200, type: 'expense', category: 'Food', date: '2026-10-21', paymentMethod: 'card' }, token)
        const res = await POST(req, {})
        expect(res.status).toBe(422)
    })

    it('still accepts a request with neither field, defaulting to cash', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = postRequest({ title: 'Lunch', amount: 300, type: 'expense', category: 'Food', date: '2026-10-21' }, token)
        const res = await POST(req, {})
        const body = await res.json()
        expect(res.status).toBe(201)
        expect(body.transaction.paymentMethod).toBe('cash')
    })

    it('drops a stray cardId when paymentMethod is not "card" (inconsistent client state)', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = postRequest({ title: 'Lunch', amount: 300, type: 'expense', category: 'Food', date: '2026-10-21', paymentMethod: 'cash', cardId: new Types.ObjectId().toString() }, token)
        const res = await POST(req, {})
        const body = await res.json()
        expect(res.status).toBe(201)
        expect(body.transaction.cardId).toBeFalsy()
    })
})
