'use client'

import { useState } from 'react'
import { Repeat, Trash2, Pause, Play, TrendingUp, TrendingDown, CalendarDays } from 'lucide-react'
import { useRecurring } from '@/hooks/useRecurring'
import { useCategories } from '@/hooks/useCategories'
import { CATEGORIES } from '@/types'
import { format } from 'date-fns'

const FREQUENCIES = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
] as const

export default function RecurringPage() {
    const { recurring, loading, createRecurring, toggleActive, deleteRecurring } = useRecurring()
    const { categories } = useCategories()

    const [type, setType] = useState<'income' | 'expense'>('expense')
    const availableCategories = categories.filter(c => c.type === type).map(c => c.name)
    const baseCategories = CATEGORIES.filter(c => type === 'expense' ? c !== 'Salary' && c !== 'Freelance' && c !== 'Investment' : c === 'Salary' || c === 'Freelance' || c === 'Investment')
    const options: string[] = Array.from(new Set<string>([...baseCategories, ...availableCategories]))

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: CATEGORIES[0] as string,
        frequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
    })
    const [formLoading, setFormLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!formData.title.trim()) {
            setError('Title is required')
            return
        }
        const amount = parseFloat(formData.amount)
        if (!amount || amount <= 0) {
            setError('Amount must be a positive number')
            return
        }

        setFormLoading(true)
        try {
            await createRecurring({
                title: formData.title.trim(),
                amount,
                type,
                category: formData.category,
                frequency: formData.frequency,
                startDate: formData.startDate,
                endDate: formData.endDate || undefined,
            })
            setFormData({ ...formData, title: '', amount: '', endDate: '' })
        } catch {
            setError('Failed to save recurring transaction')
        } finally {
            setFormLoading(false)
        }
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold">Recurring</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">
                        Bills and subscriptions that repeat automatically — no need to re-enter them each month.
                    </p>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Create Form */}
                <div className="flo-card xl:w-1/3 self-start sticky top-8">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(124,106,247,0.15)', padding: '8px', borderRadius: '10px' }}>
                            <Repeat size={20} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>New Recurring</h2>
                    </div>

                    {error && <p style={{ color: 'var(--expense)', fontSize: '0.8rem', marginBottom: '16px', padding: '8px', background: 'rgba(255,107,138,0.1)', borderRadius: '6px' }}>{error}</p>}

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px' }}>
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
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
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
                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Title</label>
                            <input
                                className="flo-input"
                                placeholder="e.g. Rent"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div style={{ marginBottom: '14px' }}>
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
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Category</label>
                            <select
                                className="flo-select"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {options.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Frequency</label>
                            <select
                                className="flo-select"
                                value={formData.frequency}
                                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'weekly' | 'monthly' | 'yearly' })}
                            >
                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
                            <div>
                                <label className="flo-label">Starts</label>
                                <input
                                    type="date"
                                    className="flo-input"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                            <div>
                                <label className="flo-label">Ends (optional)</label>
                                <input
                                    type="date"
                                    className="flo-input"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={formLoading}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                        >
                            {formLoading ? <span className="spinner" style={{ width: '18px', height: '18px' }} /> : 'Create Recurring Transaction'}
                        </button>
                    </form>
                </div>

                {/* List */}
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Your Recurring Transactions</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '16px' }}>
                        Deleting a template only stops future charges — transactions it already created stay in your history.
                    </p>

                    {loading ? (
                        <div className="flo-card" style={{ height: '200px' }}>
                            <div style={{ height: '100%', background: 'var(--surface2)', animation: 'pulse 1.5s ease infinite' }} />
                        </div>
                    ) : recurring.length === 0 ? (
                        <div className="flo-card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                            <div style={{ background: 'rgba(124,106,247,0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Repeat size={32} color="var(--accent)" />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>No recurring transactions yet</h3>
                            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: '320px', margin: '0 auto' }}>
                                Add rent, EMIs, or subscriptions here so they're created automatically each period.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recurring.map((r) => (
                                <div key={r._id} className="flo-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: r.isActive ? 1 : 0.55 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: r.type === 'income' ? 'rgba(78,205,196,0.1)' : 'rgba(255,107,138,0.1)', padding: '10px', borderRadius: '10px' }}>
                                            <Repeat size={18} color={r.type === 'income' ? 'var(--income)' : 'var(--expense)'} />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.title}</p>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span className="badge badge-category">{r.category}</span>
                                                <span style={{ textTransform: 'capitalize' }}>· {r.frequency}</span>
                                                {r.isActive && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                                        <CalendarDays size={11} /> Next: {format(new Date(r.nextRunDate), 'MMM d, yyyy')}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <span className="amount" style={{ fontWeight: 700, color: r.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                                            {r.type === 'income' ? '+' : '-'}₹{r.amount.toLocaleString()}
                                        </span>
                                        <button
                                            onClick={() => toggleActive(r._id, !r.isActive)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                                            title={r.isActive ? 'Pause' : 'Resume'}
                                        >
                                            {r.isActive ? <Pause size={16} /> : <Play size={16} />}
                                        </button>
                                        <button
                                            onClick={() => deleteRecurring(r._id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
