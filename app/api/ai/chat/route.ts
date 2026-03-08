import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { streamChat, parseActionFromResponse } from '@/lib/gemini'
import { buildFinancialContext } from '@/lib/financialContext'
import { createParser } from 'eventsource-parser'
import User from '@/models/User'

export const POST = withAuth(async (req: NextRequest, { userId }) => {
    try {
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
If the user asks to CREATE, UPDATE, or DELETE data, output a special action tag:
[ACTION:{"type":"create_transaction","data":{...}}]
Example data for create_transaction: {"title": "Lunch", "amount": 450, "type": "expense", "category": "Food", "date": "2024-03-07"}

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

        const responseStream = await streamChat(systemPrompt, messages)
        if (!responseStream) throw new Error('No response stream from AI')

        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        let fullText = ''

        const readable = new ReadableStream({
            async start(controller) {
                const parser = createParser({
                    onEvent: (event) => {
                        try {
                            if (event.data === '[DONE]') return
                            const data = JSON.parse(event.data)
                            const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                            if (textChunk) {
                                fullText += textChunk
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: textChunk })}\n\n`))
                            }
                        } catch (e) {
                            // Some chunks might just be heartbeats or metadata, ignore parse errors for those
                        }
                    }
                })

                // @ts-ignore - responseStream is a ReadableStream<Uint8Array>
                for await (const chunk of responseStream) {
                    parser.feed(decoder.decode(chunk))
                }

                // Final action parsing
                const action = parseActionFromResponse(fullText)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, action })}\n\n`))
                controller.close()
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
            return NextResponse.json({ error: 'AI Provider Error: Your Gemini API key appears to be invalid or expired. Please check your .env.local file.' }, { status: 400 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
})
