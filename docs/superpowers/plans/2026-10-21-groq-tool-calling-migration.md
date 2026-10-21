# Groq Migration + Native Tool Calling (Phase 1 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gemini with Groq as Flo's AI provider and replace the `[ACTION:{...}]` text-tag convention with native tool calling, migrating the 4 existing AI actions, without changing any user-visible behavior or breaking the existing confirm-before-mutate UX.

**Architecture:** A provider-agnostic `lib/ai.ts` wraps Groq's OpenAI-compatible streaming chat-completions API and yields a normalized chunk stream (`text` | `tool_call` | `done`) so the route layer never touches Groq-specific shapes. A new declarative registry, `lib/ai/intents.ts`, pairs each intent's Zod schema, JSON-schema tool definition, `mutates` flag, and DB handler in one place; `lib/chatActions.ts` becomes a thin dispatcher over that registry, preserving its exact external signature so the quick-action route and confirm-card UI need no changes. `app/api/ai/chat/route.ts` is rewritten to consume `lib/ai.ts` + the registry but emits the *same* SSE wire shape (`{delta}`, `{done, action}`) the frontend already parses, plus one new optional `{error}` field.

**Tech Stack:** Next.js 14 App Router, Groq SDK (`groq-sdk`, OpenAI-compatible), Zod, Vitest (new — first test infra in this repo), `vite-tsconfig-paths`.

**Spec:** `docs/superpowers/specs/2026-10-21-cards-income-groq-intent.md` (see its "Addendum" section for corrections made against the real codebase during this plan's research — in particular, `lib/ai/intents.ts` does **not** already exist, contrary to the spec's §8 table).

## Global Constraints

