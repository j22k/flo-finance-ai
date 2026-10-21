import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'
import { differenceInCalendarDays, differenceInCalendarMonths, startOfMonth, endOfMonth } from 'date-fns'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const now = new Date()
        const { searchParams } = new URL(req.url)
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : now.getMonth() + 1
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear()
        // The "current period" being compared for overspending — defaults
        // to today, but follows the page's month/year selector when passed.
        const selectedPeriod = new Date(year, month - 1, 1)

        const earliest = await Transaction.findOne({ userId, type: 'expense' }).sort({ date: 1 })

        if (!earliest) {
            return NextResponse.json({ avgDaily: 0, avgMonthly: 0, avgYearly: 0, monthsTracked: 0, overspending: [] })
        }

        const rangeStart = new Date(earliest.date)
        const currentMonthStart = startOfMonth(selectedPeriod)
        const currentMonthEnd = endOfMonth(selectedPeriod)

        const totalDays = Math.max(1, differenceInCalendarDays(now, rangeStart) + 1)
        const monthsInRange = Math.max(1, differenceInCalendarMonths(now, rangeStart) + 1)
        // Months strictly before the selected period — the denominator for
        // each category's historical average, so the selected month is
        // compared against its own history rather than diluting/including itself.
        const monthsBeforeCurrent = Math.max(1, differenceInCalendarMonths(currentMonthStart, rangeStart))
        const yearsInRange = Math.max(1, monthsInRange / 12)

        const userObjectId = new Types.ObjectId(userId)

        const [totalResult, currentMonthByCategory, historicalByCategory] = await Promise.all([
            Transaction.aggregate([
                { $match: { userId: userObjectId, type: 'expense' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
                { $match: { userId: userObjectId, type: 'expense', date: { $gte: currentMonthStart, $lte: currentMonthEnd } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
                { $match: { userId: userObjectId, type: 'expense', date: { $lt: currentMonthStart } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
        ])

        const totalAllTime = totalResult[0]?.total || 0

        const currentMap = new Map(currentMonthByCategory.map((r) => [r._id as string, r.total as number]))
        const historicalMap = new Map(historicalByCategory.map((r) => [r._id as string, r.total as number]))
        const categories = new Set(Array.from(currentMap.keys()).concat(Array.from(historicalMap.keys())))

        const overspending = Array.from(categories)
            .map((category) => {
                const current = currentMap.get(category) || 0
                const historicalTotal = historicalMap.get(category) || 0
                const historicalAvg = historicalTotal / monthsBeforeCurrent
                const overAmount = current - historicalAvg
                const overPercent = historicalAvg > 0 ? Math.round((overAmount / historicalAvg) * 100) : (current > 0 ? null : 0)
                return { category, current, historicalAvg, overAmount, overPercent }
            })
            .filter((c) => c.overAmount > 0)
            .sort((a, b) => b.overAmount - a.overAmount)
            .slice(0, 5)

        return NextResponse.json({
            avgDaily: totalAllTime / totalDays,
            avgMonthly: totalAllTime / monthsInRange,
            avgYearly: totalAllTime / yearsInRange,
            monthsTracked: monthsInRange,
            overspending,
        })
    } catch (error) {
        console.error('Averages analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
