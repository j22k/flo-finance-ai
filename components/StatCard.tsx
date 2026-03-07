'use client'

import { LucideIcon } from 'lucide-react'

interface StatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    color: string
    gradient: string
    sub?: string
}

export default function StatCard({ title, value, icon: Icon, color, gradient, sub }: StatCardProps) {
    return (
        <div
            className="flo-card"
            style={{
                background: `linear-gradient(135deg, var(--surface) 0%, ${gradient} 100%)`,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: `${color}10`,
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        {title}
                    </p>
                    <p className="amount" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                        {value}
                    </p>
                    {sub && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '6px' }}>{sub}</p>
                    )}
                </div>
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${color}20`,
                        border: `1px solid ${color}30`,
                    }}
                >
                    <Icon size={22} color={color} />
                </div>
            </div>
        </div>
    )
}
