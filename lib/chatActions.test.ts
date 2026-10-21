import { describe, it, expect } from 'vitest'
import { executeChatAction } from './chatActions'

describe('executeChatAction', () => {
  it('returns a failure result for an unknown action type', async () => {
    const result = await executeChatAction({ type: 'fly_to_the_moon' as any, data: {} }, 'user123')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/unknown/i)
  })

  it('returns a failure result when data fails schema validation', async () => {
    const result = await executeChatAction({ type: 'add_transaction', data: { title: 'Lunch' } } as any, 'user123')
    expect(result.success).toBe(false)
  })
})
