import { describe, it, expect, vi } from 'vitest'
import { Types } from 'mongoose'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { signAccessToken } from '@/lib/auth'
import { INTENTS } from '@/lib/ai/intents'

vi.mock('@/lib/ai', () => ({
    chat: vi.fn(),
}))

function makeRequest(body: unknown, token: string) {
    return new NextRequest('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/ai/chat', () => {
    it('returns 400 with a clear message when the AI provider fails before streaming starts', async () => {
        const { chat } = await import('@/lib/ai')
        ;(chat as any).mockImplementation(async function* () {
            throw new Error('GROQ_API_KEY environment variable is not set. Add it to your .env.local file.')
        })

        const { POST } = await import('./route')
        const userId = new Types.ObjectId().toString()
        const token = signAccessToken(userId, 'user')

        const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }, token), {})

        expect(res.status).toBe(400)
        const resBody = await res.json()
        expect(resBody.error).toMatch(/groq api key/i)
    })

    it('streams text chunks and a final done event for a plain reply', async () => {
        const { chat } = await import('@/lib/ai')
        ;(chat as any).mockImplementation(async function* () {
            yield { type: 'text', text: 'Hello' }
            yield { type: 'text', text: ' world' }
            yield { type: 'done' }
        })

        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }, token), {})

        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toContain('data: {"delta":"Hello"}')
        expect(text).toContain('data: {"delta":" world"}')
        expect(text).toContain('data: {"done":true}')
    })

    it('emits a done+action event for a valid tool call', async () => {
        const { chat } = await import('@/lib/ai')
        ;(chat as any).mockImplementation(async function* () {
            yield {
                type: 'tool_call',
                id: 'call_1',
                name: 'add_transaction',
                arguments: JSON.stringify({ title: 'Lunch', amount: 450, type: 'expense', category: 'Food', date: '2026-10-21' }),
            }
            yield { type: 'done' }
        })

        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'add lunch' }] }, token), {})

        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toContain('"action":{"type":"add_transaction"')
        // The tool call ends the stream immediately — the generator's own
        // trailing {type:'done'} chunk must never be reached/enqueued.
        expect(text.match(/data: /g)).toHaveLength(1)
    })

    it('acts on only the first of multiple tool calls and logs the dropped ones instead of hiding them', async () => {
        const { chat } = await import('@/lib/ai')
        ;(chat as any).mockImplementation(async function* () {
            yield {
                type: 'tool_call',
                id: 'call_1',
                name: 'add_transaction',
                arguments: JSON.stringify({ title: 'Lunch', amount: 450, type: 'expense', category: 'Food', date: '2026-10-21' }),
            }
            yield {
                type: 'tool_call',
                id: 'call_2',
                name: 'add_transaction',
                arguments: JSON.stringify({ title: 'Coffee', amount: 120, type: 'expense', category: 'Food', date: '2026-10-21' }),
            }
            yield { type: 'done' }
        })
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const { POST } = await import('./route')
        const token = signAccessToken(new Types.ObjectId().toString(), 'user')
        const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'add lunch and coffee' }] }, token), {})
        const text = await res.text()

        expect(text).toContain('"title":"Lunch"')
        expect(text).not.toContain('Coffee')
        expect(text.match(/data: /g)).toHaveLength(1)
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('dropped'),
            expect.objectContaining({ name: 'add_transaction' })
        )

        errorSpy.mockRestore()
    })

    it('executes a read-only tool call immediately, feeds the result back, and continues streaming text', async () => {
        const { chat } = await import('@/lib/ai')
        let callCount = 0
        ;(chat as any).mockImplementation(async function* () {
            callCount++
            if (callCount === 1) {
                yield { type: 'tool_call', id: 'call_1', name: 'get_card_summary', arguments: JSON.stringify({ cardName: 'Test Card' }) }
            } else {
                yield { type: 'text', text: 'Your card has ₹1000 outstanding.' }
                yield { type: 'done' }
            }
        })

        // get_card_summary itself doesn't exist until Task 8 — this test only
        // proves the loop's shape (execute a read-only tool, feed the result
        // back, call chat() again), so a throwaway read-only stub stands in
        // for it and is removed once the test is done.
        const stubIntent = {
            name: 'get_card_summary',
            description: 'test stub',
            mutates: false,
            schema: z.object({ cardName: z.string() }),
            parameters: {},
            handler: async () => { throw new Error('Card not found: Test Card') },
        }
        INTENTS.push(stubIntent as any)

        try {
            const { POST } = await import('./route')
            const token = signAccessToken(new Types.ObjectId().toString(), 'user')
            const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'how much do I owe on Test Card?' }] }, token), {})

            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toContain('Your card has')
            expect(callCount).toBe(2)
        } finally {
            INTENTS.splice(INTENTS.indexOf(stubIntent as any), 1)
        }
    })
})
