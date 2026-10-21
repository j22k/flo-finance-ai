import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Card, { ICard } from '@/models/Card'
import { withAuth, findOwned } from '@/lib/middleware'

const updateSchema = z.object({
    name: z.string().min(1).optional(),
    last4: z.string().regex(/^\d{4}$/, 'Must be exactly 4 digits').optional(),
    creditLimit: z.number().positive().optional(),
    apr: z.number().min(0).optional(),
    statementDay: z.number().int().min(1).max(31).optional(),
    dueDaysAfterStatement: z.number().int().positive().optional(),
})

export const GET = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const { doc: card, error } = await findOwned<ICard>(Card, params.id, userId)
            if (error) return error

            return NextResponse.json({ card })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const PATCH = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const { doc: card, error } = await findOwned<ICard>(Card, params.id, userId)
            if (error) return error

            const body = await req.json()
            const validation = updateSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            const updated = await Card.findByIdAndUpdate(card._id, validation.data, { new: true })
            return NextResponse.json({ card: updated })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const DELETE = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const { doc: card, error } = await findOwned<ICard>(Card, params.id, userId)
            if (error) return error

            // Soft delete: a hard delete would orphan cardId references on any
            // transactions already tagged to this card, with no recovery path.
            await Card.findByIdAndUpdate(card._id, { isActive: false })
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
