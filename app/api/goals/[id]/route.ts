import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Goal, { IGoal } from '@/models/Goal'
import { withAuth, findOwned } from '@/lib/middleware'

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
            const { doc: goal, error } = await findOwned<IGoal>(Goal, params.id, userId)
            if (error) return error

            const body = await req.json()
            const validation = updateSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            const { targetDate, ...rest } = validation.data
            const dbUpdates = { ...rest, ...(targetDate && { targetDate: new Date(targetDate) }) }

            const updated = await Goal.findByIdAndUpdate(goal._id, dbUpdates, { new: true })
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
            const { doc: goal, error } = await findOwned<IGoal>(Goal, params.id, userId)
            if (error) return error

            await Goal.findByIdAndDelete(goal._id)
            return NextResponse.json({ message: 'Deleted' })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
