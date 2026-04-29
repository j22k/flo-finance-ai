'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { Transaction, CATEGORIES } from '@/types'
import { format } from 'date-fns'
import { useCategories } from '@/hooks/useCategories'

interface TransactionFormProps {
    onSubmit: (data: Omit<Transaction, '_id' | 'createdAt'>) => Promise<void>
    onClose: () => void
    initialData?: Transaction
}

export default function TransactionForm({ onSubmit, onClose, initialData }: TransactionFormProps) {
    const { categories, fetchCategories } = useCategories()
    const [type, setType] = useState<'income' | 'expense'>(initialData?.type || 'expense')
    
    // Derived categories for the current type
    const availableCategories = categories.filter(c => c.type === type).map(c => c.name)
    const baseCategories = CATEGORIES.filter(c => type === 'expense' ? c !== 'Salary' && c !== 'Freelance' && c !== 'Investment' : c === 'Salary' || c === 'Freelance' || c === 'Investment')
    const options = Array.from(new Set([...baseCategories, ...availableCategories]))

    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        amount: initialData?.amount?.toString() || '',
        category: initialData?.category || CATEGORIES[0],
        date: initialData?.date ? format(new Date(initialData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        note: initialData?.note || '',
        isLent: initialData?.isLent || false,
        repaid: initialData?.repaid || false,
    })

    const optionsStr = options.join(',')
    useEffect(() => {
        if (options.length > 0 && !options.includes(formData.category)) {
            setFormData((prev) => ({ ...prev, category: options[0] }))
        }
    }, [optionsStr, formData.category])
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)

    const validate = () => {
        const errs: Record<string, string> = {}
        if (!formData.title.trim()) errs.title = 'Title is required'
        if (!formData.amount || parseFloat(formData.amount) <= 0) errs.amount = 'Amount must be positive'
        if (!formData.date) errs.date = 'Date is required'
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
                title: formData.title.trim(),
                amount: parseFloat(formData.amount),
                type,
                category: formData.category,
                date: formData.date,
                note: formData.note || undefined,
                isLent: formData.isLent,
                repaid: formData.repaid,
            } as Omit<Transaction, '_id' | 'createdAt'>)
            onClose()
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false)
        }
    }

    // Close on ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-content">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {initialData ? 'Edit Transaction' : 'New Transaction'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', borderRadius: '8px', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Type Toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px' }}>
                    {(['expense', 'income'] as const).map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setType(t)}
                            style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontFamily: 'var(--font-outfit)',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                transition: 'all 0.2s',
                                background: type === t ? (t === 'income' ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 138, 0.2)') : 'transparent',
                                color: type === t ? (t === 'income' ? 'var(--income)' : 'var(--expense)') : 'var(--muted)',
                            }}
                        >
                            {t === 'income' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Title */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="flo-label">Title</label>
                            <input
                                className="flo-input"
                                placeholder="e.g. Monthly Rent"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                            {errors.title && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.title}</p>}
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="flo-label">Amount (₹)</label>
                            <input
                                className="flo-input amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                            {errors.amount && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.amount}</p>}
                        </div>

                        {/* Date */}
                        <div>
                            <label className="flo-label">Date</label>
                            <input
                                className="flo-input"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                style={{ colorScheme: 'dark' }}
                            />
                            {errors.date && <p style={{ color: 'var(--expense)', fontSize: '0.75rem', marginTop: '4px' }}>{errors.date}</p>}
                        </div>

                        {/* Category */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="flo-label">Category</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    className="flo-select"
                                    style={{ flex: 1 }}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {options.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Note */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="flo-label">Note (optional)</label>
                            <input
                                className="flo-input"
                                placeholder="Any notes..."
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>

                        {/* Lent Status */}
                        {type === 'expense' && (
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px', background: 'var(--surface2)', padding: '12px', borderRadius: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isLent}
                                        onChange={(e) => setFormData({ ...formData, isLent: e.target.checked })}
                                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                                    />
                                    <span>Lent to someone</span>
                                </label>

                                {formData.isLent && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.repaid}
                                            onChange={(e) => setFormData({ ...formData, repaid: e.target.checked })}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--income)' }}
                                        />
                                        <span>Repaid</span>
                                    </label>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{
                                flex: 2,
                                justifyContent: 'center',
                                background: type === 'income' ? '#4ecdc4' : 'var(--accent)',
                            }}
                        >
                            {loading ? <span className="spinner" style={{ width: '16px', height: '16px' }} /> : initialData ? 'Update' : 'Add Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
