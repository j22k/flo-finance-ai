import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

const updateSchema = z
    .object({
        title: z.string().min(1).trim().optional(),
        amount: z.number().positive().optional(),
        type: z.enum(['income', 'expense']).optional(),
        category: z.string().min(1).optional(),
        date: z
            .string()
            .refine((v) => !isNaN(Date.parse(v)))
            .optional(),
        note: z.string().optional(),
        isLent: z.boolean().optional(),
        repaid: z.boolean().optional(),
        paymentMethod: z.enum(['cash', 'upi', 'card', 'bank']).optional(),
        cardId: z.string().optional(),
    })
    .refine((data) => data.paymentMethod !== 'card' || !!data.cardId, {
        message: 'cardId is required when paymentMethod is "card"',
        path: ['cardId'],
    })

export const GET = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const transaction = await Transaction.findById(params.id)

            if (!transaction) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (transaction.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            return NextResponse.json({ transaction })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const PUT = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const transaction = await Transaction.findById(params.id)

            if (!transaction) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (transaction.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            const body = await req.json()
            const validation = updateSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            const updates: any = validation.data

            // card_payment rows are excluded from analytics/budgets/reports by
            // their type alone (no separate flag) — letting the generic
            // transaction form flip type/category/cardId/paymentMethod on one
            // would silently double-count it as a real expense. Amount/date/
            // note edits are still allowed; they don't affect that exclusion.
            if (
                transaction.type === 'card_payment' &&
                (updates.type !== undefined || updates.category !== undefined || updates.cardId !== undefined || updates.paymentMethod !== undefined)
            ) {
                return NextResponse.json(
                    { error: 'Card payments cannot be re-categorized or re-tagged here — delete and re-record it from the Cards page instead.' },
                    { status: 400 }
                )
            }

            if (updates.date) {
                updates.date = new Date(updates.date)
            }

            // Changing paymentMethod away from "card" must drop the stale
            // cardId — the client may omit cardId entirely in that request
            // (JSON drops undefined keys), which would otherwise leave the
            // old reference in place and keep inflating that card's balance.
            const effectivePaymentMethod = updates.paymentMethod ?? transaction.paymentMethod
            if (effectivePaymentMethod !== 'card') {
                updates.cardId = null
            }

            const updated = await Transaction.findByIdAndUpdate(params.id, updates, { new: true })
            return NextResponse.json({ transaction: updated })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const DELETE = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const transaction = await Transaction.findById(params.id)

            if (!transaction) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (transaction.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            await Transaction.findByIdAndDelete(params.id)
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