- All inputs validated with Zod on every API route (spec §4.4).
- Ownership checks via the existing `findOwned()` and `withAuth()` (spec §4.5) — not touched by this phase, no new ownership-scoped routes yet.
- Mutating AI actions need user confirmation (spec §4.7) — already implemented by `ActionConfirmCard.tsx`; this phase must preserve it, not rebuild it.
- No LangChain / LangGraph (spec §2).
- No change to auth (spec §3).
- Do not touch the uncommitted `lib/reports.ts` edit unless asked (spec §3).
- Backwards compatible — no existing behavior may change for the end user (spec §4.1, generalized to this phase: the chat UI, confirm cards, and quick-action endpoint must work identically from the frontend's perspective).
- Commit per phase; do not push until the phase is checked (spec §9).

## Review Focus

- **Model emits a tool call whose `arguments` string is malformed/truncated JSON** (e.g. network hiccup mid-stream, or the model just gets it wrong) — a reasonable person expects a visible error, not a silently dropped action or a 500. Covered by Task 3 (`parseIntent` JSON-parse-failure test) and Task 6 (`{error}` SSE field).
- **Model calls a tool name that isn't in our registry** (hallucinated/misremembered name) — same expectation as above. Covered by Task 3 (`parseIntent` unknown-intent test) and Task 6.
- **`GROQ_API_KEY` missing or invalid** — today's Gemini path returns a clear 400 with a specific message instead of a raw 500; that UX must survive the swap, generalized to Groq. Covered by Task 6.
- **Stream drops before a tool call is flushed** (connection interrupted mid-accumulation) — today's code already wraps stream consumption in try/catch but it's worth confirming the frontend's `isLoading` state doesn't hang forever when that happens. Covered by Task 6 (ensures `{done:true}` is always emitted on the stream's error path too).
- **A rename of action-type strings breaks the confirm-card UI silently** — `create_transaction`/`create_budget`/`update_budget` become `add_transaction`/`set_budget`; if `ActionConfirmCard.tsx`'s switch statement isn't updated in the same commit as `types/chat.ts`, cards would render the `default: 'Quick Action'` fallback label instead of a correct one. Covered by Task 5.

---

## Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts` (loads `.env.local` so tests can see `MONGODB_URI` etc. in later phases; empty-but-present now so later phases don't need to revisit config)
- Modify: `package.json` (add `vitest`, `vite-tsconfig-paths` devDependencies; add `"test": "vitest run"` script)
- Test: `lib/smoke.test.ts` (deleted at the end of this task once Task 3 provides a real test)

**Interfaces:**
- Produces: a `npm test` command every later task in this plan (and every future phase's plan) uses as its verification step.

- [ ] **Step 1: Install dependencies**

Run: `npm install -D vitest vite-tsconfig-paths`
Expected: `package.json` devDependencies gain both packages; exits 0.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
```

- [ ] **Step 4: Add the `test` script to `package.json`**

`"test": "vitest run"` alongside the existing `dev`/`build`/`start`/`lint` scripts.

- [ ] **Step 5: Write a throwaway smoke test — `lib/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`, exit 0.

- [ ] **Step 7: Delete the smoke test and commit**

```bash
git rm lib/smoke.test.ts
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: add Vitest test runner"
```

---

## Task 2: `lib/ai.ts` — Groq provider wrapper

**Files:**
- Create: `lib/ai.ts`
- Test: `lib/ai.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_call_id?: string
    name?: string
  }
  export interface AITool {
    type: 'function'
    function: { name: string; description: string; parameters: object }
  }
  export type AIStreamChunk =
    | { type: 'text'; text: string }
    | { type: 'tool_call'; id: string; name: string; arguments: string }
    | { type: 'done' }
  export async function* chat(messages: AIMessage[], tools: AITool[]): AsyncGenerator<AIStreamChunk>
  ```
  `arguments` on a `tool_call` chunk is the **fully accumulated** JSON string for that call (not a delta) — `chat()` buffers deltas internally and only yields each tool call once, after the underlying stream ends. Task 6 consumes this directly with `JSON.parse`/`parseIntent`, never accumulating deltas itself.

- [ ] **Step 1: Write the failing test for text-only streaming**

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('groq-sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: vi.fn() } },
    })),
  }
})

describe('chat()', () => {
  it('yields text chunks for plain content deltas', async () => {
    const Groq = (await import('groq-sdk')).default as any
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] }
      yield { choices: [{ delta: { content: ' world' } }] }
    })()
    Groq.mockImplementation(() => ({
      chat: { completions: { create: vi.fn().mockResolvedValue(mockStream) } },
    }))

    const { chat } = await import('./ai')
    const chunks = []
    for await (const c of chat([{ role: 'user', content: 'hi' }], [])) chunks.push(c)

    expect(chunks).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done' },
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/ai.test.ts`
Expected: FAIL — `Cannot find module './ai'` (file doesn't exist yet).

- [ ] **Step 3: Implement `lib/ai.ts`**

```ts
import Groq from 'groq-sdk'

let client: Groq | null = null
function getClient(): Groq {
    if (!client) {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is not set. Add it to your .env.local file.')
        }
        client = new Groq({ apiKey })
    }
    return client
}
```
Then `chat(messages, tools)` as an async generator:
- Call `getClient().chat.completions.create({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages, tools: tools.length ? tools : undefined, tool_choice: tools.length ? 'auto' : undefined, stream: true })`.
- Iterate the returned stream. For each chunk's `choices[0].delta`:
  - If `delta.content` is present, `yield { type: 'text', text: delta.content }`.
  - If `delta.tool_calls` is present, for each entry (keyed by its `index`), accumulate into a `Map<number, {id, name, args}>`: set `id`/`name` the first time they appear, and concatenate `function.arguments` onto `args` every time (Groq streams `arguments` as successive string fragments, same as OpenAI's format — this is the one piece of real logic in this task, everything else is pass-through).
- After the loop ends, flush: for each buffered entry, `yield { type: 'tool_call', id, name, arguments: args }`, then `yield { type: 'done' }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/ai.test.ts`
Expected: PASS (1/1).

- [ ] **Step 5: Add a second test for tool-call delta accumulation across multiple chunks**

```ts
it('accumulates tool_call argument deltas across chunks into one complete JSON string', async () => {
  const Groq = (await import('groq-sdk')).default as any
  const mockStream = (async function* () {
    yield { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'add_transaction', arguments: '{"amount":' } }] } }] }
    yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '450}' } }] } }] }
  })()
  Groq.mockImplementation(() => ({
    chat: { completions: { create: vi.fn().mockResolvedValue(mockStream) } },
  }))

  const { chat } = await import('./ai')
  const chunks = []
  for await (const c of chat([{ role: 'user', content: 'add a 450 expense' }], [])) chunks.push(c)

  expect(chunks).toEqual([
    { type: 'tool_call', id: 'call_1', name: 'add_transaction', arguments: '{"amount":450}' },
    { type: 'done' },
  ])
})
```

- [ ] **Step 6: Run both tests**

Run: `npm test -- lib/ai.test.ts`
Expected: PASS (2/2).

- [ ] **Step 7: Commit**

```bash
git add lib/ai.ts lib/ai.test.ts
git commit -m "feat: add Groq provider wrapper with normalized streaming chunks"
```

---

## Task 3: `lib/ai/intents.ts` — intent registry, Zod validation, `parseIntent`

**Files:**
- Create: `lib/ai/intents.ts`
- Test: `lib/ai/intents.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure logic + Mongoose models directly).
- Produces:
  ```ts
  export interface Intent<TArgs = any> {
    name: string
    description: string
    mutates: boolean
    schema: z.ZodType<TArgs>
    parameters: object // JSON Schema for the tool-calling `function.parameters` field
    handler: (args: TArgs, userId: string) => Promise<ActionResult>
  }
  export const INTENTS: Intent[]
  export function toAITools(intents: Intent[]): AITool[]
  export function parseIntent(name: string, rawArguments: string):
    | { ok: true; intent: Intent; args: unknown }
    | { ok: false; error: string }
  ```
  `ActionResult` is the existing type from `types/chat.ts`. `AITool` is from `lib/ai.ts` (Task 2).
  Four intents in `INTENTS` for this phase, each a straight port of the matching case in the current `executeChatAction` (see `lib/chatActions.ts` as it stands before Task 4 touches it):
  - `add_transaction` (mutates: true) — schema `{title: string, amount: number (positive), type: 'income'|'expense', category: string, date: string, note?: string}`; handler creates a `Transaction`.
  - `update_transaction` (mutates: true) — schema adds `_id: string` to the same shape, all fields except `_id` optional; handler does `Transaction.findOneAndUpdate({_id, userId}, {$set: data})`.
  - `delete_transaction` (mutates: true) — schema `{_id: string}`; handler does `Transaction.findOneAndDelete({_id, userId})`.
  - `set_budget` (mutates: true) — schema `{category: string, limitAmount: number (positive), month: number, year: number}`; handler upserts via `Budget.findOneAndUpdate({userId, category, month, year}, {$set: {limitAmount}}, {new: true, upsert: true})` — this merges the old `create_budget`/`update_budget` cases, which the current code already treats identically.

- [ ] **Step 1: Write the failing tests for `parseIntent`**

```ts
import { describe, it, expect } from 'vitest'
import { parseIntent } from './intents'

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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: FAIL — module `./intents` not found.

- [ ] **Step 3: Implement `lib/ai/intents.ts`**

Implement the four intents and `parseIntent` per the Interfaces block above. `parseIntent`'s body: look up `INTENTS.find(i => i.name === name)` → if not found, `{ok: false, error: 'Unknown intent: ' + name}`; otherwise `JSON.parse(rawArguments)` inside a try/catch → on parse failure, `{ok: false, error: 'Malformed tool arguments'}`; otherwise `intent.schema.safeParse(parsed)` → on failure, `{ok: false, error: result.error.message}`; on success, `{ok: true, intent, args: result.data}`.

`toAITools` maps each intent to `{type: 'function', function: {name: intent.name, description: intent.description, parameters: intent.parameters}}` — note `mutates`, `schema`, and `handler` are never sent to Groq, only `parameters` (the hand-written JSON Schema) is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Write a test for `toAITools`**

```ts
import { INTENTS, toAITools } from './intents'

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
```

- [ ] **Step 6: Run it**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: PASS (5/5).

- [ ] **Step 7: Commit**

```bash
git add lib/ai/intents.ts lib/ai/intents.test.ts
git commit -m "feat: add intent registry with Zod-validated tool calling for the 4 existing AI actions"
```

---

## Task 4: `lib/chatActions.ts` — dispatch via the intent registry

**Files:**
- Modify: `lib/chatActions.ts`
- Test: `lib/chatActions.test.ts`

**Interfaces:**
- Consumes: `INTENTS` from `lib/ai/intents.ts` (Task 3) — **not** `parseIntent`: that function takes a raw JSON *string* fresh off the model's tool-call stream (Task 6's use case), whereas `executeChatAction` is called later, from `/api/ai/quick-action`, with `action.data` already a parsed object (the SSE payload was structured JSON, not a string). Both entry points validate against the same `intent.schema`, just at different stages of deserialization.
- Produces: `executeChatAction(action: ChatAction, userId: string): Promise<ActionResult>` — **signature and external behavior unchanged** from before this task, so `app/api/ai/quick-action/route.ts` requires zero changes.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

Note: both cases fail validation *before* any handler runs, so neither test touches MongoDB — no DB setup needed for this task. The happy path (an intent's handler actually writing to the DB) is exercised by the manual 10-prompt parity check in Task 9, and gets real automated DB-backed coverage starting in Phase 2 once `mongodb-memory-server` is introduced for card-outstanding-calculation tests.

- [ ] **Step 2: Run to verify current failure mode**

Run: `npm test -- lib/chatActions.test.ts`
Expected: FAIL — current `executeChatAction` throws `'Unknown action type'` as a generic `Error` caught by its own try/catch and returned as `{success: false, error: e.message}`; the *unknown action type* test may already pass by coincidence, but the *schema validation* test fails because the current implementation has no validation at all and would call `Transaction.create({title: 'Lunch'})` directly (throwing a Mongoose validation error with a different message shape, or hitting a real DB attempt if `MONGODB_URI` isn't reachable in the test environment).

- [ ] **Step 3: Rewrite `executeChatAction`**

```ts
import { ChatAction, ActionResult } from '@/types/chat'
import { INTENTS } from './ai/intents'

export async function executeChatAction(action: ChatAction, userId: string): Promise<ActionResult> {
    const intent = INTENTS.find((i) => i.name === action.type)
    if (!intent) {
        return { success: false, error: `Unknown action type: ${action.type}` }
    }

    const validation = intent.schema.safeParse(action.data)
    if (!validation.success) {
        return { success: false, error: validation.error.message }
    }

    try {
        return await intent.handler(validation.data, userId)
    } catch (e: any) {
        console.error('Execute action error:', e)
        return { success: false, error: e.message }
    }
}
```
Delete the old `switch` statement and the now-unused `Transaction`/`Budget`/`connectDB` imports from this file (the handlers that need them now live in `lib/ai/intents.ts`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/chatActions.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add lib/chatActions.ts lib/chatActions.test.ts
git commit -m "refactor: dispatch chat actions through the intent registry"
```

---

## Task 5: Rename action-type literals end to end

**Files:**
- Modify: `types/chat.ts`
- Modify: `components/chat/ActionConfirmCard.tsx`

**Interfaces:**
- Consumes: the 4 intent names from `lib/ai/intents.ts` (Task 3): `add_transaction`, `update_transaction`, `delete_transaction`, `set_budget`.
- Produces: `ChatAction['type']` as the exact same 4-member union, renamed.

- [ ] **Step 1: Update `types/chat.ts`**

Change `ChatAction.type` from
`'create_transaction' | 'update_transaction' | 'delete_transaction' | 'create_budget' | 'update_budget'`
to
`'add_transaction' | 'update_transaction' | 'delete_transaction' | 'set_budget'`.

- [ ] **Step 2: Update `components/chat/ActionConfirmCard.tsx`'s `getActionLabel()`**

```ts
const getActionLabel = () => {
    switch (action.type) {
        case 'add_transaction': return 'Add Transaction'
        case 'update_transaction': return 'Update Transaction'
        case 'delete_transaction': return 'Delete Transaction'
        case 'set_budget': return 'Update Budget'
        default: return 'Quick Action'
    }
}
```

- [ ] **Step 3: Run the full type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (this is a pure rename across two files with no other references to the old literals anywhere in the codebase — confirmed by the addendum's grep of the AI route and `lib/gemini.ts` as the only other Gemini-specific files; no DB documents persist these literals, so no migration is needed).

- [ ] **Step 4: Commit**

```bash
git add types/chat.ts components/chat/ActionConfirmCard.tsx
git commit -m "refactor: rename AI action types to match the new intent names"
```

---

## Task 6: Rewrite `app/api/ai/chat/route.ts`

**Files:**
- Modify: `app/api/ai/chat/route.ts`

**Interfaces:**
- Consumes: `chat()` + `AIMessage` from `lib/ai.ts` (Task 2); `INTENTS`, `toAITools`, `parseIntent` from `lib/ai/intents.ts` (Task 3).
- Produces: the same SSE wire contract `hooks/useChat.ts` already parses — `data: {delta: string}` events while text streams, then one final `data: {done: true, action?: ChatAction, error?: string}` event — so no change is required here for Task 7 to consume beyond the one new optional field.

- [ ] **Step 1: Replace the Gemini-specific imports and role mapping**

Remove `import { streamChat, parseActionFromResponse } from '@/lib/gemini'`. Add `import { chat, AIMessage } from '@/lib/ai'` and `import { INTENTS, toAITools, parseIntent } from '@/lib/ai/intents'`. The system prompt string stays exactly as-is (same financial context, same instructions) **except** the paragraph describing the `[ACTION:...]` tag convention is deleted — tool calling replaces it entirely, so the model is never told about that tag again. Build the message array as:
```ts
const aiMessages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: any) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
]
```
(the `model` → `assistant` fallback only matters if any already-stored chat history from before this migration still uses the old Gemini role name; harmless either way.)

- [ ] **Step 2: Replace the streaming loop**

```ts
const encoder = new TextEncoder()
const readable = new ReadableStream({
    async start(controller) {
        try {
            for await (const chunk of chat(aiMessages, toAITools(INTENTS))) {
                if (chunk.type === 'text') {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.text })}\n\n`))
                } else if (chunk.type === 'tool_call') {
                    const parsed = parseIntent(chunk.name, chunk.arguments)
                    if (parsed.ok) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, action: { type: chunk.name, data: parsed.args } })}\n\n`))
                    } else {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: parsed.error })}\n\n`))
                    }
                    return
                }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        } catch (e) {
            console.error('Streaming error:', e)
            // Always flush a done event, even on failure, so the frontend's
            // isLoading state doesn't hang forever on a dropped stream.
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: 'Stream interrupted' })}\n\n`))
        } finally {
            controller.close()
        }
    }
})
```

- [ ] **Step 3: Update the error-message heuristic in the outer catch block**

Change the string check from `'Gemini API key'` wording to a Groq-equivalent message: `'AI Provider Error: Your Groq API key appears to be invalid or expired. Please check your .env.local file.'` — keep the same `error.message.includes('API key') || ... .includes('400')` detection logic, since that's provider-agnostic already.

- [ ] **Step 4: Manual verification — plain text reply (no tool call)**

Run the dev server, send a message that shouldn't trigger an action (e.g. "How am I doing this month?") through the chat widget.
Expected: streamed text renders normally, no `ActionConfirmCard` appears (matches today's behavior for non-action replies).

- [ ] **Step 5: Manual verification — mutating action**

Send a message that should create a transaction (e.g. "Add a ₹450 lunch expense today").
Expected: an `ActionConfirmCard` appears labeled "Add Transaction"; clicking Confirm creates the transaction (check `/transactions`); clicking Cancel does nothing.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/chat/route.ts
git commit -m "feat: migrate chat route from Gemini streaming + regex action tag to Groq native tool calling"
```

