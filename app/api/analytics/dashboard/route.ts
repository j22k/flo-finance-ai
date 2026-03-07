import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    date: { $gte: monthStart, $lte: monthEnd },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ])

        let income = 0
        let expense = 0
        let transactionCount = 0

        result.forEach((r) => {
            if (r._id === 'income') {
                income = r.total
                transactionCount += r.count
            } else if (r._id === 'expense') {
                expense = r.total
                transactionCount += r.count
            }
        })

        const savings = income - expense
        const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0

        return NextResponse.json({
            income,
            expense,
            savings,
            savingsRate,
            transactionCount,
        })
    } catch (error) {
        console.error('Dashboard analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
