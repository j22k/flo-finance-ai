'use client'

import { useState } from 'react'
import { X, CreditCard } from 'lucide-react'
import { Card } from '@/types'

interface CardFormProps {
    onSubmit: (data: {
        name: string
        last4: string
        creditLimit: number
        apr: number
        statementDay: number
        dueDaysAfterStatement: number
    }) => Promise<void>
    onClose: () => void
    initialData?: Card
}

export default function CardForm({ onSubmit, onClose, initialData }: CardFormProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        last4: initialData?.last4 || '',
        creditLimit: initialData?.creditLimit?.toString() || '',
        apr: initialData?.apr?.toString() || '',
        statementDay: initialData?.statementDay?.toString() || '',
        dueDaysAfterStatement: initialData?.dueDaysAfterStatement?.toString() || '',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)

    const validate = () => {
        const errs: Record<string, string> = {}
        if (!formData.name.trim()) errs.name = 'Name is required'
        if (!/^\d{4}$/.test(formData.last4)) errs.last4 = 'Must be exactly 4 digits'
        if (!formData.creditLimit || parseFloat(formData.creditLimit) <= 0) errs.creditLimit = 'Must be positive'
        if (!formData.apr || parseFloat(formData.apr) < 0) errs.apr = 'Cannot be negative'
        const day = parseInt(formData.statementDay)
        if (!day || day < 1 || day > 31) errs.statementDay = 'Must be between 1 and 31'
        if (!formData.dueDaysAfterStatement || parseInt(formData.dueDaysAfterStatement) <= 0) errs.dueDaysAfterStatement = 'Must be positive'
        return errs
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const errs = validate()
        setErrors(errs)
        if (Object.keys(errs).length > 0) return

        setLoading(true)
        try {
            await onSubmit({
                name: formData.name.trim(),
                last4: formData.last4,
                creditLimit: parseFloat(formData.creditLimit),
                apr: parseFloat(formData.apr),
                statementDay: parseInt(formData.statementDay),
                dueDaysAfterStatement: parseInt(formData.dueDaysAfterStatement),
            })
            onClose()
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={20} color="var(--accent)" />
                        {initialData ? 'Edit Card' : 'Add Card'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', borderRadius: '8px', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="flo-label">Card Name</label>
                            <input
                                className="flo-input"
                                placeholder="e.g. HDFC Millennia"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                            {errors.name && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.name}</p>}
                        </div>

                        <div>
                            <label className="flo-label">Last 4 Digits</label>
                            <input
                                className="flo-input"
                                placeholder="4242"
                                maxLength={4}
                                value={formData.last4}
                                onChange={(e) => setFormData({ ...formData, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            />
                            {errors.last4 && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.last4}</p>}
                        </div>

                        <div>
                            <label className="flo-label">Credit Limit (₹)</label>
                            <input
                                className="flo-input amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="50000"
                                value={formData.creditLimit}
                                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                            />
                            {errors.creditLimit && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.creditLimit}</p>}
                        </div>

                        <div>
                            <label className="flo-label">APR (%)</label>
                            <input
                                className="flo-input"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="36"
                                value={formData.apr}
                                onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                            />
                            {errors.apr && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.apr}</p>}
                        </div>

                        <div>
                            <label className="flo-label">Statement Day</label>
                            <input
                                className="flo-input"
                                type="number"
                                min="1"
                                max="31"
                                placeholder="5"
                                value={formData.statementDay}
                                onChange={(e) => setFormData({ ...formData, statementDay: e.target.value })}
                            />
                            {errors.statementDay && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.statementDay}</p>}
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="flo-label">Due Days After Statement</label>
                            <input
                                className="flo-input"
                                type="number"
                                min="1"
                                placeholder="20"
                                value={formData.dueDaysAfterStatement}
                                onChange={(e) => setFormData({ ...formData, dueDaysAfterStatement: e.target.value })}
                            />
                            {errors.dueDaysAfterStatement && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.dueDaysAfterStatement}</p>}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                            {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : initialData ? 'Update' : 'Add Card'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
