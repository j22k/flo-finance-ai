'use client'

import { useState, useEffect } from 'react'
import { PiggyBank, Target, CalendarDays, Wallet } from 'lucide-react'
import { useBudgets } from '@/hooks/useBudgets'
import { CATEGORIES } from '@/types'
import BudgetCard from '@/components/BudgetCard'
import api from '@/lib/api'

export default function BudgetsPage() {
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    const [selectedYear, setSelectedYear] = useState(currentYear)

    const { budgets, loading, createOrUpdateBudget, deleteBudget } = useBudgets({
        month: selectedMonth,
        year: selectedYear,
    })

    // To calculate progress, we need the expenses for this month per category
    const [expenses, setExpenses] = useState<Record<string, number>>({})
    const [expensesLoading, setExpensesLoading] = useState(true)

    const [formData, setFormData] = useState({
        category: CATEGORIES[0] as string,
        limitAmount: '',
    })
    const [formLoading, setFormLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchExpenses = async () => {
            setExpensesLoading(true)
            try {
                const res = await api.get(`/api/analytics/categories?month=${selectedMonth}&year=${selectedYear}`)
                const catData = res.data.categories
                const expMap: Record<string, number> = {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                catData.forEach((c: any) => {
                    expMap[c.category] = c.total
                })
                setExpenses(expMap)
            } catch (err) {
                console.error('Failed to fetch expenses for budgets', err)
            } finally {
                setExpensesLoading(false)
            }
        }
        fetchExpenses()
    }, [selectedMonth, selectedYear, budgets])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const limit = parseFloat(formData.limitAmount)
        if (!limit || limit <= 0) {
            setError('Limit must be a positive number')
            return
        }

        setFormLoading(true)
        try {
            await createOrUpdateBudget({
                category: formData.category,
                limitAmount: limit,
                month: selectedMonth,
                year: selectedYear,
            })
            setFormData({ ...formData, limitAmount: '' })
        } catch {
            setError('Failed to save budget')
        } finally {
            setFormLoading(false)
        }
    }

    const MONTHS = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }),
    }))

    const YEARS = [currentYear - 1, currentYear, currentYear + 1]

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold">Budgets</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">Keep your spending under control.</p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <select
                        className="flo-select flex-1 sm:w-[130px] py-2 px-3 bg-[var(--surface)]"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                        {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <select
                        className="flo-select flex-1 sm:w-[100px] py-2 px-3 bg-[var(--surface)]"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Set Budget Form */}
                <div className="flo-card xl:w-1/3 self-start sticky top-8">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                        <div style={{ background: 'rgba(124,106,247,0.15)', padding: '8px', borderRadius: '10px' }}>
                            <Target size={20} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Set Budget</h2>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                        Create or update a monthly budget limit for a specific category. This will overwrite any existing budget for this category and month.
                    </p>

                    {error && <p style={{ color: 'var(--expense)', fontSize: '0.8rem', marginBottom: '16px', padding: '8px', background: 'rgba(255,107,138,0.1)', borderRadius: '6px' }}>{error}</p>}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="flo-label">Category</label>
                            <select
                                className="flo-select"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="flo-label">Monthly Limit (₹)</label>
                            <div style={{ position: 'relative' }}>
                                <Wallet size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="flo-input amount"
                                    placeholder="0.00"
                                    value={formData.limitAmount}
                                    onChange={(e) => setFormData({ ...formData, limitAmount: e.target.value })}
                                    style={{ paddingLeft: '36px', fontSize: '1.1rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center', background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                            <CalendarDays size={16} color="var(--accent)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>
                                Applying to <span style={{ color: 'var(--accent)' }}>{MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</span>
                            </span>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={formLoading}
                            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                        >
                            {formLoading ? <span className="spinner" style={{ width: '18px', height: '18px' }} /> : 'Save Budget'}
                        </button>
                    </form>
                </div>

                {/* Budgets List */}
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Your Budgets</h2>

                    {loading || expensesLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flo-card" style={{ height: '160px', padding: 0, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--surface)', animation: 'pulse 1.5s ease infinite' }} />
                                </div>
                            ))}
                        </div>
                    ) : budgets.length === 0 ? (
                        <div className="flo-card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                            <div style={{ background: 'rgba(124,106,247,0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <PiggyBank size={32} color="var(--accent)" />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>No budgets set yet</h3>
                            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                                Use the form on the left to set spending limits for different categories.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {budgets.map((b) => (
                                <BudgetCard
                                    key={b._id}
                                    budget={b}
                                    spent={expenses[b.category] || 0}
                                    onDelete={deleteBudget}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
