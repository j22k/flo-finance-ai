'use client'

import { useState } from 'react'
import { Trash2, Plus, X, Target } from 'lucide-react'
import { Goal } from '@/types'
import { format, differenceInCalendarDays, addDays } from 'date-fns'

interface GoalCardProps {
    goal: Goal
    onDelete: (id: string) => void
    onAddContribution: (id: string, data: { amount: number; note?: string }) => Promise<void>
}

export default function GoalCard({ goal, onDelete, onAddContribution }: GoalCardProps) {
    const [showModal, setShowModal] = useState(false)
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
    const isComplete = goal.currentAmount >= goal.targetAmount
    const targetDate = new Date(goal.targetDate)
    const now = new Date()
    const daysRemaining = differenceInCalendarDays(targetDate, now)

    const daysSinceCreation = Math.max(1, differenceInCalendarDays(now, new Date(goal.createdAt)))
    const avgDailyRate = goal.currentAmount / daysSinceCreation

    let projectionLabel: string | null = null
    let onTrack = true
    if (!isComplete) {
        if (goal.currentAmount <= 0 || avgDailyRate <= 0) {
            projectionLabel = 'Add a contribution to see a projection'
        } else {
            const remaining = goal.targetAmount - goal.currentAmount
            const daysNeeded = Math.ceil(remaining / avgDailyRate)
            const projectedDate = addDays(now, daysNeeded)
            onTrack = projectedDate <= targetDate
            projectionLabel = `At this pace, you'll reach it by ${format(projectedDate, 'MMM d, yyyy')}`
        }
    }

    const statusColor = isComplete ? 'var(--income)' : onTrack ? 'var(--income)' : 'var(--expense)'
    const progressColor = isComplete || onTrack ? 'progress-green' : 'progress-red'

    const handleAddContribution = async (e: React.FormEvent) => {
        e.preventDefault()
        const value = parseFloat(amount)
        if (!value || value <= 0) return

        setSubmitting(true)
        try {
            await onAddContribution(goal._id, { amount: value, note: note || undefined })
            setAmount('')
            setNote('')
            setShowModal(false)
        } catch {
            // handled by hook
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flo-card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>{goal.title}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {isComplete ? 'Goal reached!' : daysRemaining >= 0 ? `${daysRemaining} days left` : 'Target date passed'} · {format(targetDate, 'MMM d, yyyy')}
                    </p>
                </div>
                <button
                    onClick={() => onDelete(goal._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px' }}
                    title="Delete goal"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span className="amount" style={{ fontSize: '1.3rem', fontWeight: 700, color: statusColor }}>
                    ₹{goal.currentAmount.toLocaleString()}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    of <span className="amount">₹{goal.targetAmount.toLocaleString()}</span>
                </span>
            </div>

            <div className="progress-bar" style={{ marginBottom: '8px' }}>
                <div className={`progress-fill ${progressColor}`} style={{ width: `${percentage}%` }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor }}>
                    {Math.round(percentage)}% funded
                </span>
            </div>

            {projectionLabel && (
                <p style={{ fontSize: '0.75rem', marginBottom: '12px', color: onTrack ? 'var(--muted)' : 'var(--expense)', fontWeight: onTrack ? 400 : 600 }}>
                    {projectionLabel}
                </p>
            )}

            <button
                onClick={() => setShowModal(true)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
            >
                <Plus size={16} /> Add contribution
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Target size={18} color="var(--accent)" /> Add Contribution
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddContribution}>
                            <div style={{ marginBottom: '14px' }}>
                                <label className="flo-label">Amount (₹)</label>
                                <input
                                    className="flo-input amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div style={{ marginBottom: '20px' }}>
                                <label className="flo-label">Note (optional)</label>
                                <input
                                    className="flo-input"
                                    placeholder="e.g. Bonus savings"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 2, justifyContent: 'center' }}>
                                    {submitting ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
