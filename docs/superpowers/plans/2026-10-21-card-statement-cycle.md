# Statement Cycle, Due Reminders, Interest & Reconcile (Phase 3 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add statement-cycle awareness to cards (F5), due-date email reminders (F6), an interest estimate (F7), and manual reconciliation against a bank-stated balance (F8) — and, in doing so, introduce the first **read-only** AI intents, which requires extending the chat route with a tool-result feedback loop that Phase 1 deliberately deferred until this moment.

**Architecture:** A single pure function, `lib/cardCycle.ts`, computes `{cycleStart, cycleEnd, statementDate, dueDate}` from a card's `statementDay`/`dueDaysAfterStatement` and a reference date — the one piece of non-trivial date math this phase needs, shared by the summary endpoint, the due-reminder cron check, and the two new AI intents. `app/api/cards/[id]/summary/route.ts` (already designed in Phase 2 "to grow, not be rebuilt") gains cycle/due/interest fields in the same response shape. Due reminders follow `lib/budgetAlerts.ts`'s dedup pattern (timestamp fields that gate re-sending), adapted for a card's recurring cycles rather than a budget's one-document-per-month: three `reminder{5,2,0}SentAt` fields on `Card`, reset whenever the computed due date rolls to a new one. Both new reminder and reconcile logic run from the existing `/api/cron/daily` route (Vercel Hobby's 2-cron ceiling, already at capacity) and existing manual trigger respectively. The two new AI intents (`get_card_summary`, `reconcile_card_statement`) are the first `mutates: false` entries in the registry; `app/api/ai/chat/route.ts` gains a small bounded loop (max 3 round-trips) that executes a read-only tool server-side immediately, feeds the result back to Groq as a `tool`-role message, and continues streaming — exactly the mechanism Phase 1's addendum named as the trigger for this work.

**Tech Stack:** Same as Phases 1-2. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-cards-income-groq-intent.md` — F5-F8, the `/api/cards/[id]/summary` route's full intended shape (cycle/due date/interest estimate, already named in spec §7 but only partially built in Phase 2), risk table row "Statement day edge cases (29 to 31) | Clamp to month end".

## Global Constraints

- Interest figures are estimates — label them as such everywhere they're shown (hard rule 6).
- All inputs validated with Zod on every API route (hard rule 4).
- Ownership via `findOwned`/`withAuth` (hard rule 5).
- Reuse the existing `/api/cron/daily` route — Vercel Hobby allows only 2 crons total, already both in use (spec §2, §9).
- No LangChain/LangGraph; no auth changes; don't touch the pre-existing uncommitted `lib/reports.ts` edit.
- Statement-day edge cases (29-31) clamp to month end — the exact pattern already proven in `lib/recurringGenerator.ts`'s `advance()` for recurring transactions; reuse that, don't reinvent it.
- Commit per task; do not push until this phase is checked.

## Review Focus

- **A statement day of 29, 30, or 31 in a month that doesn't have that many days** — a reasonable person expects the cycle/due date math to clamp sensibly (as `lib/recurringGenerator.ts` already does for recurring transactions), not crash or silently produce a wrong month. Covered by Task 1's cycle-math tests.
- **A due-reminder email fires more than once for the same due date**, or fires for a soft-deleted (`isActive:false`) card — matches the exact dedup bug class `lib/budgetAlerts.ts` already had to solve once; this phase must solve it again correctly for a *recurring* entity (a card has many cycles, a budget has one per document). Covered by Task 3's tests.
- **The tool-result feedback loop never terminates**, or a malformed/failing tool result crashes the whole chat response instead of degrading to a plain error. A reasonable person expects a slow or broken card lookup to produce a clear message, not a hung request. Covered by Task 7's loop-bound and error-path tests.
- **`get_card_summary`/`reconcile_card_statement` leak another user's card data** by resolving a card name without scoping to the caller's own `userId` and `isActive:true` — the exact mistake Phase 2's final review already caught once in `record_card_payment`; this phase introduces 2 more call sites that need the same discipline. Covered by Task 6 extracting the shared resolver and testing it directly.
- **Reconcile's "difference" sign is backwards or confusing** (bank says you owe more/less than the app thinks) — a reasonable person expects a clearly-signed, clearly-labeled number, not an ambiguous delta. Covered by Task 5's tests asserting the exact sign convention.

---

## Task 1: `lib/cardCycle.ts` — pure statement-cycle date math

**Files:**
- Create: `lib/cardCycle.ts`
- Test: `lib/cardCycle.test.ts`

**Interfaces:**
- Consumes: nothing from earlier phases — pure date logic, no DB, no Mongoose.
- Produces:
  ```ts
  export interface CardCycle {
      cycleStart: Date   // the cycle currently accruing spend
      cycleEnd: Date     // = next statementDate; spends before this still belong to the open cycle
      statementDate: Date // the most recent completed statement (cycleStart's predecessor's end)
      dueDate: Date      // statementDate + dueDaysAfterStatement, day-clamped like a calendar date (not "N days" arithmetic that could land on an invalid date — dueDaysAfterStatement is added as whole days via date-fns addDays, which never produces an invalid date, so no clamping is actually needed there; clamping only applies to statementDay itself)
  }
  export function computeCardCycle(
      card: { statementDay: number; dueDaysAfterStatement: number },
      referenceDate: Date
  ): CardCycle
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeCardCycle } from './cardCycle'

