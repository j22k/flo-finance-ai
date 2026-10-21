import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { chat, AIMessage } from '@/lib/ai'
import { INTENTS, toAITools, parseIntent } from '@/lib/ai/intents'
import { buildFinancialContext } from '@/lib/financialContext'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'

export const POST = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()
        const { messages, contextWindow } = await req.json()

        const user = await User.findById(userId)
        const userName = user?.name || 'User'
        const context = await buildFinancialContext(userId, userName)
        const todayDate = new Date().toISOString().split('T')[0]

        const systemPrompt = `
You are Flo, a personal AI financial advisor embedded in a finance tracking app. 
You have access to the user's REAL financial data shown below. Always reference 
their actual numbers — never give generic advice.

Be concise, warm, and use Indian currency (₹). Use emojis sparingly.
When showing lists of transactions, format them as clean markdown tables.
If the user asks to create, update, or delete data, call the matching tool.

Always ask for confirmation before destructive actions (deletes).

=== USER'S FINANCIAL DATA ===
Name: ${context.userName}
Current Month: ${context.currentMonth} ${context.currentYear}

THIS MONTH SO FAR:
- Income: ₹${context.thisMonth.income.toLocaleString()}
- Expenses: ₹${context.thisMonth.expenses.toLocaleString()}
- Savings: ₹${context.thisMonth.savings.toLocaleString()} (${context.thisMonth.savingsRate}% rate)
- Days remaining: ${context.daysLeft}

BUDGET STATUS:
${context.budgetStatus.map(b => `- ${b.category}: ${b.spent}/${b.limit} (${b.percentage}%) - ${b.status}`).join('\n')}

TOP SPENDING CATEGORIES (this month):
${context.topCategories.map(c => `- ${c.category}: ₹${c.total.toLocaleString()} (${c.percentage}%)`).join('\n')}

RECENT TRANSACTIONS (last 10):
| Date | Title | Category | Amount | Type |
|------|-------|----------|--------|------|
${context.recentTransactions.map(tx => `| ${tx.date.split('T')[0]} | ${tx.title} | ${tx.category} | ₹${tx.amount.toLocaleString()} | ${tx.type} |`).join('\n')}

MONTHLY TREND (last 6 months):
| Month | Income | Expense | Savings |
|-------|--------|---------|---------|
${context.monthlyTrend.map(m => `| ${m.month} | ₹${m.income.toLocaleString()} | ₹${m.expense.toLocaleString()} | ₹${m.savings.toLocaleString()} |`).join('\n')}

RECURRING DETECTED:
${context.recurringPayments.length > 0 ? context.recurringPayments.map(r => `- ${r.title}: ₹${r.amount.toLocaleString()} (${r.frequency})`).join('\n') : 'None detected yet.'}
=== END DATA ===

Current page context: ${contextWindow || 'Dashboard'}
Today's date: ${todayDate}
`

        const aiMessages: AIMessage[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: any) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
        ]

        // chat() is an async generator: nothing in its body runs — including
        // the GROQ_API_KEY check and the actual request to Groq — until it's
        // first iterated. Iterating it eagerly here, before the Response (and
        // its 200 status) is constructed, means a missing/invalid key or a
        // bad model name throws into THIS try/catch instead of being caught
        // inside the already-200 SSE stream below.
        const streamIter = chat(aiMessages, toAITools(INTENTS))
        const firstResult = await streamIter.next()

        const encoder = new TextEncoder()
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    let result = firstResult
                    while (!result.done) {
                        const chunk = result.value
                        if (chunk.type === 'text') {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.text })}\n\n`))
                        } else if (chunk.type === 'tool_call') {
                            const parsed = parseIntent(chunk.name, chunk.arguments)
                            if (parsed.ok) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, action: { type: chunk.name, data: parsed.args } })}\n\n`))
                            } else {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: parsed.error })}\n\n`))
                            }
                            // The chat UI acts on one action at a time (each needs its
                            // own confirm card). lib/ai.ts asks Groq for
                            // parallel_tool_calls:false so the model shouldn't propose
                            // more than one, but if it ever does anyway, log it loudly
                            // instead of silently dropping the rest.
                            const next = await streamIter.next()
                            if (!next.done) {
                                console.error('Chat API: model proposed additional tool call(s) beyond the first, which were dropped:', next.value)
                            }
                            return
                        }
                        result = await streamIter.next()
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

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    } catch (error: any) {
        console.error('Chat API Error:', error)
        const errorMessage = error.message || 'Internal server error'
        // Covers both our own "GROQ_API_KEY ... not set" check (a plain Error,
        // no .status) and a real Groq 401 (groq-sdk's APIError.status) —
        // the original substring checks alone never matched either, since
        // neither says "API key" (space-separated) literally.
        const isKeyError = error.status === 401 || /api[\s_-]?key/i.test(errorMessage)
        if (isKeyError || errorMessage.includes('expired') || errorMessage.includes('400')) {
            return NextResponse.json({ error: 'AI Provider Error: Your Groq API key appears to be invalid or expired. Please check your .env.local file.' }, { status: 400 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
})
