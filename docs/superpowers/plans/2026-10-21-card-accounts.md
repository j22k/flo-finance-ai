# Card Accounts (Phase 2 of 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credit-card accounts to Flo (F1–F4): CRUD for cards (last-4-digits only), tagging transactions with a payment method and card, recording card payments, and a balance/usage view — without changing any existing analytics, budget, or AI-context number for a single rupee.

**Architecture:** `Transaction.type` gains a third value, `'card_payment'`, alongside the existing `'income'|'expense'`. Because every existing analytics/budget aggregation in this codebase already exact-matches `type: 'expense'` (verified by reading all of them — see Task 1's research note), none of them need to change: a `card_payment` transaction simply never matches those queries, for free. The one exception, found during planning, is `lib/financialContext.ts` (the AI chat's data source), which uses `if (type==='income') ... else expenses += ...` — a bare `else`, not an exact match — and must be fixed explicitly (Task 4). Card payments are created only through a dedicated `/api/cards/[id]/payments` route that writes `type:'card_payment'` directly; the generic transaction-creation path's Zod schema never accepts that value, so nothing about regular transaction creation changes. Card CRUD, the summary endpoint, and the 2 new AI intents (`add_card`, `record_card_payment` — both mutating) all follow the exact file/hook/route patterns already established by Budget/Goal/RecurringTransaction this session.

**Tech Stack:** Same as Phase 1, plus `mongodb-memory-server` (new devDependency) — Phase 1 deferred DB-backed testing to "whenever card-outstanding-calculation tests need it" (per its own ledger), and this is that point.

**Spec:** `docs/superpowers/specs/2026-10-21-cards-income-groq-intent.md` — features F1–F4, data model row for `Card`, hard rules 1/2/4/5, API routes table's `/api/cards*` rows, risk table row 1 ("Card payments double counted as expenses").

## Global Constraints

- Backwards compatible: new `Transaction` fields are optional; existing rows load unchanged (hard rule 1).
- Card payments are not expenses — excluded from analytics, budgets, and the AI's financial context (hard rule 2).
- All inputs validated with Zod on every API route (hard rule 4).
- Ownership checks via the existing `findOwned()` and `withAuth()` (hard rule 5) — every new `[id]` route uses `findOwned`, no hand-rolled ownership checks.
- Only the last 4 digits of a card are ever stored or accepted — never a full number, CVV, or PIN (spec §2 "Card data" decision).
- No LangChain/LangGraph; no auth changes; don't touch the pre-existing uncommitted `lib/reports.ts` edit (spec §3, still standing from Phase 1).
- Commit per task; do not push until this phase is checked (spec §9 pattern, matching how Phase 1 was handled).

## Review Focus

