'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Waves, LayoutDashboard, ArrowLeftRight, PiggyBank, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
    { href: '/budgets', icon: PiggyBank, label: 'Budgets' },
    { href: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { user, logout } = useAuth()

    const handleLogout = async () => {
        await logout()
        toast.success('Signed out')
        router.push('/login')
    }

    const initials = user?.name
        ? user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : '??'

    return (
        <aside className="fixed bottom-0 md:top-0 left-0 right-0 md:bottom-0 md:w-[240px] bg-[var(--surface)] border-t md:border-t-0 md:border-r border-[var(--border)] flex flex-row md:flex-col z-50">
            {/* Logo */}
            <div className="hidden md:flex p-6 border-b border-[var(--border)]">
                <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <div style={{ background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)', borderRadius: '10px', padding: '6px' }}>
                        <Waves size={22} color="white" />
                    </div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-outfit)' }} className="gradient-text">
                        Flo
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-row md:flex-col px-2 py-2 md:p-4 justify-around md:justify-start overflow-x-auto items-center md:items-stretch">
                <p className="hidden md:block text-[0.7rem] font-bold text-[var(--muted)] uppercase tracking-widest px-2 mb-2">
                    Menu
                </p>
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href
                    return (
                        <Link
                            key={href}
                            href={href}
                            style={{ textDecoration: 'none' }}
                            className={`flex flex-col md:flex-row items-center gap-1 md:gap-2.5 p-2 md:py-2.5 md:px-3 rounded-lg md:mb-1.5 transition-all outline-none ${isActive
                                    ? 'bg-[rgba(124,106,247,0.15)] text-[var(--accent-light)] md:border-l-2 md:border-l-[var(--accent)]'
                                    : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.02)] border-l-2 border-transparent'
                                }`}
                        >
                            <Icon size={20} className={isActive ? 'text-[var(--accent-light)]' : 'text-[var(--muted)]'} />
                            <span className="text-[0.65rem] md:text-[0.9rem] font-medium md:font-semibold">{label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* User info */}
            <div className="hidden md:block p-4 border-t border-[var(--border)]">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'white',
                            flexShrink: 0,
                        }}
                    >
                        {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.name || 'User'}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.email || ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="btn-secondary w-full justify-center p-2 text-[0.85rem]"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </div>
        </aside>
    )
}
