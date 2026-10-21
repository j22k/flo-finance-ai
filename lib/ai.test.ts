import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('groq-sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: vi.fn() } },
    })),
  }
})

describe('chat()', () => {
  // lib/ai.ts caches its Groq client at module scope (by design — avoids
  // reconstructing the client on every call). Resetting modules between
  // tests gives each one a fresh, uncached client to attach its own mock to.
  beforeEach(() => {
    vi.resetModules()
  })

  it('yields text chunks for plain content deltas', async () => {
    const Groq = (await import('groq-sdk')).default as any
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] }
      yield { choices: [{ delta: { content: ' world' } }] }
    })()
    Groq.mockImplementation(function () {
      return { chat: { completions: { create: vi.fn().mockResolvedValue(mockStream) } } }
    })

    const { chat } = await import('./ai')
    const chunks = []
    for await (const c of chat([{ role: 'user', content: 'hi' }], [])) chunks.push(c)

    expect(chunks).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done' },
    ])
  })

  it('accumulates tool_call argument deltas across chunks into one complete JSON string', async () => {
    const Groq = (await import('groq-sdk')).default as any
    const mockStream = (async function* () {
      yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'add_transaction', arguments: '{"amount":' } }] } }] }
      yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '450}' } }] } }] }
    })()
    Groq.mockImplementation(function () {
      return { chat: { completions: { create: vi.fn().mockResolvedValue(mockStream) } } }
    })

    const { chat } = await import('./ai')
    const chunks = []
    for await (const c of chat([{ role: 'user', content: 'add a 450 expense' }], [])) chunks.push(c)

    expect(chunks).toEqual([
      { type: 'tool_call', id: 'call_1', name: 'add_transaction', arguments: '{"amount":450}' },
      { type: 'done' },
    ])
  })
})
