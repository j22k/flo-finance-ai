import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import { withAuth } from '@/lib/middleware'

const updateSchema = z.object({
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

            const updates = validation.data
            if (updates.date) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ; (updates as any).date = new Date(updates.date)
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
