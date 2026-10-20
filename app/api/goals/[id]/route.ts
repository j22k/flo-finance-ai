import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Goal from '@/models/Goal'
import { withAuth } from '@/lib/middleware'

const updateSchema = z.object({
    title: z.string().min(1).trim().optional(),
    targetAmount: z.number().positive().optional(),
    targetDate: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)))
        .optional(),
})

export const PUT = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const goal = await Goal.findById(params.id)

            if (!goal) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (goal.userId.toString() !== userId) {
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
            if (updates.targetDate) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ; (updates as any).targetDate = new Date(updates.targetDate)
            }

            const updated = await Goal.findByIdAndUpdate(params.id, updates, { new: true })
            return NextResponse.json({ goal: updated })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)

export const DELETE = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const goal = await Goal.findById(params.id)

            if (!goal) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }

            if (goal.userId.toString() !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            await Goal.findByIdAndDelete(params.id)
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
