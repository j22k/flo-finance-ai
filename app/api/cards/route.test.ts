import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'
import { signAccessToken } from '@/lib/auth'

// withAuth (which every route here goes through, since GET/POST/etc. are the
// wrapped exports, not the inner handlers) requires a real, verifiable Bearer
// token and builds its own userId from it — it ignores any context a caller
// passes directly. Same pattern Phase 1's app/api/ai/chat/route.test.ts uses.
function makeRequest(body: unknown, token: string, url = 'http://localhost/api/cards') {
    return new NextRequest(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
}

describe('POST /api/cards', () => {
    it('creates a card for the authenticated user', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = makeRequest({ name: 'HDFC Millennia', last4: '4242', creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 }, token)
        const res = await POST(req, {})
        const body = await res.json()
        expect(body.card.last4).toBe('4242')
    })

    it('rejects a last4 that is not 4 digits', async () => {
        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = makeRequest({ name: 'Bad Card', last4: '123', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15 }, token)
        const res = await POST(req, {})
        expect(res.status).toBe(422)
    })
})

describe('GET /api/cards/[id]', () => {
    it('returns 404 for a card belonging to a different user', async () => {
        await connectDB()
        const card = await Card.create({ userId: new Types.ObjectId(), name: 'Someone Else\'s', last4: '1111', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15 })
        const { GET } = await import('./[id]/route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const req = makeRequest(undefined, token, `http://localhost/api/cards/${card._id}`)
        const res = await GET(req, { params: { id: card._id.toString() } })
        expect(res.status).toBe(404)
    })
})
