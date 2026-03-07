import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Budget from '@/models/Budget'
import { withAuth } from '@/lib/middleware'

export const DELETE = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const budget = await Budget.findById(params.id)

            if (!budget) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (budget.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            await Budget.findByIdAndDelete(params.id)
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
