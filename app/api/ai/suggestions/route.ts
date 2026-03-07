import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { buildFinancialContext } from '@/lib/financialContext'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        const context = await buildFinancialContext(userId)
        const suggestions = []

        // Logic-based suggestions
        const overBudget = context.budgetStatus.find(b => b.status === 'over')
        const warningBudget = context.budgetStatus.find(b => b.status === 'warning')

        if (overBudget) {
            suggestions.push(`Why am I over budget on ${overBudget.category}?`)
        } else if (warningBudget) {
            suggestions.push(`Am I close to any budget limits?`)
        }

        const today = new Date()
        if (today.getDate() > 25) {
            suggestions.push('Give me a summary of this month')
        }

        if (context.thisMonth.savingsRate < 20) {
            suggestions.push('How can I increase my savings rate?')
        } else {
            suggestions.push('How am I doing this month?')
        }

        suggestions.push('Show my recent spending')

        // Ensure we only return 4 max
        return NextResponse.json({ suggestions: suggestions.slice(0, 4) })
    } catch (error) {
        console.error('Suggestions API Error:', error)
        return NextResponse.json({ suggestions: ['How am I doing this month?', 'Show my recent spending'] })
    }
})
