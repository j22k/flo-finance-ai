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
        if (errorMessage.includes('API key') || errorMessage.includes('expired') || errorMessage.includes('400')) {
            return NextResponse.json({ error: 'AI Provider Error: Your Groq API key appears to be invalid or expired. Please check your .env.local file.' }, { status: 400 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
})
