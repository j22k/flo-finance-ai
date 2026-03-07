import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { executeChatAction } from '@/lib/chatActions'

export const POST = withAuth(async (req: NextRequest, { userId }) => {
    try {
        const { action } = await req.json()

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 })
        }

        const result = await executeChatAction(action, userId)

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Action failed' }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('Quick Action API Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
})
