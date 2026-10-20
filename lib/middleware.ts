import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
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

// Collapses the repeated findById -> 404-if-missing -> 403-if-not-owner
// pattern used by every [id] route. A 404-vs-403 distinction leaks whether
// an id exists to someone probing it; this returns 404 for both so an
// unauthenticated guess can't tell the difference.
export async function findOwned<T extends { userId: Types.ObjectId }>(
    model: { findById: (id: string) => Promise<T | null> },
    id: string,
    userId: string
): Promise<{ doc: T; error?: undefined } | { doc?: undefined; error: NextResponse }> {
    const doc = await model.findById(id)

    if (!doc || doc.userId.toString() !== userId) {
        return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }

    return { doc }
}
