import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    $or: [
                        { isLent: true },
                        { category: { $regex: /lent/i } }
                    ]
                },
            },
            {
                $group: {
                    _id: '$repaid',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    transactions: { 
                        $push: {
                            _id: '$_id',
                            title: '$title',
                            amount: '$amount',
                            date: '$date',
                            repaid: '$repaid'
                        }
                    }
                },
            },
        ])

        const lentStats = {
            totalLent: 0,
            totalRepaid: 0,
            pendingAmount: 0,
            pendingCount: 0,
            repaidCount: 0,
            recentLent: [] as any[]
        }

        result.forEach(r => {
            if (r._id === true) {
                lentStats.totalRepaid = r.total
                lentStats.repaidCount = r.count
            } else {
                lentStats.totalLent += r.total
                lentStats.pendingAmount += r.total
                lentStats.pendingCount += r.count
                lentStats.recentLent.push(...r.transactions)
            }
        })

        // Total lent is both repaid and pending
        lentStats.totalLent = lentStats.totalRepaid + lentStats.pendingAmount
        
        // Sort recent lent by date
        lentStats.recentLent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        lentStats.recentLent = lentStats.recentLent.slice(0, 5)

        return NextResponse.json(lentStats)
    } catch (error) {
        console.error('Lent analytics error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
