import jwt from 'jsonwebtoken'

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!

export function signAccessToken(userId: string): string {
    return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' })
}

export function verifyAccessToken(token: string): { userId: string } | null {
    try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as { userId: string }
        return decoded
    } catch {
        return null
    }
}

export function verifyRefreshToken(token: string): { userId: string } | null {
    try {
        const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as { userId: string }
        return decoded
    } catch {
        return null
    }
}
