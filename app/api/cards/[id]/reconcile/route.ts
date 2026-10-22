import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Card, { ICard } from '@/models/Card'
import Transaction from '@/models/Transaction'
import { withAuth, findOwned } from '@/lib/middleware'

const reconcileSchema = z.object({
    bankOutstanding: z.number(),
})

export const POST = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            let body: unknown
            try {
                body = await req.json()
            } catch {
                return NextResponse.json({ error: 'Invalid JSON body' }, { status: 422 })
            }
            const validation = reconcileSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            await connectDB()
            const { doc: card, error } = await findOwned<ICard>(Card, params.id, userId)
            if (error) return error

            const result = await Transaction.aggregate([
                {
                    $match: {
                        userId: new Types.ObjectId(userId),
                        cardId: card._id,
                        type: { $in: ['expense', 'card_payment'] },
                    },
                },
                { $group: { _id: '$type', total: { $sum: '$amount' } } },
            ])

            const totals = new Map(result.map((r) => [r._id as string, r.total as number]))
            const spends = totals.get('expense') || 0
            const payments = totals.get('card_payment') || 0
            const computedOutstanding = spends - payments

            const { bankOutstanding } = validation.data

            return NextResponse.json({
                computedOutstanding,
                bankOutstanding,
                difference: bankOutstanding - computedOutstanding,
            })
        } catch (error) {
            console.error('Card reconcile error:', error)
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
