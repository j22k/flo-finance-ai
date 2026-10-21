# Flo: Intent

Next.js 14 (App Router) + MongoDB + Zod. Live app. Single/few-user. Deployed on Vercel Hobby (max 2 crons, each at most once a day).

## 1. Goal

Add credit card tracking and irregular-income planning to Flo, and replace Gemini with Groq. Nothing existing may break.

## 2. Decisions already made

| Decision | Choice | Why |
|---|---|---|
| AI provider | Gemini → **Groq** (OpenAI-compatible API) | Fast, cheap, mostly a client swap |
| Agent framework | **No LangChain / LangGraph** | The current single-action flow is already a minimal loop. Revisit only if multi-step or branching tool use is needed |
| Action format | `[ACTION:{...}]` tag → **native tool calling** | More reliable on open models. Every call validated with Zod |
| Cron | **Reuse `/api/cron/daily`** | Hobby plan allows only 2 crons |
| Card data | **Last 4 digits only** | Never store full number, CVV or PIN |

## 3. Non-goals

- No bank or SMS integration.
- No multi-tenant changes.
- No LangChain or LangGraph.
- No change to auth.
- Do not touch the uncommitted `lib/reports.ts` edit unless asked.

## 4. Hard rules (apply to every feature)

1. **Backwards compatible.** New fields on `Transaction` are optional. Existing rows must still load and display.
2. **Card payments are not expenses.** They reduce card outstanding only. Analytics, budgets and reports must exclude them.
3. **Expected income is not cash** until marked received.
4. **All inputs validated with Zod** on every API route.
5. **Ownership checks** via the existing `findOwned()` and `withAuth()`.
6. **Interest figures are estimates.** Label them as such.
7. **Mutating AI actions need user confirmation.**

## 5. Data model changes

| Model | Change |
|---|---|
| `Transaction` | Add optional `paymentMethod` (`cash`\|`upi`\|`card`\|`bank`, default `cash`), optional `cardId`. Extend `type` with `card_payment` (or add `isCardPayment`) |
| `Card` (new) | `userId`, `name`, `last4`, `creditLimit`, `apr`, `statementDay`, `dueDay` or `dueDaysAfterStatement`, `isActive` |
| `ExpectedIncome` (new) | `userId`, `client`, `amount`, `expectedDate`, `status` (`expected`\|`received`), `receivedAt`, `transactionId`, `note` |
| `User` or settings | Optional `cashBalance` and `cushionMonths` (default 3) for runway |

## 6. Features

| # | Feature | Acceptance criteria | Phase |
|---|---|---|---|
| F1 | **Card accounts** | CRUD for cards. Only last 4 digits stored. Limit and APR editable | 2 |
| F2 | **Tag spends to a card** | Transaction form has payment method and card picker. Card spends link to `cardId` | 2 |
| F3 | **Card payments** | Recording a payment lowers outstanding and does not appear in expense totals, budgets or analytics | 2 |
| F4 | **Card balance** | Outstanding = spends − payments. Shows available limit and usage % | 2 |
| F5 | **Statement cycle view** | Groups spends by `statementDay`. Shows current cycle, last billed, due date | 3 |
| F6 | **Due reminders** | Email 5, 2 and 0 days before due, inside `/api/cron/daily`. Deduped like `alert80SentAt` | 3 |
| F7 | **Interest estimate** | Outstanding × APR ÷ 365 per day. Shown as an estimate | 3 |
| F8 | **Reconcile** | User enters bank outstanding. App shows the difference | 3 |
| F9 | **Expected vs received income** | Freelance payments tracked separately. Marking received creates an income `Transaction` | 4 |
| F10 | **Cash runway** | Months left = (cash − pending bills − card outstanding) ÷ monthly spend, using received income only | 4 |
| F11 | **Safe to spend** | Dashboard tile: cash − upcoming bills − card due − cushion | 4 |
| F12 | **Low-cash alert** | Email when runway falls below `cushionMonths`. Part of `/api/cron/daily` | 4 |
| F13 | **Statement import** | Upload PDF/CSV, AI extracts rows, user confirms before save | 5 |

## 7. API routes (new)

| Route | Methods | Notes |
|---|---|---|
| `/api/cards` | GET, POST | List, create |
| `/api/cards/[id]` | GET, PATCH, DELETE | Use `findOwned()` |
| `/api/cards/[id]/summary` | GET | Outstanding, available limit, cycle, due date, interest estimate |
| `/api/cards/[id]/payments` | POST | Records `card_payment` |
| `/api/income/expected` | GET, POST | Expected freelance income |
| `/api/income/expected/[id]/receive` | POST | Creates the income transaction |
| `/api/runway` | GET | Runway and safe-to-spend |

## 8. AI changes

**Files:** `lib/gemini.ts` → `lib/ai.ts` (provider wrapper). `lib/chatActions.ts` → tool-call executor.

