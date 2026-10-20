import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Goal from '@/models/Goal'
import { withAuth } from '@/lib/middleware'

const createSchema = z.object({
    title: z.string().min(1, 'Title required').trim(),
    targetAmount: z.number().positive('Target amount must be positive'),
    targetDate: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date'),
})

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()
        const goals = await Goal.find({ userId }).sort({ targetDate: 1 })
        return NextResponse.json({ goals })
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

        const { title, targetAmount, targetDate } = validation.data

        const goal = await Goal.create({
            userId,
            title,
            targetAmount,
            targetDate: new Date(targetDate),
        })

        return NextResponse.json({ goal }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
