import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    date: {
                        $gte: new Date(year, 0, 1),
                        $lte: new Date(year, 11, 31, 23, 59, 59),
                    },
                },
            },
            {
                $group: {
                    _id: { month: { $month: '$date' }, type: '$type' },
                    total: { $sum: '$amount' },
                },
            },
        ])

        const months = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            name: MONTH_NAMES[i],
            income: 0,
            expense: 0,
            savings: 0,
        }))

        result.forEach((r) => {
            const monthIdx = r._id.month - 1
            if (r._id.type === 'income') {
                months[monthIdx].income = r.total
            } else if (r._id.type === 'expense') {
                months[monthIdx].expense = r.total
            }
        })

        months.forEach((m) => {
            m.savings = m.income - m.expense
        })

        return NextResponse.json({ months })
    } catch (error) {
        console.error('Summary analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
