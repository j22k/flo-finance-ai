import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Goal, { IGoal } from '@/models/Goal'
import { withAuth, findOwned } from '@/lib/middleware'

const contributionSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    note: z.string().optional(),
    date: z
        .string()
        .refine((v) => !isNaN(Date.parse(v)))
        .optional(),
})

export const POST = withAuth(
    async (req: NextRequest, { params, userId }: { params: { id: string }; userId: string }) => {
        try {
            await connectDB()
            const { doc: goal, error } = await findOwned<IGoal>(Goal, params.id, userId)
            if (error) return error

            const body = await req.json()
            const validation = contributionSchema.safeParse(body)

            if (!validation.success) {
                return NextResponse.json(
                    { error: 'Validation failed', details: validation.error.errors },
                    { status: 422 }
                )
            }

            const { amount, note, date } = validation.data

            goal.contributions.push({ amount, note, date: date ? new Date(date) : new Date() })
            goal.currentAmount += amount
            await goal.save()

            return NextResponse.json({ goal })
        } catch (error) {
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
)
