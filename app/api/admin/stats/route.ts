import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import User from '@/models/User'
import Transaction from '@/models/Transaction'
import { getAuthUser } from '@/lib/auth-server'
import { subDays, startOfDay, endOfDay, format } from 'date-fns'

export async function GET(req: NextRequest) {
    try {
        const user = getAuthUser(req)
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        await connectDB()

        const totalUsers = await User.countDocuments({ role: 'user' })
        
        const thirtyDaysAgo = subDays(new Date(), 30)
        const activeUsersList = await Transaction.distinct('userId', {
            date: { $gte: thirtyDaysAgo }
        })
        const activeUsers = activeUsersList.length

        // Activity Chart Data (Last 7 days)
        const activityData = []
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i)
            const start = startOfDay(date)
            const end = endOfDay(date)

            const registrations = await User.countDocuments({
                createdAt: { $gte: start, $lte: end },
                role: 'user'
            })

            const transactions = await Transaction.countDocuments({
                date: { $gte: start, $lte: end }
            })

            activityData.push({
                date: format(date, 'MMM dd'),
                registrations,
                transactions
            })
        }

        return NextResponse.json({
            stats: {
                totalUsers,
                activeUsers,
            },
            activity: activityData
        })
    } catch (error) {
        console.error('Admin stats error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
