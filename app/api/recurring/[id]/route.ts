import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import RecurringTransaction from '@/models/RecurringTransaction'
import { withAuth } from '@/lib/middleware'

const updateSchema = z.object({
    title: z.string().min(1).trim().optional(),
    amount: z.number().positive().optional(),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().min(1).optional(),
    note: z.string().optional(),
    frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
    endDate: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)))
        .optional(),
    isActive: z.boolean().optional(),
})

export const PUT = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const recurring = await RecurringTransaction.findById(params.id)

            if (!recurring) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (recurring.userId.toString() !== userId) {
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

            // Changing the cadence from today avoids regenerating a backlog
            // under the new frequency against the original startDate.
            if (updates.frequency && updates.frequency !== recurring.frequency) {
                recurring.nextRunDate = new Date()
            }

            Object.assign(recurring, updates)
            if (updates.endDate) {
                recurring.endDate = new Date(updates.endDate)
            }

            await recurring.save()
            return NextResponse.json({ recurring })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const DELETE = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const recurring = await RecurringTransaction.findById(params.id)

            if (!recurring) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (recurring.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            await RecurringTransaction.findByIdAndDelete(params.id)
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
