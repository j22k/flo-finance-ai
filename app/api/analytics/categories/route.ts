import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        const now = new Date()
        const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
        const year = parseInt(searchParams.get('year') || String(now.getFullYear()))

        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0, 23, 59, 59)

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    type: 'expense',
                    date: { $gte: monthStart, $lte: monthEnd },
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { total: -1 } },
        ])

        const totalExpense = result.reduce((sum, r) => sum + r.total, 0)

        const categories = result.map((r) => ({
            category: r._id,
            total: r.total,
            count: r.count,
            percentage: totalExpense > 0 ? Math.round((r.total / totalExpense) * 100) : 0,
        }))

        return NextResponse.json({ categories })
    } catch (error) {
        console.error('Categories analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