describe('computeCardCycle', () => {
    it('computes the due date as statementDate + dueDaysAfterStatement when today is after this month\'s statement day', () => {
        // statementDay 5, today the 10th -> this month's statement (the 5th) just happened;
        // the open cycle runs from the 5th to next month's 5th; due date is the 5th + 20 days.
        const result = computeCardCycle({ statementDay: 5, dueDaysAfterStatement: 20 }, new Date(2026, 9, 10)) // Oct 10
        expect(result.statementDate).toEqual(new Date(2026, 9, 5))
        expect(result.cycleStart).toEqual(new Date(2026, 9, 5))
        expect(result.cycleEnd).toEqual(new Date(2026, 10, 5))
        expect(result.dueDate).toEqual(new Date(2026, 9, 25))
    })

    it('uses last month\'s statement day when today is before this month\'s statement day', () => {
        // statementDay 20, today the 10th -> this month's statement (the 20th) hasn't happened yet;
        // the open cycle started last month's 20th.
        const result = computeCardCycle({ statementDay: 20, dueDaysAfterStatement: 15 }, new Date(2026, 9, 10)) // Oct 10
        expect(result.statementDate).toEqual(new Date(2026, 8, 20)) // Sep 20
        expect(result.cycleStart).toEqual(new Date(2026, 8, 20))
        expect(result.cycleEnd).toEqual(new Date(2026, 9, 20))
        expect(result.dueDate).toEqual(new Date(2026, 9, 5)) // Sep 20 + 15 days = Oct 5
    })

    it('clamps a statementDay of 31 to the last day of a shorter month', () => {
        // statementDay 31, reference date in February (28 days in 2026, not a leap year).
        const result = computeCardCycle({ statementDay: 31, dueDaysAfterStatement: 10 }, new Date(2026, 1, 15)) // Feb 15 2026
        expect(result.statementDate).toEqual(new Date(2026, 0, 31)) // Jan 31 (today Feb 15 is before Feb's clamped statement day)
        expect(result.cycleEnd).toEqual(new Date(2026, 1, 28)) // Feb has 28 days in 2026
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/cardCycle.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/cardCycle.ts`**

Use `date-fns`'s `getDaysInMonth`/`setDate`/`addMonths`/`addDays` — the exact same clamping idiom already proven in `lib/recurringGenerator.ts`'s `advance()` (`setDate(next, Math.min(anchorDay, getDaysInMonth(next)))`). Algorithm:
1. Compute `thisMonthStatementDate` = `referenceDate`'s year/month, day clamped to `min(statementDay, daysInThisMonth)`.
2. If `referenceDate >= thisMonthStatementDate`: `statementDate = thisMonthStatementDate`, `cycleStart = statementDate`, `cycleEnd` = next month's clamped statement day.
3. Else: `statementDate` = last month's clamped statement day, `cycleStart = statementDate`, `cycleEnd = thisMonthStatementDate`.
4. `dueDate = addDays(statementDate, dueDaysAfterStatement)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/cardCycle.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/cardCycle.ts lib/cardCycle.test.ts
git commit -m "feat: add pure statement-cycle date math (F5 foundation)"
```

---

## Task 2: `Card` model — reminder-dedup fields

**Files:**
- Modify: `models/Card.ts`
- Test: `models/Card.test.ts`

**Interfaces:**
- Produces: `ICard` gains `remindersForDueDate?: Date | null`, `reminder5SentAt?: Date | null`, `reminder2SentAt?: Date | null`, `reminder0SentAt?: Date | null` — all optional, defaulting to `null`, so existing `Card` documents from Phase 2 load unchanged (hard rule 1).

- [ ] **Step 1: Write the failing test**

```ts
it('loads a pre-existing Phase-2-shaped card with no reminder fields at all', async () => {
    await connectDB()
    const { insertedId } = await mongoose.connection.db!.collection('cards').insertOne({
        userId: new Types.ObjectId(), name: 'Old Card', last4: '4242',
        creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
    })
    const card = await Card.findById(insertedId)
    expect(card).not.toBeNull()
    expect(card!.reminder5SentAt ?? null).toBeNull()
})
```
(Add this to the existing `models/Card.test.ts`, alongside its current two tests; add the `mongoose` import it needs, mirroring `models/Transaction.test.ts`'s backward-compat test exactly.)

- [ ] **Step 2: Run to verify it already passes (then add the real schema fields in Step 3 so the test is meaningful going forward, not just trivially true because the fields don't exist yet)**

Run: `npm test -- models/Card.test.ts`
Expected: PASS even before Step 3 — this is a backward-compat guard, not a feature test; it must stay green both before and after the schema change.

- [ ] **Step 3: Add the fields to `models/Card.ts`**

```ts
remindersForDueDate: { type: Date, default: null },
reminder5SentAt: { type: Date, default: null },
reminder2SentAt: { type: Date, default: null },
reminder0SentAt: { type: Date, default: null },
```

- [ ] **Step 4: Run tests to verify still green**

Run: `npm test -- models/Card.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add models/Card.ts models/Card.test.ts
git commit -m "feat: add due-reminder dedup fields to Card"
```

---

## Task 3: `lib/cardAlerts.ts` — due-date reminder emails

**Files:**
- Create: `lib/cardAlerts.ts`
- Test: `lib/cardAlerts.test.ts`

**Interfaces:**
- Consumes: `computeCardCycle` (Task 1), `Card`'s reminder fields (Task 2), `sendEmail` (existing, `lib/email.ts`).
- Produces: `checkAndSendCardDueReminders(date?: Date): Promise<{checked: number, remindersSent: number}>` — same return shape convention as `lib/budgetAlerts.ts`'s `checkAndSendBudgetAlerts`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('checkAndSendCardDueReminders', () => {
    it('sends the 5-day reminder exactly once for a given due date', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const today = new Date()
        // dueDate = today + 5 days: statementDate = today, dueDaysAfterStatement = 5
        const statementDay = today.getDate()
        const card = await Card.create({ userId: user._id, name: 'Due Soon', last4: '4242', creditLimit: 10000, apr: 36, statementDay, dueDaysAfterStatement: 5 })

        const first = await checkAndSendCardDueReminders(today)
        expect(first.remindersSent).toBe(1)

        const reloaded = await Card.findById(card._id)
        expect(reloaded!.reminder5SentAt).not.toBeNull()

        // Running it again the same day must not re-send.
        const second = await checkAndSendCardDueReminders(today)
        expect(second.remindersSent).toBe(0)
    })

    it('does not send reminders for a soft-deleted card', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const today = new Date()
        const card = await Card.create({ userId: user._id, name: 'Gone', last4: '9999', creditLimit: 1000, apr: 10, statementDay: today.getDate(), dueDaysAfterStatement: 5, isActive: false })

        const result = await checkAndSendCardDueReminders(today)
        expect(result.remindersSent).toBe(0)
    })

    it('resets all three reminder flags once the due date rolls to a new cycle', async () => {
        await connectDB()
        const user = await User.create({ name: 'Test', email: `t${Date.now()}@example.com`, password: 'password123' })
        const card = await Card.create({
            userId: user._id, name: 'Rolled Over', last4: '1234', creditLimit: 1000, apr: 10,
            statementDay: 1, dueDaysAfterStatement: 20,
            remindersForDueDate: new Date(2020, 0, 1), reminder5SentAt: new Date(2020, 0, 1), reminder2SentAt: new Date(2020, 0, 1), reminder0SentAt: new Date(2020, 0, 1),
        })
        await checkAndSendCardDueReminders(new Date())
        const reloaded = await Card.findById(card._id)
        expect(reloaded!.remindersForDueDate).not.toEqual(new Date(2020, 0, 1))
    })
})
```
Note: `User.create` needs a real password since the model hashes it on save — any string of 8+ characters works; these tests don't log in, just need a valid owning user to satisfy the `ref`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/cardAlerts.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/cardAlerts.ts`**

Mirror `lib/budgetAlerts.ts`'s shape: `Card.find({isActive: true})`, for each card compute `const {dueDate} = computeCardCycle(card, date)`. If `card.remindersForDueDate` doesn't match this `dueDate` (compare via `.getTime()`), reset all three `reminderXSentAt` to `null` and set `remindersForDueDate = dueDate` before checking thresholds. Then, in descending threshold order (0, then 2, then 5 — so a long-overdue check sends the most urgent applicable one, not all three in one run): if `daysUntil(dueDate) <= 0 && !reminder0SentAt`, send and stamp; else if `<= 2 && !reminder2SentAt`, send and stamp; else if `<= 5 && !reminder5SentAt`, send and stamp. Use `sendEmail` directly (same lightweight inline-HTML style `lib/budgetAlerts.ts` uses for its own alerts, not the heavier `lib/reports.ts` template). Look up the owning `User` for the email address the same way `lib/budgetAlerts.ts` does.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/cardAlerts.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Wire into `app/api/cron/daily/route.ts`**

Add `checkAndSendCardDueReminders(now)` as a third branch in the existing `Promise.allSettled` array, with the same rejected-branch `console.error` logging Task 6 of Phase 1 added for the other two. No `vercel.json` change needed — this reuses the existing `/api/cron/daily` entry.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/cardAlerts.ts lib/cardAlerts.test.ts app/api/cron/daily/route.ts
git commit -m "feat: add card due-date reminder emails to the daily cron"
```

---

## Task 4: Extend `/api/cards/[id]/summary` with cycle, due date, and interest estimate

**Files:**
- Modify: `app/api/cards/[id]/summary/route.ts`
- Modify: `app/api/cards/[id]/summary/route.test.ts`

**Interfaces:**
- Consumes: `computeCardCycle` (Task 1).
- Produces: the existing `{outstanding, availableLimit, usagePercent}` response grows to also include `{cycleStart, cycleEnd, statementDate, dueDate, dailyInterestEstimate}` — additive only, so nothing that already reads this endpoint (Task 7's `CardTile`, the `record_card_payment`/`add_card` intents, which don't call summary at all) breaks.

- [ ] **Step 1: Write the failing test**

```ts
it('includes cycle dates and a daily interest estimate alongside the existing balance fields', async () => {
    await connectDB()
    const userId = new Types.ObjectId()
    const card = await Card.create({ userId, name: 'Interest Test', last4: '4242', creditLimit: 10000, apr: 36.5, statementDay: new Date().getDate(), dueDaysAfterStatement: 20 })
    await Transaction.create({ userId, title: 'Spend', amount: 1000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id })

    const { GET } = await import('./route')
    const token = signAccessToken(userId.toString(), 'user')
    const req = getRequest(`http://localhost/api/cards/${card._id}/summary`, token)
    const res = await GET(req, { params: { id: card._id.toString() } })
    const body = await res.json()

    expect(body.outstanding).toBe(1000)
    expect(body.dueDate).toBeDefined()
    expect(body.cycleStart).toBeDefined()
    // 1000 * 0.365 / 365 = 1 rupee/day — an exact, easy-to-check APR.
    expect(body.dailyInterestEstimate).toBeCloseTo(1, 2)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- "app/api/cards/[id]/summary"`
Expected: FAIL — the new fields are `undefined`.

- [ ] **Step 3: Extend the route**

After computing `outstanding`, add: `const cycle = computeCardCycle(card, new Date())` and `const dailyInterestEstimate = Math.max(0, outstanding) * (card.apr / 100) / 365` (interest is never negative even if `outstanding` is, from an overpayment credit balance — Phase 2's `CardTile` already established that a negative outstanding is a valid credit-balance state, and charging "negative interest" makes no sense). Spread `cycle`'s four dates plus `dailyInterestEstimate` into the JSON response.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- "app/api/cards/[id]/summary"`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green — this is purely additive to the response shape, so Phase 2's own summary test (which only asserts the three original fields) must still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add "app/api/cards/[id]/summary"
git commit -m "feat: add statement cycle and interest estimate to the card summary endpoint"
```

---

## Task 5: `/api/cards/[id]/reconcile` — manual reconciliation (F8)

**Files:**
- Create: `app/api/cards/[id]/reconcile/route.ts`
- Test: `app/api/cards/[id]/reconcile/route.test.ts`

**Interfaces:**
- Consumes: the same outstanding-calculation logic as the summary route (duplicated inline, matching Phase 2's "no shared helper, one handler per route" precedent for a two-line aggregation — not worth extracting for one additional call site).
- Produces: `POST /api/cards/[id]/reconcile` with body `{bankOutstanding: number}` → `{computedOutstanding, bankOutstanding, difference}` where `difference = bankOutstanding - computedOutstanding` (positive means the bank says you owe *more* than the app thinks; negative means the app is overestimating). No persistence — spec describes this as a point-in-time check, not a stored record.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `npm test -- "app/api/cards/[id]/reconcile"`
Expected: FAIL (module not found) → implement: `findOwned<ICard>`, Zod `{bankOutstanding: z.number()}`, the same `Transaction.aggregate` outstanding calc as `summary/route.ts` (spends minus payments for this card), return the three fields.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm test -- "app/api/cards/[id]/reconcile"`
Expected: PASS (2/2).

- [ ] **Step 4: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add "app/api/cards/[id]/reconcile"
git commit -m "feat: add manual card reconciliation endpoint (F8)"
```

---

## Task 6: Shared card-name resolver for AI intents

**Files:**
- Modify: `lib/ai/intents.ts`
- Modify: `lib/ai/intents.test.ts`

**Interfaces:**
- Consumes: `Card` (existing).
- Produces: `findActiveCardByName(userId: string, cardName: string): Promise<{ok: true; card: ICard} | {ok: false; error: string}>` — extracted from `record_card_payment`'s existing inline logic so Tasks 8's two new intents can reuse it instead of copying the isActive+ambiguous-match handling a second and third time. This is a deliberate, narrow exception to Phase 1/2's "no shared helper, one handler per intent" precedent: that precedent held because each intent's logic was genuinely intent-specific, but this exact lookup (case-insensitive name match, scoped to the caller's own active cards, erroring clearly on zero or multiple matches) would otherwise be duplicated verbatim three times, which is exactly the kind of drift risk DRY exists to prevent.

- [ ] **Step 1: Write the failing test**

```ts
describe('findActiveCardByName', () => {
    it('returns the card when exactly one active match exists', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        await Card.create({ userId, name: 'Unique Card', last4: '1111', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15 })
        const result = await findActiveCardByName(userId.toString(), 'unique card')
        expect(result.ok).toBe(true)
    })

    it('returns an error for zero matches', async () => {
        const result = await findActiveCardByName(new Types.ObjectId().toString(), 'Nonexistent')
        expect(result.ok).toBe(false)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: FAIL — `findActiveCardByName` isn't exported yet.

- [ ] **Step 3: Extract the helper and rewire `record_card_payment` to use it**

Move the `Card.find({userId, isActive: true, name: ...})` + zero/ambiguous-match logic from `record_card_payment`'s handler into the new exported function; have `record_card_payment` call it and keep its existing behavior identical (its own existing tests from Phase 2 must stay green unchanged).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: PASS, including the Phase 2 `record_card_payment` tests still passing.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/intents.ts lib/ai/intents.test.ts
git commit -m "refactor: extract shared active-card-by-name resolver for AI intents"
```

---

## Task 7: Tool-result feedback loop in the chat route

**Files:**
- Modify: `lib/ai.ts`
- Modify: `app/api/ai/chat/route.ts`
- Test: `app/api/ai/chat/route.test.ts`

**Interfaces:**
- Consumes: `Intent.mutates` (existing, `lib/ai/intents.ts`).
- Produces: `AIMessage` gains an optional `tool_calls?: Array<{id: string; type: 'function'; function: {name: string; arguments: string}}>` field (for relaying the model's own tool-call message back into history, the standard OpenAI/Groq-compatible shape — confirmed against `groq-sdk`'s `ChatCompletionAssistantMessageParam` type during planning). The chat route, on receiving a `tool_call` chunk whose resolved intent has `mutates: false`, now executes it server-side immediately, appends the assistant tool-call message + a `tool`-role result message to history, and calls `chat()` again — bounded to 3 total model calls per request to guarantee termination. A `mutates: true` tool call's behavior is completely unchanged (still ends the stream with a confirm-card action, exactly as every existing test for it already proves).

- [ ] **Step 1: Write the failing test**

```ts
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

    const { POST } = await import('./route')
    const token = signAccessToken(new Types.ObjectId().toString(), 'user')
    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'how much do I owe on Test Card?' }] }, token), {})

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Your card has')
    expect(callCount).toBe(2)
})
```
This test's `get_card_summary` lookup will fail to find a real card (none exists for this random userId) — that's fine and expected for this test; it only verifies the loop *shape* (one tool call -> one continuation call with the result threaded back), not the intent's own correctness, which Task 8 tests separately. If the handler throws "card not found", the loop should feed that error message back as the tool result (not crash), and the mocked second call still demonstrates the continuation happened.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/ai/chat/route.test.ts`
Expected: FAIL — `callCount` never reaches 2, because the route doesn't yet distinguish `mutates` and ends the stream on any tool call.

- [ ] **Step 3: Extend `lib/ai.ts`'s `AIMessage`**

Add the `tool_calls?: Array<{id: string; type: 'function'; function: {name: string; arguments: string}}>` field to the interface. No change to `chat()`'s body — it already passes `messages` straight through to the SDK call.

- [ ] **Step 4: Rewrite the chat route's tool-call branch**

Replace the current "any tool_call ends the stream" logic with: look up `parsed.intent.mutates`. If `true`, unchanged existing behavior. If `false`: `let result; try { result = await parsed.intent.handler(parsed.args, userId) } catch (e) { result = { success: false, error: e.message } }`, then append to `aiMessages`: an assistant message `{role: 'assistant', content: '', tool_calls: [{id: chunk.id, type: 'function', function: {name: chunk.name, arguments: chunk.arguments}}]}` and a tool message `{role: 'tool', tool_call_id: chunk.id, content: JSON.stringify(result)}`, increment a round-trip counter, and — if under the cap (3) — recurse into a new `chat(aiMessages, tools)` call, continuing the same streaming loop structure instead of returning. If the cap is hit, fall through to a plain `{done: true}` so the request still terminates cleanly rather than looping forever.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- app/api/ai/chat/route.test.ts`
Expected: PASS, including all of Phase 1's existing tests in this file (plain text, single mutating tool call, multiple-tool-calls, key-error path) still passing unchanged — none of that logic moves.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add lib/ai.ts app/api/ai/chat/route.ts app/api/ai/chat/route.test.ts
git commit -m "feat: add bounded tool-result feedback loop for read-only AI intents"
```

---

## Task 8: AI intents — `get_card_summary`, `reconcile_card_statement`

**Files:**
- Modify: `lib/ai/intents.ts`
- Modify: `lib/ai/intents.test.ts`

**Interfaces:**
- Consumes: `findActiveCardByName` (Task 6), `computeCardCycle` (Task 1), the tool-result loop (Task 7).
- Produces: `INTENTS` grows from 6 to 8. Both new intents are `mutates: false` — the first two in the registry, now meaningfully exercised by Task 7's loop instead of just type-checked.

- [ ] **Step 1: Write the failing tests**

```ts
it('get_card_summary resolves by name and returns balance + cycle + interest, read-only', () => {
    const result = parseIntent('get_card_summary', JSON.stringify({ cardName: 'HDFC Millennia' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.intent.mutates).toBe(false)
})

it('reconcile_card_statement validates bankOutstanding and is read-only', () => {
    const result = parseIntent('reconcile_card_statement', JSON.stringify({ cardName: 'HDFC Millennia', bankOutstanding: 5000 }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.intent.mutates).toBe(false)
})
```
(Update the existing `toAITools` test's `toHaveLength(6)` to `toHaveLength(8)`.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: FAIL — unknown intents, and the `toHaveLength` mismatch.

- [ ] **Step 3: Add the two intents**

`get_card_summary`: schema `{cardName: z.string()}`; handler resolves via `findActiveCardByName`, then runs the same outstanding/cycle/interest computation as `app/api/cards/[id]/summary/route.ts` (small, acceptable duplication — the route and the intent have different response-shaping needs, matching the precedent set by `record_card_payment` duplicating rather than importing the Task 6-era `/payments` route logic). Returns `{success: true, result: {...}}` with the summary fields, since `ActionResult.result` is typed as a union that already needs widening — add a plain object shape there rather than a model type, since this isn't a persisted document.

`reconcile_card_statement`: schema `{cardName: z.string(), bankOutstanding: z.number()}`; handler resolves via `findActiveCardByName`, computes outstanding the same way, returns `{computedOutstanding, bankOutstanding, difference}` matching Task 5's route exactly.

Update `toAITools`'s test assertion to `toHaveLength(8)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Manual live verification**

Via the chat endpoint: "What's the current outstanding and due date on HDFC Millennia?" should trigger `get_card_summary`, execute immediately (no confirm card — read-only), and the model's final text response should reference the real numbers. Then "The bank says I owe 5000 more than that on HDFC Millennia, what's the reconcile difference?" should trigger `reconcile_card_statement` similarly.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/intents.ts lib/ai/intents.test.ts
git commit -m "feat: add get_card_summary and reconcile_card_statement read-only AI intents"
```

---

## Task 9: Frontend — show cycle, due date, and interest on `CardTile`

**Files:**
- Modify: `components/CardTile.tsx`
- Modify: `app/(dashboard)/cards/page.tsx` (passes the already-fetched summary through unchanged — no new fetch needed, Task 4 already extended the same summary call this page makes)

**Interfaces:**
- Consumes: the extended `CardSummary` type (needs its TS interface in `types/index.ts` updated to include the new fields from Task 4).

- [ ] **Step 1: Extend the `CardSummary` type in `types/index.ts`**

Add `cycleStart: string; cycleEnd: string; statementDate: string; dueDate: string; dailyInterestEstimate: number` to the existing `CardSummary` interface.

- [ ] **Step 2: Add a due-date line and an interest-estimate line to `CardTile.tsx`**

Below the existing available-limit/usage row: a line showing "Due {format(dueDate, 'MMM d')}" (color-coded red if within 2 days, matching the dashboard's existing "Upcoming Bills" overdue styling precedent from Phase 1), and a small muted line "~₹{dailyInterestEstimate}/day interest (estimate)" — the word "estimate" is not optional styling, it's hard rule 6.

- [ ] **Step 3: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green (this task has no new automated tests — pure display wiring, consistent with this session's established no-component-tests pattern).

- [ ] **Step 4: Manual verification**

Via curl against the live summary endpoint (Chrome still unavailable this session, same caveat as every prior frontend task): confirm the new fields are present and sensible for a seeded card; flag the actual rendering for the user to eyeball once Chrome is connected.

- [ ] **Step 5: Commit**

```bash
git add components/CardTile.tsx types/index.ts
git commit -m "feat: show statement cycle, due date, and interest estimate on card tiles"
```

---

## Task 10: Seed data — a card with a due date inside the reminder window

**Files:**
- Modify: `scripts/seed-dev-data.mjs`

**Interfaces:**
- Consumes: nothing new — writes to the existing `cards` collection via the raw driver, same as Task 10 of Phase 2.

- [ ] **Step 1: Adjust the seeded card's `statementDay` so its computed due date falls within the next 5 days**

Compute today's date at script-run time and pick a `statementDay`/`dueDaysAfterStatement` pair that puts the due date 3-4 days out (close enough to exercise the 5-day reminder manually, far enough not to be already-overdue by the time anyone reads the output). Note in a comment that this makes the seed data's due date relative to "when you last ran this script," same spirit as the existing `monthsAgo`/`dateIn` helpers already being relative to script-run time.

- [ ] **Step 2: Run it and verify via curl**

Run: `node scripts/seed-dev-data.mjs`, then `curl /api/cards/<id>/summary` and confirm `dueDate` is a few days out and `dailyInterestEstimate` is a sane positive number.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-dev-data.mjs
git commit -m "feat: seed a card with a due date inside the reminder window"
```

---

## Task 11: Phase 3 acceptance check

**Files:** none (verification only).

- [ ] **Step 1: Full suite + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Manually trigger the daily cron and confirm a reminder email path runs without error**

`curl` the `/api/cron/daily` route with the correct `CRON_SECRET` bearer header; confirm the response includes the new card-reminders branch's result alongside the existing recurring/budget-alert results, and that it doesn't error even if `RESEND_API_KEY` can't actually deliver in this environment (the existing `lib/budgetAlerts.ts` precedent already established that a failed send doesn't crash the cron — same expectation here).

- [ ] **Step 3: Live-verify both new AI intents end-to-end against the real Groq API**

Same pattern as every prior phase's Task 9/9-equivalent: real prompts, real confirm-free read-only execution, checked against real data from the seeded card.

- [ ] **Step 4: Backward-compatibility spot check**

Confirm a Phase-2-shaped `Card` document (no reminder fields) still loads and its summary endpoint still returns sensible cycle/due/interest values computed fresh (nothing about the new fields is required for the cycle math itself to work — only the reminder-dedup logic reads them, and it treats their absence as "never sent," which is correct).

- [ ] **Step 5: Review commits, do not push**

`git log --oneline` the full range; confirm each is small and self-explanatory. Do not push — same standing instruction as every prior phase.
