import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

const createSchema = z.object({
    title: z.string().min(1, 'Title required').trim(),
    amount: z.number().positive('Amount must be positive'),
    type: z.enum(['income', 'expense']),
    category: z.string().min(1, 'Category required'),
    date: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
    note: z.string().optional(),
})

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()

        const { searchParams } = new URL(req.url)
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
        const category = searchParams.get('category')
        const type = searchParams.get('type')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = { userId }

        if (month && year) {
            const start = new Date(year, month - 1, 1)
            const end = new Date(year, month, 0, 23, 59, 59)
            query.date = { $gte: start, $lte: end }
        } else if (year) {
            query.date = {
                $gte: new Date(year, 0, 1),
                $lte: new Date(year, 11, 31, 23, 59, 59),
            }
        }

        if (category && category !== 'all') query.category = category
        if (type && type !== 'all') query.type = type

        const [transactions, total] = await Promise.all([
            Transaction.find(query).sort({ date: -1 }).skip(skip).limit(limit),
            Transaction.countDocuments(query),
        ])

        return NextResponse.json({
            transactions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        })
    } catch (error) {
        console.error('Get transactions error:', error)
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

        const { title, amount, type, category, date, note } = validation.data

        const transaction = await Transaction.create({
            userId,
            title,
            amount,
            type,
            category,
            date: new Date(date),
            note,
        })

        return NextResponse.json({ transaction }, { status: 201 })
    } catch (error) {
        console.error('Create transaction error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