---

## Task 7: `hooks/useChat.ts` — surface tool-call errors

**Files:**
- Modify: `hooks/useChat.ts`

**Interfaces:**
- Consumes: the optional `error` field on the final SSE event from Task 6.

- [ ] **Step 1: Handle `data.error` in the SSE parsing loop**

In the `while (true)` loop that already checks `data.delta`, `data.thinking`, and `data.done`, add:
```ts
if (data.error) {
    toast.error(data.error)
}
```
alongside the existing `if (data.done) { finalAction = data.action }` — both can be true on the same final event (an error means `action` will be `undefined`, so `botMsg.action` stays unset and no confirm card renders, which is correct).

- [ ] **Step 2: Manual verification**

Temporarily rename an intent's Zod field (e.g. require `amount` to be a string) to force a validation failure, send a message that would trigger it, confirm a toast error appears instead of a silently missing action. Revert the temporary change afterward.

- [ ] **Step 3: Commit**

```bash
git add hooks/useChat.ts
git commit -m "fix: surface AI tool-call validation errors as a toast instead of silently dropping them"
```

---

## Task 8: Swap dependencies, delete `lib/gemini.ts`

**Files:**
- Modify: `package.json` (remove `@google/generative-ai`, `@anthropic-ai/sdk`; add `groq-sdk`)
- Delete: `lib/gemini.ts`
- Modify: `.env.local` (your own local file — add a `GROQ_API_KEY=` placeholder line and `GROQ_MODEL=llama-3.3-70b-versatile`; remove or comment out `FLO_GEMINI_API_KEY`/`GEMINI_MODEL`)

