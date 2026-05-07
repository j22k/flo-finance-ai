import { NextRequest } from 'next/server'
import { verifyAccessToken } from './auth'

export function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.split(' ')[1]
    return verifyAccessToken(token)
}

export function isAdmin(req: NextRequest) {
    const user = getAuthUser(req)
    return user?.role === 'admin'
}
