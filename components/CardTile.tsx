'use client'

import { useState } from 'react'
import { Trash2, Plus, X, CreditCard, Wallet } from 'lucide-react'
import { Card, CardSummary } from '@/types'

interface CardTileProps {
    card: Card
    summary: CardSummary | null
    onDelete: (id: string) => void
    onRecordPayment: (cardId: string, data: { amount: number }) => Promise<void>
}

export default function CardTile({ card, summary, onDelete, onRecordPayment }: CardTileProps) {
    const [showModal, setShowModal] = useState(false)
    const [amount, setAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const usagePercent = summary?.usagePercent ?? 0
    const outstanding = summary?.outstanding ?? 0
    const availableLimit = summary?.availableLimit ?? card.creditLimit

    const progressColor = usagePercent > 85 ? 'progress-red' : usagePercent > 60 ? 'progress-yellow' : 'progress-green'
    const statusColor = usagePercent > 85 ? 'var(--expense)' : usagePercent > 60 ? 'var(--warning)' : 'var(--income)'

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        const value = parseFloat(amount)
        if (!value || value <= 0) return

        setSubmitting(true)
        try {
            await onRecordPayment(card._id, { amount: value })
            setAmount('')
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'rgba(124,106,247,0.15)', padding: '8px', borderRadius: '10px' }}>
                        <CreditCard size={18} color="var(--accent)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>{card.name}</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>•••• {card.last4}</p>
                    </div>
                </div>
                <button
                    onClick={() => onDelete(card._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px' }}
                    title="Remove card"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span className="amount" style={{ fontSize: '1.3rem', fontWeight: 700, color: statusColor }}>
                    ₹{outstanding.toLocaleString()}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    of <span className="amount">₹{card.creditLimit.toLocaleString()}</span>
                </span>
            </div>

            <div className="progress-bar" style={{ marginBottom: '8px' }}>
                {/* usagePercent can go negative if payments exceed recorded
                    spend (a credit balance) — the number itself is accurate,
                    clamp only the bar's rendered width. */}
                <div className={`progress-fill ${progressColor}`} style={{ width: `${Math.max(0, Math.min(usagePercent, 100))}%` }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: statusColor }}>
                    ₹{availableLimit.toLocaleString()} available
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {usagePercent}%
                </span>
            </div>

            <button
                onClick={() => setShowModal(true)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
            >
                <Plus size={16} /> Record Payment
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wallet size={18} color="var(--accent)" /> Record Payment
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleRecordPayment}>
                            <div style={{ marginBottom: '20px' }}>
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
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 2, justifyContent: 'center' }}>
                                    {submitting ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : 'Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
