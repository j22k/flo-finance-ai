import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { streamChat, parseActionFromResponse } from '@/lib/gemini'
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
        let fullText = ''

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of responseStream) {
                        const parts = chunk.candidates?.[0]?.content?.parts

                        if (parts) {
                            for (const part of parts) {
                                // Handle regular text
                                if (part.text) {
                                    fullText += part.text
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: part.text })}\n\n`))
                                }

                                // Handle thinking process (if present in new models)
                                if ((part as any).thought) {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: true, thought: (part as any).text })}\n\n`))
                                }

                                // Handle thought signature (from the user's curl output)
                                if ((part as any).thoughtSignature) {
                                    console.log('DEBUG: Thought Signature received:', (part as any).thoughtSignature)
                                    // You could also stream this if the frontend needs it
                                }
                            }
                        }
                    }

                    // Final action parsing
                    const action = parseActionFromResponse(fullText)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, action })}\n\n`))
                } catch (e) {
                    console.error('Streaming error:', e)
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
            return NextResponse.json({ error: 'AI Provider Error: Your Gemini API key appears to be invalid or expired. Please check your .env.local file.' }, { status: 400 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
})
