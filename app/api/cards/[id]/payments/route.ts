import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Card, { ICard } from '@/models/Card'
import Transaction from '@/models/Transaction'
import { withAuth, findOwned } from '@/lib/middleware'

const createSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    date: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)))
        .optional(),
    note: z.string().optional(),
})

export const POST = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const { doc: card, error } = await findOwned<ICard>(Card, params.id, userId)
            if (error) return error

            const body = await req.json()
            const validation = createSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            const { amount, date, note } = validation.data

            const transaction = await Transaction.create({
                userId,
                cardId: card._id,
                type: 'card_payment',
                category: 'Card Payment',
                title: `Payment to ${card.name}`,
                amount,
                date: date ? new Date(date) : new Date(),
                note,
            })

            return NextResponse.json({ transaction }, { status: 201 })
        } catch (error) {
            console.error('Card payment error:', error)
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
