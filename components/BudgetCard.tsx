'use client'

import { Trash2 } from 'lucide-react'
import { Budget } from '@/types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface BudgetCardProps {
    budget: Budget
    spent: number
    onDelete: (id: string) => void
}

export default function BudgetCard({ budget, spent, onDelete }: BudgetCardProps) {
    const percentage = Math.min((spent / budget.limitAmount) * 100, 100)
    const remaining = budget.limitAmount - spent
    const isOver = spent > budget.limitAmount

    const progressColor = isOver || percentage > 85 ? 'progress-red' : percentage > 60 ? 'progress-yellow' : 'progress-green'
    const statusColor = isOver || percentage > 85 ? 'var(--expense)' : percentage > 60 ? 'var(--warning)' : 'var(--income)'

    const now = new Date()
    const isCurrentMonth = budget.month === now.getMonth() + 1 && budget.year === now.getFullYear()
    const daysElapsed = now.getDate()
    const daysInMonth = new Date(budget.year, budget.month, 0).getDate()
    const projected = isCurrentMonth && spent > 0 ? (spent / daysElapsed) * daysInMonth : null
    const willExceed = projected !== null && projected > budget.limitAmount

    return (
        <div className="flo-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>{budget.category}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {MONTH_NAMES[budget.month - 1]} {budget.year}
                    </p>
                </div>
                <button
                    onClick={() => onDelete(budget._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px', transition: 'color 0.2s' }}
                    title="Delete budget"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Amounts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span className="amount" style={{ fontSize: '1.3rem', fontWeight: 700, color: statusColor }}>
                    ₹{spent.toLocaleString()}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    of <span className="amount">₹{budget.limitAmount.toLocaleString()}</span>
                </span>
            </div>

            {/* Progress bar */}
            <div className="progress-bar" style={{ marginBottom: '8px' }}>
                <div
                    className={`progress-fill ${progressColor}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>

            {/* Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor }}>
                    {isOver
                        ? `Over budget by ₹${(spent - budget.limitAmount).toLocaleString()}`
                        : `₹${remaining.toLocaleString()} remaining`}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {Math.round(percentage)}%
                </span>
            </div>

            {projected !== null && !isOver && (
                <p style={{ fontSize: '0.75rem', marginTop: '10px', color: willExceed ? 'var(--expense)' : 'var(--muted)', fontWeight: willExceed ? 600 : 400 }}>
                    {willExceed
                        ? `At this rate, you'll spend ₹${Math.round(projected).toLocaleString()} by month end`
                        : `On track to spend ₹${Math.round(projected).toLocaleString()} by month end`}
                </p>
            )}
        </div>
    )
}
