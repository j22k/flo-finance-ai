import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    const protectedRoutes = ['/dashboard', '/transactions', '/budgets', '/analytics']
    const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
    const isAuthPage = pathname === '/login' || pathname === '/register'

    const refreshToken = req.cookies.get('refreshToken')?.value

    if (isProtected && !refreshToken) {
        const loginUrl = new URL('/login', req.url)
        return NextResponse.redirect(loginUrl)
    }

    if (isAuthPage && refreshToken) {
        const dashboardUrl = new URL('/dashboard', req.url)
        return NextResponse.redirect(dashboardUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/dashboard/:path*', '/transactions/:path*', '/budgets/:path*', '/analytics/:path*', '/login', '/register'],
}
