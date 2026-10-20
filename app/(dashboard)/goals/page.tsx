'use client'

import { useState } from 'react'
import { Target, Sparkles, CalendarDays, Wallet } from 'lucide-react'
import { useGoals } from '@/hooks/useGoals'
import GoalCard from '@/components/GoalCard'
import { format } from 'date-fns'

export default function GoalsPage() {
    const { goals, loading, createGoal, deleteGoal, addContribution } = useGoals()

    const [formData, setFormData] = useState({
        title: '',
        targetAmount: '',
        targetDate: format(new Date(new Date().setMonth(new Date().getMonth() + 6)), 'yyyy-MM-dd'),
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

        const target = parseFloat(formData.targetAmount)
        if (!target || target <= 0) {
            setError('Target amount must be a positive number')
            return
        }

        setFormLoading(true)
        try {
            await createGoal({
                title: formData.title.trim(),
                targetAmount: target,
                targetDate: formData.targetDate,
            })
            setFormData({ ...formData, title: '', targetAmount: '' })
        } catch {
            setError('Failed to save goal')
        } finally {
            setFormLoading(false)
        }
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold">Goals</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">Save towards what matters.</p>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Create Goal Form */}
                <div className="flo-card xl:w-1/3 self-start sticky top-8">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(124,106,247,0.15)', padding: '8px', borderRadius: '10px' }}>
                            <Target size={20} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>New Goal</h2>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                        Set a savings target and a date, then log contributions as you save towards it.
                    </p>

                    {error && <p style={{ color: 'var(--expense)', fontSize: '0.8rem', marginBottom: '16px', padding: '8px', background: 'rgba(255,107,138,0.1)', borderRadius: '6px' }}>{error}</p>}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="flo-label">Goal Title</label>
                            <input
                                className="flo-input"
                                placeholder="e.g. Emergency Fund"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label className="flo-label">Target Amount (₹)</label>
                            <div style={{ position: 'relative' }}>
                                <Wallet size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="flo-input amount"
                                    placeholder="0.00"
                                    value={formData.targetAmount}
                                    onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                                    style={{ paddingLeft: '36px', fontSize: '1.1rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="flo-label">Target Date</label>
                            <div style={{ position: 'relative' }}>
                                <CalendarDays size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="date"
                                    className="flo-input"
                                    value={formData.targetDate}
                                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                                    style={{ paddingLeft: '36px', colorScheme: 'dark' }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={formLoading}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                        >
                            {formLoading ? <span className="spinner" style={{ width: '18px', height: '18px' }} /> : 'Create Goal'}
                        </button>
                    </form>
                </div>

                {/* Goals List */}
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Your Goals</h2>

                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flo-card" style={{ height: '220px', padding: 0, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--surface)', animation: 'pulse 1.5s ease infinite' }} />
                                </div>
                            ))}
                        </div>
                    ) : goals.length === 0 ? (
                        <div className="flo-card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                            <div style={{ background: 'rgba(124,106,247,0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Sparkles size={32} color="var(--accent)" />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>No goals yet</h3>
                            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                                Use the form on the left to set your first savings goal.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {goals.map((g) => (
                                <GoalCard
                                    key={g._id}
                                    goal={g}
                                    onDelete={deleteGoal}
                                    onAddContribution={addContribution}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
