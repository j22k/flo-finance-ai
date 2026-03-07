'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, Percent, ArrowRight, ChevronRight } from 'lucide-react'
import StatCard from '@/components/StatCard'
import AreaChartComponent from '@/components/charts/AreaChart'
import PieChartComponent from '@/components/charts/PieChart'
import api from '@/lib/api'
import { DashboardStats, MonthlySummary, CategoryStat, Transaction } from '@/types'
import { format } from 'date-fns'
import { useAuth } from '@/context/AuthContext'

function LoadingPulse() {
    return (
        <div style={{ height: '100%', background: 'var(--surface2)', borderRadius: '8px', animation: 'pulse 1.5s ease infinite' }} />
    )
}

export default function DashboardPage() {
    const { user } = useAuth()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [summary, setSummary] = useState<MonthlySummary[]>([])
    const [categories, setCategories] = useState<CategoryStat[]>([])
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    const now = new Date()

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [statsRes, summaryRes, catRes, txRes] = await Promise.all([
                    api.get('/api/analytics/dashboard'),
                    api.get(`/api/analytics/summary?year=${now.getFullYear()}`),
                    api.get(`/api/analytics/categories?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
                    api.get('/api/transactions?limit=5'),
                ])
                setStats(statsRes.data)
                setSummary(summaryRes.data.months)
                setCategories(catRes.data.categories)
                setRecentTransactions(txRes.data.transactions)
            } catch (err) {
                console.error('Dashboard fetch error:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <p className="text-[var(--muted)] text-[0.9rem] mb-1">{greeting},</p>
                <h1 className="text-[1.8rem] font-extrabold">{user?.name?.split(' ')[0] || 'there'} 👋</h1>
                <p className="text-[var(--muted)] text-[0.875rem] mt-1">
                    Here&apos;s your financial overview for {format(now, 'MMMM yyyy')}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {loading ? (
                    Array(4).fill(null).map((_, i) => (
                        <div key={i} className="flo-card h-[120px]"><LoadingPulse /></div>
                    ))
                ) : (
                    <>
                        <StatCard
                            title="Total Income"
                            value={`₹${stats?.income.toLocaleString() || 0}`}
                            icon={TrendingUp}
                            color="var(--income)"
                            gradient="rgba(78,205,196,0.05)"
                            sub="This month"
                        />
                        <StatCard
                            title="Total Expenses"
                            value={`₹${stats?.expense.toLocaleString() || 0}`}
                            icon={TrendingDown}
                            color="var(--expense)"
                            gradient="rgba(255,107,138,0.05)"
                            sub="This month"
                        />
                        <StatCard
                            title="Net Savings"
                            value={`₹${stats?.savings.toLocaleString() || 0}`}
                            icon={Wallet}
                            color="#a78bfa"
                            gradient="rgba(124,106,247,0.05)"
                            sub="This month"
                        />
                        <StatCard
                            title="Savings Rate"
                            value={`${stats?.savingsRate || 0}%`}
                            icon={Percent}
                            color="var(--warning)"
                            gradient="rgba(255,217,61,0.05)"
                            sub={`${stats?.transactionCount || 0} transactions`}
                        />
                    </>
                )}
            </div>

            {/* Charts row */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                {/* Area Chart */}
                <div className="flo-card flex-1 lg:w-3/5 overflow-x-auto overflow-y-hidden">
                    <h2 className="text-[1rem] font-bold mb-1">Income vs Expenses</h2>
                    <p className="text-[var(--muted)] text-[0.8rem] mb-5">12-month overview</p>
                    {loading ? <div className="h-[260px]"><LoadingPulse /></div> : <AreaChartComponent data={summary} />}
                </div>

                {/* Pie Chart */}
                <div className="flo-card flex-shrink-0 lg:w-2/5">
                    <h2 className="text-[1rem] font-bold mb-1">Category Breakdown</h2>
                    <p className="text-[var(--muted)] text-[0.8rem] mb-5">Expenses this month</p>
                    {loading ? <div className="h-[260px]"><LoadingPulse /></div> : <PieChartComponent data={categories} />}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="flo-card overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-[1rem] font-bold">Recent Transactions</h2>
                        <p className="text-[var(--muted)] text-[0.8rem]">Your latest activity</p>
                    </div>
                    <Link href="/transactions" className="flex items-center gap-1 text-[var(--accent)] text-[0.875rem] font-semibold no-underline">
                        View all <ChevronRight size={16} />
                    </Link>
                </div>

                {loading ? (
                    <div className="h-[200px]"><LoadingPulse /></div>
                ) : recentTransactions.length === 0 ? (
                    <div className="text-center py-10 text-[var(--muted)]">
                        <p className="text-3xl mb-2">💸</p>
                        <p>No transactions yet. Add your first one!</p>
                    </div>
                ) : (
                    <table className="flo-table min-w-[500px]">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.map((tx) => (
                                <tr key={tx._id}>
                                    <td style={{ fontWeight: 500 }}>{tx.title}</td>
                                    <td><span className="badge badge-category">{tx.category}</span></td>
                                    <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{format(new Date(tx.date), 'MMM d, yyyy')}</td>
                                    <td><span className={`badge badge-${tx.type}`}>{tx.type}</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="amount" style={{ color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)', fontWeight: 600 }}>
                                            {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
