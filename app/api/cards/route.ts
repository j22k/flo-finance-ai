import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Card from '@/models/Card'
import { withAuth } from '@/lib/middleware'

const createSchema = z.object({
    name: z.string().min(1, 'Name required'),
    last4: z.string().regex(/^\d{4}$/, 'Must be exactly 4 digits'),
    creditLimit: z.number().positive('Credit limit must be positive'),
    apr: z.number().min(0, 'APR cannot be negative'),
    statementDay: z.number().int().min(1).max(31),
    dueDaysAfterStatement: z.number().int().positive('Due days must be positive'),
})

export const GET = withAuth(async (req: NextRequest, { userId }) => {
    try {
        await connectDB()
        const cards = await Card.find({ userId }).sort({ createdAt: -1 })
        return NextResponse.json({ cards })
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

        const card = await Card.create({ ...validation.data, userId })
        return NextResponse.json({ card }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
