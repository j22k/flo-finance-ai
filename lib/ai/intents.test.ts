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

  it('validates add_card with a 4-digit last4', () => {
    const result = parseIntent('add_card', JSON.stringify({
      name: 'HDFC Millennia', last4: '4242', creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
    }))
    expect(result.ok).toBe(true)
  })

  it('rejects add_card with a non-4-digit last4', () => {
    const result = parseIntent('add_card', JSON.stringify({
      name: 'Bad', last4: '424', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15,
    }))
    expect(result.ok).toBe(false)
  })

  it('validates record_card_payment by cardName, resolved at handler time not schema time', () => {
    const result = parseIntent('record_card_payment', JSON.stringify({ cardName: 'HDFC Millennia', amount: 2000 }))
    expect(result.ok).toBe(true)
  })
})

describe('toAITools', () => {
  it('builds OpenAI-shaped tool definitions without leaking internal fields', () => {
    const tools = toAITools(INTENTS)
    expect(tools).toHaveLength(6)
    for (const t of tools) {
      expect(t.type).toBe('function')
      expect(t.function).not.toHaveProperty('mutates')
      expect(t.function).not.toHaveProperty('schema')
      expect(t.function).not.toHaveProperty('handler')
    }
  })
})
