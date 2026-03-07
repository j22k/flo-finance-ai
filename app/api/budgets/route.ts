import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Budget from '@/models/Budget'
import { withAuth } from '@/lib/middleware'

const createSchema = z.object({
    category: z.string().min(1, 'Category required'),
    limitAmount: z.number().positive('Limit must be positive'),
    month: z.number().min(1).max(12),
    year: z.number().min(2000).max(2100),
})

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = { userId }

        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null

        if (month) query.month = month
        if (year) query.year = year

        const budgets = await Budget.find(query).sort({ category: 1 })
        return NextResponse.json({ budgets })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})

export const POST = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const body = await req.json()
        const validation = createSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: validation.error.errors },
                { status: 422 }
            )
        }

        const { category, limitAmount, month, year } = validation.data

        const budget = await Budget.findOneAndUpdate(
            { userId, category, month, year },
            { userId, category, limitAmount, month, year },
            { upsert: true, new: true }
        )

        return NextResponse.json({ budget })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
