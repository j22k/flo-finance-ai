import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from './auth'

export interface AuthenticatedRequest extends NextRequest {
    userId?: string
}

export function withAuth(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (req: NextRequest, context: any) => Promise<Response | NextResponse>
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (req: NextRequest, context: any) => {
        const authHeader = req.headers.get('Authorization')

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const decoded = verifyAccessToken(token)

        if (!decoded) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        return handler(req, { ...context, userId: decoded.userId })
    }
}