- **A card payment silently inflates a budget or analytics total** — the single most important thing this phase must not do (hard rule 2's whole point). Covered by Task 4 (financialContext fix) and Task 6's explicit "excluded from analytics" test against the real `/api/analytics/categories` route.
- **An old `Transaction` document with no `paymentMethod`/`cardId` breaks when loaded** — a reasonable person expects every existing transaction to keep displaying normally after this ships. Covered by Task 3's backward-compatibility test (insert a raw pre-migration-shaped doc, read it back).
- **A card's `last4` field accepts something that isn't 4 digits** (a full card number, letters, 3 digits) — a reasonable person expects the "last 4 digits only" promise to be enforced, not just documented. Covered by Task 5's validation tests.
- **Deleting a card leaves its transactions pointing at a dangling `cardId`** — a reasonable person expects either a clear error or a sensible fallback, not a transaction that silently stops showing its card. Covered by Task 5 (delete behavior) and Task 7 (what the transactions list shows for an orphaned `cardId`).
- **The AI proposes `record_card_payment` for a card that doesn't belong to the user, or doesn't exist** — same ownership expectation as every other mutating intent. Covered by Task 9's handler using `findOwned`-equivalent scoping.

---

## Task 1: Test infrastructure — `mongodb-memory-server`

**Files:**
- Create: `vitest.global-setup.ts`
- Modify: `vitest.config.ts` (add `globalSetup`)
- Modify: `package.json` (add `mongodb-memory-server` devDependency)
- Test: `lib/mongodb-test-setup.test.ts` (a throwaway smoke test, deleted once Task 2 provides a real DB-backed test)

**Interfaces:**
- Produces: every later task's DB-backed tests run against a real, ephemeral MongoDB instance (not the dev Docker container), started once per `vitest run` and torn down after. `process.env.MONGODB_URI` is set to the in-memory instance's URI *before* any test file imports `lib/mongodb.ts`, so `connectDB()`'s existing cached-connection logic (unchanged) just works.

- [ ] **Step 1: Install the dependency**

Run: `npm install -D mongodb-memory-server`
Expected: exits 0, no peer-dependency conflicts (it's a pure devDependency with no runtime coupling to the app's own `mongoose` version beyond protocol compatibility).

- [ ] **Step 2: Write `vitest.global-setup.ts`**

```ts
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

export async function setup() {
    mongod = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongod.getUri('flo-finance-test')
}

export async function teardown() {
    await mongod.stop()
}
```

- [ ] **Step 3: Wire it into `vitest.config.ts`**

Add `globalSetup: './vitest.global-setup.ts'` to the `test` block (alongside the existing `setupFiles`). `globalSetup` runs once before any test file loads — critical, since it must set `MONGODB_URI` before `lib/mongodb.ts`'s module-level `cached` object is first touched by any test's import of a model.

- [ ] **Step 4: Write a throwaway smoke test — `lib/mongodb-test-setup.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import connectDB from './mongodb'
import mongoose from 'mongoose'

describe('mongodb-memory-server setup', () => {
    it('connects to the in-memory instance', async () => {
        await connectDB()
        expect(mongoose.connection.readyState).toBe(1)
    })
})
```

- [ ] **Step 5: Run it**

Run: `npm test -- lib/mongodb-test-setup.test.ts`
Expected: `1 passed`. (If this fails with a connection error, `vitest.config.ts`'s `globalSetup` path or timing is wrong — fix before continuing; nothing in this phase can be tested without it.)

- [ ] **Step 6: Delete the smoke test and commit**

```bash
git rm lib/mongodb-test-setup.test.ts
git add vitest.global-setup.ts vitest.config.ts package.json package-lock.json
git commit -m "chore: add mongodb-memory-server for DB-backed tests"
```

---

## Task 2: `Card` model

**Files:**
- Create: `models/Card.ts`
- Test: `models/Card.test.ts`

**Interfaces:**
- Consumes: `vitest.global-setup.ts` (Task 1) for a real DB to validate against.
- Produces:
  ```ts
  export interface ICard extends Document {
      userId: Types.ObjectId
      name: string
      last4: string        // exactly 4 digits
      creditLimit: number
      apr: number           // annual %, e.g. 36 for 36%
      statementDay: number  // 1-31
      dueDaysAfterStatement: number
      isActive: boolean     // default true
      createdAt: Date
      updatedAt: Date
  }
  const Card: Model<ICard>
  export default Card
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Card from './Card'

describe('Card model', () => {
    it('rejects a last4 that is not exactly 4 digits', async () => {
        await connectDB()
        const card = new Card({
            userId: new Types.ObjectId(), name: 'Test Card', last4: '12345',
            creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
        })
        await expect(card.validate()).rejects.toThrow()
    })

    it('accepts a valid card and defaults isActive to true', async () => {
        await connectDB()
        const card = await Card.create({
            userId: new Types.ObjectId(), name: 'HDFC Millennia', last4: '4242',
            creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
        })
        expect(card.isActive).toBe(true)
        expect(card.last4).toBe('4242')
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- models/Card.test.ts`
Expected: FAIL — `Cannot find module './Card'`.

- [ ] **Step 3: Implement `models/Card.ts`**

Mirror `models/Budget.ts`'s structure exactly (same `userId` ref/required pattern, `timestamps: true`). Field specifics:
- `last4`: `{ type: String, required: true, match: /^\d{4}$/ }`.
- `creditLimit`: `{ type: Number, required: true, min: 0.01 }`.
- `apr`: `{ type: Number, required: true, min: 0 }`.
- `statementDay`: `{ type: Number, required: true, min: 1, max: 31 }`.
- `dueDaysAfterStatement`: `{ type: Number, required: true, min: 1 }`.
- `isActive`: `{ type: Boolean, default: true }`.
- Index: `cardSchema.index({ userId: 1 })` (every card lookup is scoped by user).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- models/Card.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add models/Card.ts models/Card.test.ts
git commit -m "feat: add Card model (last-4-digits only, per spec hard rule)"
```

---

## Task 3: Extend `Transaction` with `paymentMethod`, `cardId`, and the `card_payment` type

**Files:**
- Modify: `models/Transaction.ts`
- Modify: `types/index.ts` (the `Transaction` interface)
- Test: `models/Transaction.test.ts` (new file)

**Interfaces:**
- Consumes: `Card` (Task 2) for the `cardId` ref target.
- Produces: `ITransaction.type` becomes `'income' | 'expense' | 'card_payment'`; `ITransaction.paymentMethod?: 'cash' | 'upi' | 'card' | 'bank'` (schema default `'cash'`); `ITransaction.cardId?: Types.ObjectId`. **No existing query in this codebase needs to change** — every one already exact-matches `type: 'expense'` or `type: 'income'` (confirmed by `git grep "type:.*'expense'\|type:.*'income'"` across the repo during planning); a `card_payment` row simply never matches any of them.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from './Transaction'
import mongoose from 'mongoose'

describe('Transaction model — card fields', () => {
    it('accepts type:"card_payment" with a cardId', async () => {
        await connectDB()
        const tx = await Transaction.create({
            userId: new Types.ObjectId(), title: 'Payment to HDFC Millennia', amount: 5000,
            type: 'card_payment', category: 'Card Payment', date: new Date(),
            cardId: new Types.ObjectId(),
        })
        expect(tx.type).toBe('card_payment')
    })

    it('still loads a pre-existing document that has no paymentMethod or cardId at all', async () => {
        await connectDB()
        // Inserted via the raw driver, bypassing Mongoose defaults, to simulate
        // a document written before this migration — exactly what hard rule 1
        // ("existing rows must still load and display") is about.
        const { insertedId } = await mongoose.connection.db!.collection('transactions').insertOne({
            userId: new Types.ObjectId(), title: 'Old Rent', amount: 15000,
            type: 'expense', category: 'Housing', date: new Date(), createdAt: new Date(), updatedAt: new Date(),
        })
        const tx = await Transaction.findById(insertedId)
        expect(tx).not.toBeNull()
        expect(tx!.title).toBe('Old Rent')
        expect(tx!.paymentMethod).toBeUndefined()
        expect(tx!.cardId).toBeUndefined()
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- models/Transaction.test.ts`
Expected: FAIL on the first test — Mongoose's `type` enum validator rejects `'card_payment'` (not yet in the schema's `enum` list).

- [ ] **Step 3: Extend `models/Transaction.ts`**

Change `type`'s schema `enum` from `['income', 'expense']` to `['income', 'expense', 'card_payment']` (and the `ITransaction.type` TS union to match). Add:
```ts
paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'bank'],
    default: 'cash',
},
cardId: {
    type: Schema.Types.ObjectId,
    ref: 'Card',
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- models/Transaction.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Update `types/index.ts`**

Extend the `Transaction` interface: `type: 'income' | 'expense' | 'card_payment'`, add `paymentMethod?: 'cash' | 'upi' | 'card' | 'bank'`, add `cardId?: string`.

- [ ] **Step 6: Run the full type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (If any file destructures `tx.type` into a 2-member union elsewhere and narrows exhaustively with a `never`-returning `default` case, this would surface it — the earlier `git grep` research found none, but this is the real confirmation.)

- [ ] **Step 7: Commit**

```bash
git add models/Transaction.ts models/Transaction.test.ts types/index.ts
git commit -m "feat: extend Transaction with card_payment type, paymentMethod, cardId"
```

---

## Task 4: Fix `lib/financialContext.ts`'s binary income/expense split

**Files:**
- Modify: `lib/financialContext.ts`
- Test: `lib/financialContext.test.ts` (new file)

**Interfaces:**
- Consumes: `Transaction` with `type: 'card_payment'` (Task 3).
- Produces: `buildFinancialContext()`'s `thisMonth.expenses`, `categoryTotals` (feeding `topCategories`), and `monthlyTrend`'s per-month `expense` all exclude `card_payment` transactions. This is the one place in the codebase that needed an actual code change for hard rule 2, found during planning (see this plan's Architecture section).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { buildFinancialContext } from './financialContext'

describe('buildFinancialContext — card payment exclusion', () => {
    it('excludes card_payment transactions from this month\'s expenses and category totals', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const today = new Date()
        await Transaction.create([
            { userId, title: 'Groceries', amount: 2000, type: 'expense', category: 'Food', date: today },
            { userId, title: 'Payment to HDFC Millennia', amount: 9000, type: 'card_payment', category: 'Card Payment', date: today },
        ])

        const context = await buildFinancialContext(userId.toString(), 'Test User')

        expect(context.thisMonth.expenses).toBe(2000)
        expect(context.topCategories.find(c => c.category === 'Card Payment')).toBeUndefined()
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/financialContext.test.ts`
Expected: FAIL — `context.thisMonth.expenses` is `11000` (2000 + 9000), because the current code's `else` branch catches anything that isn't `'income'`.

- [ ] **Step 3: Fix the two binary splits in `lib/financialContext.ts`**

In the `thisMonth`/`categoryTotals` loop: change `if (tx.type === 'income') { ... } else { ... }` to `if (tx.type === 'income') { ... } else if (tx.type === 'expense') { ... }` (card_payment falls through, counted in neither).

In the `monthlyTrend` loop: change `if (tx.type === 'income') inc += tx.amount; else exp += tx.amount` to `if (tx.type === 'income') inc += tx.amount; else if (tx.type === 'expense') exp += tx.amount`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/financialContext.test.ts`
Expected: PASS (1/1).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all green — this change narrows two `else` branches to `else if`, which cannot affect existing income/expense-only data (nothing in current data has a third `type` value yet).

- [ ] **Step 6: Commit**

```bash
git add lib/financialContext.ts lib/financialContext.test.ts
git commit -m "fix: exclude card_payment transactions from the AI assistant's financial context"
```

---

## Task 5: Cards CRUD API

**Files:**
- Create: `app/api/cards/route.ts`
- Create: `app/api/cards/[id]/route.ts`
- Test: `app/api/cards/route.test.ts`

**Interfaces:**
- Consumes: `Card` (Task 2), `findOwned`/`withAuth` (existing, from Phase 1's `lib/middleware.ts`).
- Produces: `GET /api/cards` → `{cards}`; `POST /api/cards` → `{card}`, 201; `GET/PATCH/DELETE /api/cards/[id]`. Spec §7 names the methods `GET, PATCH, DELETE` for the `[id]` route specifically (not the `PUT` this codebase otherwise uses for every other `[id]` route) — followed literally here since the spec states it explicitly, unlike the other routes where the method was never spec-dictated.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'

describe('POST /api/cards', () => {
    it('creates a card for the authenticated user', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const userId = new Types.ObjectId().toString()
        const req = { json: async () => ({ name: 'HDFC Millennia', last4: '4242', creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 }) } as any
        const res = await POST(req, { userId } as any)
        const body = await res.json()
        expect(body.card.last4).toBe('4242')
    })

    it('rejects a last4 that is not 4 digits', async () => {
        const { POST } = await import('./route')
        const req = { json: async () => ({ name: 'Bad Card', last4: '123', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15 }) } as any
        const res = await POST(req, { userId: new Types.ObjectId().toString() } as any)
        expect(res.status).toBe(422)
    })
})

describe('GET /api/cards/[id]', () => {
    it('returns 404 for a card belonging to a different user', async () => {
        await connectDB()
        const card = await Card.create({ userId: new Types.ObjectId(), name: 'Someone Else\'s', last4: '1111', creditLimit: 1000, apr: 10, statementDay: 1, dueDaysAfterStatement: 15 })
        const { GET } = await import('./[id]/route')
        const res = await GET({} as any, { params: { id: card._id.toString() }, userId: new Types.ObjectId().toString() } as any)
        expect(res.status).toBe(404)
    })
})
```
Note: these tests call the exported `POST`/`GET` handlers directly with a plain object standing in for `NextRequest` and a manually-supplied `{userId}` context — the same pattern Phase 1's `app/api/ai/chat/route.test.ts` established, skipping `withAuth`'s token verification entirely since these are the inner handlers `withAuth` wraps. (`withAuth` itself is untouched, pre-existing, and already implicitly exercised by every route that uses it.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/cards`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement `app/api/cards/route.ts`**

Mirror `app/api/budgets/route.ts` exactly: `withAuth`-wrapped `GET` (`Card.find({userId}).sort({createdAt:-1})`) and `POST` (Zod schema matching Task 2's field constraints — `last4: z.string().regex(/^\d{4}$/)`, `creditLimit`/`apr`/`statementDay`/`dueDaysAfterStatement` all `z.number()` with the same bounds as the Mongoose schema — `Card.create({...validated, userId})`, 201).

- [ ] **Step 4: Implement `app/api/cards/[id]/route.ts`**

Mirror `app/api/goals/[id]/route.ts`'s use of `findOwned<ICard>(Card, params.id, userId)`. `GET` returns `{card}`. `PATCH` validates a partial version of the create schema (all fields optional) and applies via `Card.findByIdAndUpdate`. `DELETE` — see Review Focus: a card with existing transactions pointing at its `cardId` must not vanish silently. For Phase 2, `DELETE` sets `isActive: false` (soft delete) rather than removing the document, so `cardId` references on past transactions keep resolving (`findOwned` + `Card.findByIdAndUpdate(card._id, {isActive: false})` instead of `findByIdAndDelete`). This is a deliberate choice, not a plan gap — hard-deleting a card with transaction history would orphan `cardId` references with no recovery path, which is a worse failure mode than leaving an inactive card around.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- app/api/cards`
Expected: PASS (3/3).

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app/api/cards
git commit -m "feat: add Cards CRUD API (soft-delete to preserve transaction history)"
```

---

## Task 6: Card payments + balance summary API

**Files:**
- Create: `app/api/cards/[id]/payments/route.ts`
- Create: `app/api/cards/[id]/summary/route.ts`
- Test: `app/api/cards/[id]/summary/route.test.ts`

**Interfaces:**
- Consumes: `Card` (Task 2), `Transaction` with `type:'card_payment'`/`cardId` (Task 3).
- Produces: `POST /api/cards/[id]/payments` → creates a `Transaction{type:'card_payment', cardId, category:'Card Payment'}`, returns `{transaction}`, 201. `GET /api/cards/[id]/summary` → `{outstanding, availableLimit, usagePercent}` (cycle/dueDate/interestEstimate fields are added in Phase 3 — this endpoint is designed to grow, not be rebuilt).

- [ ] **Step 1: Write the failing tests — this is the spec's explicit "card outstanding calculation" testing requirement**

```ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'
import Transaction from '@/models/Transaction'

describe('GET /api/cards/[id]/summary', () => {
    it('computes outstanding as spends minus payments, excluding other cards and other users', async () => {
        await connectDB()
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Test Card', last4: '4242', creditLimit: 10000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 })
        const otherCard = await Card.create({ userId, name: 'Other Card', last4: '9999', creditLimit: 5000, apr: 20, statementDay: 1, dueDaysAfterStatement: 15 })

        await Transaction.create([
            { userId, title: 'Spend 1', amount: 3000, type: 'expense', category: 'Shopping', date: new Date(), cardId: card._id },
            { userId, title: 'Spend 2', amount: 2000, type: 'expense', category: 'Food', date: new Date(), cardId: card._id },
            { userId, title: 'Payment', amount: 1000, type: 'card_payment', category: 'Card Payment', date: new Date(), cardId: card._id },
            { userId, title: 'Other card spend', amount: 500, type: 'expense', category: 'Food', date: new Date(), cardId: otherCard._id },
        ])

        const { GET } = await import('./route')
        const res = await GET({} as any, { params: { id: card._id.toString() }, userId: userId.toString() } as any)
        const body = await res.json()

        expect(body.outstanding).toBe(4000) // 3000 + 2000 - 1000
        expect(body.availableLimit).toBe(6000) // 10000 - 4000
        expect(body.usagePercent).toBe(40)
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/cards/[id]/summary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/api/cards/[id]/summary/route.ts`**

`findOwned<ICard>(Card, params.id, userId)` then one aggregation: `Transaction.aggregate([{$match: {userId, cardId: card._id, type: {$in: ['expense','card_payment']}}}, {$group: {_id: '$type', total: {$sum: '$amount'}}}])`, reduce to `spends - payments`, compute `availableLimit = Math.max(0, card.creditLimit - outstanding)` and `usagePercent = Math.round((outstanding / card.creditLimit) * 100)`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- app/api/cards/[id]/summary`
Expected: PASS (1/1).

- [ ] **Step 5: Write the failing test for payments + analytics exclusion — the spec's other explicit testing requirement**

```ts
describe('POST /api/cards/[id]/payments', () => {
    it('creates a card_payment transaction that the real analytics/categories route excludes', async () => {
        await connectDB()
        const { Types } = await import('mongoose')
        const Card = (await import('@/models/Card')).default
        const userId = new Types.ObjectId()
        const card = await Card.create({ userId, name: 'Test Card', last4: '4242', creditLimit: 10000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20 })

        // payments/ is a sibling of summary/ under [id]/, not nested inside it —
        // this test file lives at app/api/cards/[id]/summary/route.test.ts.
        const { POST: recordPayment } = await import('../payments/route')
        const payRes = await recordPayment({ json: async () => ({ amount: 2000, date: new Date().toISOString() }) } as any, { params: { id: card._id.toString() }, userId: userId.toString() } as any)
        expect(payRes.status).toBe(201)

        const { GET: categoriesGet } = await import('@/app/api/analytics/categories/route')
        const now = new Date()
        const catRes = await categoriesGet({ url: `http://x?month=${now.getMonth() + 1}&year=${now.getFullYear()}` } as any, { userId: userId.toString() } as any)
        const catBody = await catRes.json()

        expect(catBody.categories.find((c: any) => c.category === 'Card Payment')).toBeUndefined()
    })
})
```
This test deliberately exercises the **real, unmodified** `analytics/categories` route — proving hard rule 2 end-to-end through production code, not a re-implementation of its logic.

- [ ] **Step 6: Run to verify failure, then implement `app/api/cards/[id]/payments/route.ts`**

Run: `npm test -- app/api/cards/[id]`
Expected: FAIL (module not found) → implement: `findOwned`, Zod `{amount: positive, date: optional (default now), note: optional}`, `Transaction.create({userId, cardId: card._id, type: 'card_payment', category: 'Card Payment', title: \`Payment to ${card.name}\`, amount, date, note})`, return `{transaction}`, 201.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- app/api/cards`
Expected: PASS (2/2 in this file, 3/3 total for `app/api/cards/**`).

- [ ] **Step 8: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add app/api/cards/[id]/payments app/api/cards/[id]/summary
git commit -m "feat: add card payment recording and balance summary, excluded from analytics"
```

---

## Task 7: Frontend — Cards page, form, and nav

**Files:**
- Create: `hooks/useCards.ts`
- Create: `components/CardForm.tsx`
- Create: `components/CardTile.tsx`
- Create: `app/(dashboard)/cards/page.tsx`
- Modify: `components/Sidebar.tsx`

**Interfaces:**
- Consumes: `app/api/cards*` (Task 5, 6).
- Produces: a `/cards` page listing `CardTile`s (outstanding/available/usage%, fetched per card from `/api/cards/[id]/summary`), an "Add Card" button opening `CardForm` as a modal (mirrors `TransactionForm`'s modal pattern — chosen over the sticky-sidebar-form pattern Budgets/Goals/Recurring use, because `CardForm` has 6 fields and needs the room a modal gives), and a "Record Payment" action on each tile.

- [ ] **Step 1: `hooks/useCards.ts`**

Mirror `hooks/useBudgets.ts`: `fetchCards`, `createCard`, `updateCard`, `deleteCard` (calls the soft-delete `PATCH`... actually calls `DELETE`, which Task 5 implemented as a soft-delete server-side — the hook's `deleteCard` still calls `DELETE /api/cards/[id]`, the soft-delete is transparent to the frontend), `recordPayment(cardId, {amount, date?, note?})` → `POST /api/cards/[id]/payments`.

- [ ] **Step 2: `components/CardForm.tsx`**

Mirror `TransactionForm.tsx`'s modal structure (`.modal-overlay`/`.modal-content`, ESC-to-close, the same `flo-input`/`flo-label` classes). Fields: name, last4 (maxLength 4, numeric), creditLimit, apr, statementDay (1-31), dueDaysAfterStatement. Client-side validation mirrors the Zod schema's bounds (same philosophy as every other form this session — client validation for UX, server Zod for correctness).

- [ ] **Step 3: `components/CardTile.tsx`**

Mirror `BudgetCard.tsx`'s progress-bar/color-threshold pattern: progress bar = `usagePercent`, green/yellow/red at the same 60%/85% thresholds `BudgetCard` already uses, "₹{outstanding} of ₹{creditLimit}" plus "₹{availableLimit} available". A "Record Payment" button opens a small inline amount input (mirrors `GoalCard`'s "+ Add contribution" modal pattern) calling `recordPayment`.

- [ ] **Step 4: `app/(dashboard)/cards/page.tsx`**

Mirror `app/(dashboard)/goals/page.tsx`'s page shell (header, loading/empty states, grid of tiles) but with the "Add Card" trigger opening `CardForm` as a modal (per Task 7's Interfaces note) rather than a sticky side form.

- [ ] **Step 5: `components/Sidebar.tsx`**

Add `{ href: '/cards', icon: CreditCard, label: 'Cards' }` to `navItems`, after Recurring (same insertion pattern Goals/Recurring used in Phase-prior work).

- [ ] **Step 6: Manual verification**

Run: `npm run dev` (if not already running) and, since the Chrome extension is unavailable this session (same as Phase 1's Task 7), verify via `curl` against the live routes: create a card, fetch its summary, record a payment, re-fetch the summary and confirm `outstanding` dropped by the payment amount. Flag for the user, as Phase 1 did, that the actual page rendering should be eyeballed once Chrome is connected.

- [ ] **Step 7: Commit**

```bash
git add hooks/useCards.ts components/CardForm.tsx components/CardTile.tsx "app/(dashboard)/cards" components/Sidebar.tsx
git commit -m "feat: add Cards page, card form, and balance tiles"
```

---

## Task 8: Tag transactions with payment method and card

**Files:**
- Modify: `app/api/transactions/route.ts` (POST schema)
- Modify: `app/api/transactions/[id]/route.ts` (PUT schema)
- Modify: `components/TransactionForm.tsx`
- Test: `app/api/transactions/route.test.ts` (new file)

**Interfaces:**
- Consumes: `Card` (Task 2), the extended `Transaction` schema (Task 3).
- Produces: `POST`/`PUT /api/transactions` accept optional `paymentMethod` and `cardId`; `cardId` is required when `paymentMethod === 'card'` (and rejected as invalid otherwise, to catch a mismatched client state early). The generic transaction `type` enum stays `['income','expense']` only — `card_payment` is never accepted here, only through Task 6's dedicated route.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'

describe('POST /api/transactions — payment method', () => {
    it('accepts paymentMethod:"card" with a cardId', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const userId = new Types.ObjectId().toString()
        const req = { json: async () => ({ title: 'Dinner', amount: 1200, type: 'expense', category: 'Food', date: '2026-10-21', paymentMethod: 'card', cardId: new Types.ObjectId().toString() }) } as any
        const res = await POST(req, { userId } as any)
        expect(res.status).toBe(201)
    })

    it('rejects paymentMethod:"card" with no cardId', async () => {
        const { POST } = await import('./route')
        const req = { json: async () => ({ title: 'Dinner', amount: 1200, type: 'expense', category: 'Food', date: '2026-10-21', paymentMethod: 'card' }) } as any
        const res = await POST(req, { userId: new Types.ObjectId().toString() } as any)
        expect(res.status).toBe(422)
    })

    it('still accepts a request with neither field, defaulting to cash', async () => {
        await connectDB()
        const { POST } = await import('./route')
        const req = { json: async () => ({ title: 'Lunch', amount: 300, type: 'expense', category: 'Food', date: '2026-10-21' }) } as any
        const res = await POST(req, { userId: new Types.ObjectId().toString() } as any)
        const body = await res.json()
        expect(res.status).toBe(201)
        expect(body.transaction.paymentMethod).toBe('cash')
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/transactions/route.test.ts`
Expected: FAIL on the first two — the current schema has no `paymentMethod`/`cardId` fields at all, so they're silently dropped (not validated), and the second test's expectation of a 422 isn't met.

- [ ] **Step 3: Extend the Zod schema in `app/api/transactions/route.ts`**

```ts
const createSchema = z.object({
    // ...existing fields unchanged...
    paymentMethod: z.enum(['cash', 'upi', 'card', 'bank']).optional(),
    cardId: z.string().optional(),
}).refine((data) => data.paymentMethod !== 'card' || !!data.cardId, {
    message: 'cardId is required when paymentMethod is "card"',
    path: ['cardId'],
})
```
Mirror the same `.refine` shape into `app/api/transactions/[id]/route.ts`'s update schema (there, `paymentMethod`/`cardId` are both optional independently, so the refine only fires when `paymentMethod` is explicitly being set to `'card'` in that same request).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/transactions/route.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Update `components/TransactionForm.tsx`**

Add a "Payment Method" select (`cash`/`upi`/`card`/`bank`, default `cash`) below the Category field. When `paymentMethod === 'card'`, show a Card select populated via a new `useCards()` call (filter to `isActive` cards), required in that case. Both fields default such that a user who never touches them submits exactly what they do today (`paymentMethod: 'cash'`, no `cardId`) — zero behavior change for existing usage.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app/api/transactions components/TransactionForm.tsx
git commit -m "feat: tag transactions with payment method and card"
```

---

## Task 9: AI intents — `add_card`, `record_card_payment`

**Files:**
- Modify: `lib/ai/intents.ts`
- Modify: `types/chat.ts`
- Modify: `components/chat/ActionConfirmCard.tsx`
- Test: `lib/ai/intents.test.ts`

**Interfaces:**
- Consumes: `Card` (Task 2), the card-payment handler logic (Task 6, re-implemented inline per-intent the same way Phase 1's intents each own their handler — no shared helper extracted, matching Phase 1's precedent of one handler per intent).
- Produces: `INTENTS` grows from 4 to 6 entries. Both new intents are `mutates: true` — Phase 1's addendum explicitly deferred read-only intents (and the tool-result-feedback loop they'd need) to Phase 3; `add_card`/`record_card_payment` fit the existing mutating-intent path with zero changes to `app/api/ai/chat/route.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
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
```
(`toAITools` already has a generic test in this file from Phase 1 asserting `tools.length` matches `INTENTS.length` indirectly via `toHaveLength(4)` — that assertion's literal `4` needs updating to `6` as part of this task, since it would otherwise fail once the registry grows.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: FAIL — `add_card`/`record_card_payment` aren't registered yet (`Unknown intent`), and the existing `toHaveLength(4)` assertion will need the Step 3 update to `6` before it can pass again either.

- [ ] **Step 3: Add the two intents to `lib/ai/intents.ts`**

`add_card`: schema mirrors Task 5's Zod shape exactly (`name`, `last4` regex, `creditLimit`/`apr`/`statementDay`/`dueDaysAfterStatement`); handler does `Card.create({...args, userId})`.

`record_card_payment`: schema `{cardName: z.string(), amount: z.number().positive(), note: z.string().optional()}` — resolved **by name, not id**, because the model won't reliably know a card's ObjectId from conversation; handler does `Card.findOne({userId, name: new RegExp(\`^${escapeRegex(cardName)}$\`, 'i')})`, throws a clear "Card not found" error if no match (surfaced to the user the same way Phase 1's `update_transaction`/`delete_transaction` "not found" errors already are), then creates the `card_payment` Transaction exactly as Task 6's route does (title `Payment to ${card.name}`, category `'Card Payment'`, `cardId: card._id`).

Update the existing `toAITools` test's `toHaveLength(4)` to `toHaveLength(6)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ai/intents.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend `types/chat.ts` and `components/chat/ActionConfirmCard.tsx`**

Add `'add_card' | 'record_card_payment'` to `ChatAction['type']`. Add matching `case` labels to `getActionLabel()` ("Add Card", "Record Card Payment") — picking up Phase 1's final-review Minor finding #6 (confirm-card labels not type-checked against the registry) at exactly the moment it predicted would matter: a new intent added without a label falls through to "Quick Action" silently. This task adds the two labels explicitly rather than deferring further, since it's the first real test of that exact gap.

- [ ] **Step 6: Run the full suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Manual live verification**

Via the chat endpoint (same curl pattern as Phase 1's Task 9): "Add a card called Test Card, last 4 1234, limit 50000, APR 36%, statement day 5, due 20 days after statement" → confirm → check `/api/cards`. Then "Record a 2000 rupee payment to Test Card" → confirm → check the card's `/summary` outstanding dropped.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/intents.ts lib/ai/intents.test.ts types/chat.ts components/chat/ActionConfirmCard.tsx
git commit -m "feat: add add_card and record_card_payment AI intents"
```

---

## Task 10: Extend the seed script

**Files:**
- Modify: `scripts/seed-dev-data.mjs`

**Interfaces:**
- Consumes: nothing new from this plan — writes directly to the `cards` and `transactions` collections via the raw driver, matching the rest of the script's existing style.

- [ ] **Step 1: Add a seeded card and card-tagged transactions**

Insert one `Card` document (e.g. "HDFC Millennia", last4 "4242", creditLimit 50000, apr 36, statementDay 5, dueDaysAfterStatement 20) and 2-3 `expense` transactions this month with `paymentMethod:'card'`/`cardId` set to it, plus one `card_payment` transaction against it — mirroring the spec's explicit testing note ("Use the seed script to add a test card and sample card spends").

- [ ] **Step 2: Run it and verify via curl**

Run: `node scripts/seed-dev-data.mjs`, then log in as the seeded test user and `curl /api/cards` and `curl /api/cards/<id>/summary` to confirm the seeded card and a sane `outstanding` value appear.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-dev-data.mjs
git commit -m "feat: seed a test card and card-tagged transactions"
```

---

## Task 11: Phase 2 acceptance check

**Files:** none (verification only).

- [ ] **Step 1: Full suite + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Regression check against hard rule 2 using real pre-existing data**

Using the seeded test user (already has budgets/goals/recurring from Phase 1's seed data): note the current `/api/analytics/categories`, `/api/analytics/dashboard`, and `/api/budgets` numbers for the current month, record a card payment via the live API, then re-fetch all three and confirm every number is byte-identical. This is the direct, empirical proof that hard rule 2 holds for the full stack, not just the unit-tested slice.

- [ ] **Step 3: Backward-compatibility spot check**

Confirm an old transaction created before this phase's migration (e.g. one from Phase 1's seed data) still appears correctly on the `/transactions` page and in `/api/transactions` with no error, despite having no `paymentMethod`/`cardId` in its stored document.

- [ ] **Step 4: Review commits, do not push**

`git log --oneline` the full range of this phase's commits; confirm each is small and self-explanatory. Do not push — same standing instruction as Phase 1, wait for explicit go-ahead.
