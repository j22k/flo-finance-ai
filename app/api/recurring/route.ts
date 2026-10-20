import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import RecurringTransaction from '@/models/RecurringTransaction'
import { withAuth } from '@/lib/middleware'

const createSchema = z
    .object({
        title: z.string().min(1, 'Title required').trim(),
        amount: z.number().positive('Amount must be positive'),
        type: z.enum(['income', 'expense']),
        category: z.string().min(1, 'Category required'),
        note: z.string().optional(),
        frequency: z.enum(['weekly', 'monthly', 'yearly']),
        startDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
        endDate: z
            .string()
            .refine((v) => !isNaN(Date.parse(v)))
            .optional(),
    })
    .refine((data) => !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
        message: 'End date must be on or after the start date',
        path: ['endDate'],
    })

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()
        const recurring = await RecurringTransaction.find({ userId }).sort({ nextRunDate: 1 })
        return NextResponse.json({ recurring })
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

        const { title, amount, type, category, note, frequency, startDate, endDate } = validation.data

        const recurring = await RecurringTransaction.create({
            userId,
            title,
            amount,
            type,
            category,
            note,
            frequency,
            startDate: new Date(startDate),
            nextRunDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
        })

        return NextResponse.json({ recurring }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
