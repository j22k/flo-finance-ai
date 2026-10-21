import { describe, it, expect } from 'vitest'
import { parseIntent, INTENTS, toAITools } from './intents'

describe('parseIntent', () => {
  it('validates and returns args for a known intent with valid data', () => {
    const result = parseIntent('add_transaction', JSON.stringify({
      title: 'Lunch', amount: 450, type: 'expense', category: 'Food', date: '2026-10-21',
    }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.intent.name).toBe('add_transaction')
      expect(result.args).toMatchObject({ title: 'Lunch', amount: 450 })
    }
  })

  it('rejects an unknown intent name', () => {
    const result = parseIntent('fly_to_the_moon', '{}')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Unknown intent') })
  })

  it('rejects malformed JSON arguments', () => {
    const result = parseIntent('add_transaction', '{"title": "Lunch", "amount":') // truncated
    expect(result.ok).toBe(false)
  })

  it('rejects valid JSON that fails the intent\'s schema', () => {
    const result = parseIntent('add_transaction', JSON.stringify({ title: 'Lunch' })) // missing amount/type/category/date
    expect(result.ok).toBe(false)
  })
})

describe('toAITools', () => {
  it('builds OpenAI-shaped tool definitions without leaking internal fields', () => {
    const tools = toAITools(INTENTS)
    expect(tools).toHaveLength(4)
    for (const t of tools) {
      expect(t.type).toBe('function')
      expect(t.function).not.toHaveProperty('mutates')
      expect(t.function).not.toHaveProperty('schema')
      expect(t.function).not.toHaveProperty('handler')
    }
  })
})