**Interfaces:**
- Consumes: nothing new.
- Produces: confirms no remaining import of `lib/gemini.ts` anywhere.

- [ ] **Step 1: Confirm nothing else imports `lib/gemini.ts`**

Run: `grep -rn "from '@/lib/gemini'" --include=*.ts --include=*.tsx .` (excluding `node_modules`)
Expected: no matches (Task 6 already removed the only import site).

- [ ] **Step 2: Remove and install dependencies**

Run: `npm uninstall @google/generative-ai @anthropic-ai/sdk && npm install groq-sdk`

- [ ] **Step 3: Delete `lib/gemini.ts`**

- [ ] **Step 4: Update `.env.local`**

You'll need to add your own real `GROQ_API_KEY` value — get one from console.groq.com. I'll add the placeholder line and the model default; fill in the actual key yourself (I won't invent or ask you to paste a real key into chat).

- [ ] **Step 5: Run the full type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass cleanly (run `npm run build` only once your local dev server isn't also running against the same `.next` folder — they conflict, as seen in this session already).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git rm lib/gemini.ts
git commit -m "chore: remove Gemini/Anthropic SDKs, add groq-sdk"
```
(`.env.local` is gitignored — nothing to commit there.)

---

## Task 9: Phase 1 acceptance check

**Files:** none (manual verification only).

- [ ] **Step 1: Run the same 10 test prompts against both providers**

Before deleting `lib/gemini.ts` in Task 8, or on a branch/stash where it's still present, record Gemini's behavior for 10 representative prompts covering all 4 intents plus at least 2 plain-Q&A prompts (e.g. drawn from `lib/financialContext.ts`'s data: "How am I doing this month?", "Show my recent spending", "Add a ₹450 lunch expense today", "Delete my last transaction", "Set my Food budget to ₹8000 this month", "Why am I over budget on Food?"). After Task 8, re-run the same 10 prompts against Groq and confirm each produces an equivalent action (same intent, same key field values) or an equivalent plain-text answer — per spec §9, this *is* the Phase 1 "done" criterion, not a Vitest test.

- [ ] **Step 2: Run the full automated suite one more time**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 3: Confirm this phase is ready to push per spec §9 ("commit per phase, do not push until each phase is checked")**

Review the 8 commits from Tasks 1–8 with `git log --oneline` against `main`'s pre-phase-1 tip; confirm each is small and self-explanatory. Do not `git push` yet — wait for your explicit go-ahead, same as every other push in this project.