| Step | Detail |
|---|---|
| Client | `groq-sdk`. Env `GROQ_API_KEY`. Remove `@google/generative-ai` and the unused `@anthropic-ai/sdk` |
| Wrapper | One function: `chat(messages, tools)`. Keep streaming. Provider can be swapped in one file |
| Messages | Map Gemini `contents/parts` to `system/user/assistant`. Put context in the system message |
| Tools | Defined in `lib/ai/intents.ts` (already written). Each has a Zod schema and a `mutates` flag |
| Execution | `parseIntent()` → if `mutates`, ask user to confirm → run handler → return result as a `tool` message |
| Context | `lib/financialContext.ts` gains card outstanding, due dates, expected income and runway |

**Intents (16):** `add_transaction`, `update_transaction`, `delete_transaction`, `set_budget`, `add_card`, `record_card_payment`, `get_card_summary`, `get_card_due`, `estimate_card_interest`, `reconcile_card_statement`, `add_expected_income`, `mark_income_received`, `get_cash_runway`, `get_safe_to_spend`, `get_spending_summary`, `search_transactions`.

## 9. Build order

| Phase | Scope | Done when |
|---|---|---|
| 1 | Groq swap, tool calling, `lib/ai.ts`, existing 4 actions migrated | Same 10 test prompts give the same results on Groq as on Gemini |
| 2 | F1 to F4 | Card spends and payments work. Expense totals unchanged by payments |
| 3 | F5 to F8 | Cycle view, reminders, interest, reconcile |
| 4 | F9 to F12 | Runway, safe-to-spend, alerts |
| 5 | F13 | Statement import with confirm step |

Commit per phase. Do not push until each phase is checked.

## 10. Testing

No test suite exists yet. Add Vitest for at least:
- Card outstanding calculation.
- Card payments excluded from expense totals, budgets and analytics.
- Statement cycle boundaries (spend on the statement day, month ends, day 31).
- Interest estimate.
- Runway with zero and with positive income.
- `parseIntent()` rejects bad arguments and unknown intents.

Use the seed script (`scripts/seed-dev-data.mjs`) to add a test card and sample card spends.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Card payments double counted as expenses | Test first; exclude in one shared query helper |
| Breaking live data | Optional fields only; no destructive migration |
| Open model emits bad tool arguments | Zod validation; return errors to the model once, then stop |
| Groq rate limits or timeouts on Vercel Hobby | Keep context small; stream; handle 429 with a clear message |
| Statement day edge cases (29 to 31) | Clamp to month end |
| Secrets | `GROQ_API_KEY` in env only; never log card data |

## 12. Definition of done

- Groq runs chat and all actions. Gemini code removed.
- Cards can be added; spends and payments tracked; outstanding matches the bank figure.
- Existing analytics and budgets give the same numbers as before for old data.
- Tests pass. Type check passes in strict mode.
- No full card numbers anywhere in the DB or logs.

---

## Addendum — verified against the actual codebase (2026-10-21)

The following corrects or grounds assumptions in the intent doc above against what's actually in the repo, discovered while planning Phase 1:

- **`lib/ai/intents.ts` does not already exist.** The doc's AI-changes table says tools are "already written" there — confirmed via `Glob` that no such file is present anywhere in the repo. Phase 1 creates it from scratch.
- **Existing AI action plumbing, confirmed by reading the code:**
  - `app/api/ai/chat/route.ts` streams Gemini deltas and, at stream end, regex-parses a `[ACTION:{...}]` tag out of the full accumulated text via `parseActionFromResponse` (`lib/gemini.ts`), emitting SSE events shaped `{delta}` then `{done:true, action}`.
  - `hooks/useChat.ts` consumes that exact SSE shape and, on `data.done`, attaches `action` to the assistant `ChatMessage`.
  - `components/chat/ActionConfirmCard.tsx` renders for any message with an `action`, and **already implements the "mutating action needs confirmation" requirement (hard rule 7)** — every current action (including creates) requires an explicit Confirm click, which calls `useChat.executeAction` → `POST /api/ai/quick-action` → `lib/chatActions.ts`'s `executeChatAction(action, userId)`.
  - `types/chat.ts`'s `ChatAction.type` union currently uses `create_transaction`/`create_budget`/`update_budget` — the intent doc's names (`add_transaction`/`set_budget`) are a rename, not new concepts. `executeChatAction` already treats `create_budget` and `update_budget` identically (a single upsert), confirming `set_budget` is the correct merge target.
- **Phase 1 only touches 4 intents, all mutating.** None of the 16 intents listed are read-only yet (those start in Phase 2+), so Phase 1 does not need a tool-result-feedback loop back into the model — the model either emits one tool call (shown as a confirm card, exactly like today) or plain text. That loop becomes necessary starting with whichever phase introduces the first read-only intent (e.g. `get_card_summary`), and is explicitly out of scope here.
- **No test framework exists in this repo at all.** Vitest setup (config, path-alias resolution, `test` script) is itself a Phase 1 deliverable, not assumed infrastructure.
