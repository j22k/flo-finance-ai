import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Card, { ICard } from '@/models/Card'
import Transaction from '@/models/Transaction'
import { withAuth, findOwned } from '@/lib/middleware'
import { computeCardCycle } from '@/lib/cardCycle'

export const GET = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
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
            const outstanding = spends - payments

            const cycle = computeCardCycle(card, new Date())
            // Interest is never negative, even when outstanding is (an
            // overpayment credit balance) — charging "negative interest"
            // on a credit balance makes no sense.
            const dailyInterestEstimate = (Math.max(0, outstanding) * (card.apr / 100)) / 365

            return NextResponse.json({
                outstanding,
                availableLimit: Math.max(0, card.creditLimit - outstanding),
                usagePercent: Math.round((outstanding / card.creditLimit) * 100),
                ...cycle,
                dailyInterestEstimate,
            })
        } catch (error) {
            console.error('Card summary error:', error)
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
