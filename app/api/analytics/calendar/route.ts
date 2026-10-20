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
        const daysInMonth = new Date(year, month, 0).getDate()

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
                    _id: { $dayOfMonth: '$date' },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ])

        const totalsByDay = new Map(result.map((r) => [r._id, { total: r.total, count: r.count }]))

        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const entry = totalsByDay.get(day)
            return { day, total: entry?.total || 0, count: entry?.count || 0 }
        })

        return NextResponse.json({ days, month, year })
    } catch (error) {
        console.error('Calendar analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
