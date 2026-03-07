import { Transaction } from '@/types'
import connectDB from './mongodb'
import TransactionModel from '@/models/Transaction'
import BudgetModel from '@/models/Budget'
import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns'

export interface FinancialContext {
    userName: string
    currentMonth: string
    currentYear: number
    daysLeft: number
    thisMonth: {
        income: number
        expenses: number
        savings: number
        savingsRate: number
        transactionCount: number
    }
    budgetStatus: Array<{
        category: string
        spent: number
        limit: number
        percentage: number
        status: 'ok' | 'warning' | 'over'
    }>
    topCategories: Array<{ category: string; total: number; percentage: number }>
    recentTransactions: Array<{
        date: string
        title: string
        category: string
        type: string
        amount: number
    }>
    monthlyTrend: Array<{
        month: string
        income: number
        expense: number
        savings: number
    }>
    recurringPayments: Array<{
        title: string
        amount: number
        frequency: string
        nextDate: string
    }>
    last90DaysTransactions: Transaction[]
}

export async function buildFinancialContext(userId: string, userName: string = 'User'): Promise<FinancialContext> {
    await connectDB()
    const today = new Date()
    const currentMonthStr = today.toLocaleString('default', { month: 'long' })
    const currentYearNum = today.getFullYear()

    const daysInMonth = new Date(currentYearNum, today.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - today.getDate()

    const startOfCurrentMonth = startOfMonth(today)
    const endOfCurrentMonth = endOfMonth(today)

    // Data fetches
    const last90Days = subDays(today, 90)

    // Transactions this month
    const thisMonthTransactions = await TransactionModel.find({
        userId,
        date: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
    }).sort({ date: -1 }).lean() as unknown as Transaction[]

    // All last 90 days for trends & NL query
    const last90DaysTransactions = await TransactionModel.find({
        userId,
        date: { $gte: last90Days },
    }).sort({ date: -1 }).lean() as unknown as Transaction[]

    // Budgets for this month
    const budgets = await BudgetModel.find({
        userId,
        month: today.getMonth() + 1,
        year: currentYearNum
    }).lean()

    // 1. Calculate this month's stats
    const thisMonth = { income: 0, expenses: 0, savings: 0, savingsRate: 0, transactionCount: thisMonthTransactions.length }
    const categoryTotals: Record<string, number> = {}

    for (const tx of thisMonthTransactions) {
        if (tx.type === 'income') {
            thisMonth.income += tx.amount
        } else {
            thisMonth.expenses += tx.amount
            if (!categoryTotals[tx.category]) {
                categoryTotals[tx.category] = 0
            }
            categoryTotals[tx.category] += tx.amount
        }
    }
    thisMonth.savings = thisMonth.income - thisMonth.expenses
    thisMonth.savingsRate = thisMonth.income > 0 ? Math.round((thisMonth.savings / thisMonth.income) * 100) : 0

    // 2. Budget status
    const budgetStatus = budgets.map((b: any) => {
        const spent = categoryTotals[b.category] || 0
        const percentage = Math.round((spent / b.limitAmount) * 100)
        let status: 'ok' | 'warning' | 'over' = 'ok'
        if (percentage >= 100) status = 'over'
        else if (percentage >= 80) status = 'warning'

        return {
            category: b.category,
            spent,
            limit: b.limitAmount,
            percentage,
            status
        }
    })

    // 3. Top categories this month
    const topCategoriesArray = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, total]) => ({
            category,
            total,
            percentage: thisMonth.expenses > 0 ? Math.round((total / thisMonth.expenses) * 100) : 0
        }))

    // 4. Recent transactions
    const recentTransactions = last90DaysTransactions.slice(0, 10).map(tx => ({
        date: tx.date.toString(),
        title: tx.title,
        category: tx.category,
        type: tx.type,
        amount: tx.amount
    }))

    // 5. Monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
        const targetDate = subMonths(today, i)
        const start = startOfMonth(targetDate)
        const end = endOfMonth(targetDate)

        const txs = await TransactionModel.find({
            userId,
            date: { $gte: start, $lte: end }
        }).lean()

        let inc = 0, exp = 0
        for (const tx of txs) {
            if (tx.type === 'income') inc += tx.amount
            else exp += tx.amount
        }
        monthlyTrend.push({
            month: targetDate.toLocaleString('default', { month: 'short' }),
            income: inc,
            expense: exp,
            savings: inc - exp
        })
    }

    // 6. Simple recurring detection based on last 90 days (title & amount match)
    const expenseGroups: Record<string, { count: number, dates: Date[], amount: number }> = {}
    last90DaysTransactions.forEach(tx => {
        if (tx.type === 'expense') {
            const key = `${tx.title.toLowerCase().trim()}_${tx.amount}`
            if (!expenseGroups[key]) expenseGroups[key] = { count: 0, dates: [], amount: tx.amount }
            expenseGroups[key].count++
            expenseGroups[key].dates.push(new Date(tx.date))
        }
    })

    const recurringPayments = Object.entries(expenseGroups)
        .filter(([, data]) => data.count >= 2)
        .map(([key, data]) => {
            const title = key.split('_')[0]
            // Simple logic: if ~1 month apart, it's monthly
            const latest = new Date(Math.max(...data.dates.map(d => d.getTime())))
            const nextDate = new Date(latest)
            nextDate.setMonth(latest.getMonth() + 1)

            return {
                title: title.charAt(0).toUpperCase() + title.slice(1),
                amount: data.amount,
                frequency: 'monthly',
                nextDate: nextDate.toISOString().split('T')[0]
            }
        })

    return {
        userName,
        currentMonth: currentMonthStr,
        currentYear: currentYearNum,
        daysLeft,
        thisMonth,
        budgetStatus,
        topCategories: topCategoriesArray,
        recentTransactions,
        monthlyTrend,
        recurringPayments,
        last90DaysTransactions: last90DaysTransactions.map(tx => ({ ...tx, _id: tx._id?.toString() }))
    }
}
