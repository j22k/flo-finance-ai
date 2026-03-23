'use client'

import { useState, useEffect } from 'react'
import { BarChart3, PieChart as PieChartIcon, Activity, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import StatCard from '@/components/StatCard'
import BarChartComponent from '@/components/charts/BarChart'
import PieChartComponent from '@/components/charts/PieChart'
import api from '@/lib/api'
import { MonthlySummary, CategoryStat } from '@/types'

// A simple local LineChart component for the Savings Trend
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'

function CumulativeSavingsChart({ data }: { data: MonthlySummary[] }) {
    let cumulative = 0
    const chartData = data.map(d => {
        cumulative += d.savings
        return {
            ...d,
            cumulative
        }
    })

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const val = payload[0].value
            const color = val >= 0 ? 'var(--income)' : 'var(--expense)'
            return (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
                    <p style={{ color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>{label}</p>
                    <p style={{ color, fontWeight: 700 }}>
                        Wealth: <span className="amount">₹{val.toLocaleString()}</span>
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c6af7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#7c6af7" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,61,0.8)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <ReTooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,107,138,0.5)" strokeDasharray="3 3" />
                <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#7c6af7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorWealth)"
                    activeDot={{ r: 7, fill: '#7c6af7', stroke: '#13131a', strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}

function NeedsVsWantsChart({ data }: { data: CategoryStat[] }) {
    // 50/30/20 heuristic mapping for common default categories
    const needsCategories = ['Housing', 'Transport', 'Health', 'Utilities', 'Food', 'Groceries', 'Insurance']
    const wantsCategories = ['Entertainment', 'Shopping', 'Dining', 'Hobbies', 'Personal']
    
    let needs = 0
    let wants = 0
    let other = 0

    data.forEach(item => {
        if (needsCategories.some(c => item.category.toLowerCase().includes(c.toLowerCase()))) {
            needs += item.total
        } else if (wantsCategories.some(c => item.category.toLowerCase().includes(c.toLowerCase()))) {
            wants += item.total
        } else {
            other += item.total
        }
    })

    const chartData = [
        { name: 'Needs (50%)', value: needs, color: '#4ecdc4' },
        { name: 'Wants (30%)', value: wants, color: '#ff6b8a' },
        { name: 'Other/Savings', value: other, color: '#ffd93d' }
    ].filter(d => d.value > 0)

    if (!chartData.length) return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>No data</div>

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
                    <p style={{ color: payload[0].payload.color, fontWeight: 700 }}>
                        {payload[0].name}: <span className="amount">₹{payload[0].value.toLocaleString()}</span>
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <ReTooltip content={<CustomTooltip />} />
            </PieChart>
        </ResponsiveContainer>
    )
}

function SavingsTrendChart({ data }: { data: MonthlySummary[] }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const val = payload[0].value
            const color = val >= 0 ? 'var(--income)' : 'var(--expense)'
            return (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
                    <p style={{ color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>{label}</p>
                    <p style={{ color, fontWeight: 700 }}>
                        Savings: <span className="amount">₹{val.toLocaleString()}</span>
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ReLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,61,0.8)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <ReTooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,107,138,0.5)" strokeDasharray="3 3" />
                <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#4ecdc4"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#13131a' }}
                    activeDot={{ r: 7, fill: '#4ecdc4', stroke: '#13131a', strokeWidth: 2 }}
                />
            </ReLineChart>
        </ResponsiveContainer>
    )
}

function CategoryBarChart({ data }: { data: CategoryStat[] }) {
    if (!data.length) return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>No data</div>

    const max = Math.max(...data.map(d => d.total))

    return (
        <div style={{ height: '260px', overflowY: 'auto', paddingRight: '8px' }}>
            {data.map((item, i) => (
                <div key={item.category} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{item.category}</span>
                        <span className="amount" style={{ fontWeight: 600, color: 'var(--expense)' }}>₹{item.total.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar" style={{ height: '6px', background: 'var(--surface2)' }}>
                        <div
                            style={{
                                height: '100%',
                                borderRadius: '100px',
                                background: `calc((100% - ${i * 5}%) * 1)`,
                                backgroundColor: 'var(--accent)',
                                width: `${Math.max((item.total / max) * 100, 2)}%`,
                                transition: 'width 0.5s ease'
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function AnalyticsPage() {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const [year, setYear] = useState(currentYear)
    const [summary, setSummary] = useState<MonthlySummary[]>([])
    const [categories, setCategories] = useState<CategoryStat[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true)
            try {
                const [sumRes, catRes] = await Promise.all([
                    api.get(`/api/analytics/summary?year=${year}`),
                    api.get(`/api/analytics/categories?month=${currentMonth}&year=${currentYear}`)
                ])
                setSummary(sumRes.data.months)
                setCategories(catRes.data.categories)
            } catch (err) {
                console.error('Failed to fetch analytics', err)
            } finally {
                setLoading(false)
            }
        }
        fetchAnalytics()
    }, [year, currentMonth, currentYear])

    const yearlyTotals = summary.reduce(
        (acc, curr) => {
            acc.income += curr.income
            acc.expense += curr.expense
            acc.savings += curr.savings
            return acc
        },
        { income: 0, expense: 0, savings: 0 }
    )

    const YEARS = [currentYear - 2, currentYear - 1, currentYear]

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold">Analytics</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">Deep dive into your financial patterns.</p>
                </div>
                <select
                    className="flo-select w-full sm:w-[120px] py-2 px-3"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Yearly Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <StatCard
                    title="Yearly Income"
                    value={`₹${yearlyTotals.income.toLocaleString()}`}
                    icon={TrendingUp}
                    color="var(--income)"
                    gradient="rgba(78,205,196,0.08)"
                    sub={`Total for ${year}`}
                />
                <StatCard
                    title="Yearly Expenses"
                    value={`₹${yearlyTotals.expense.toLocaleString()}`}
                    icon={TrendingDown}
                    color="var(--expense)"
                    gradient="rgba(255,107,138,0.08)"
                    sub={`Total for ${year}`}
                />
                <StatCard
                    title="Net Savings"
                    value={`₹${yearlyTotals.savings.toLocaleString()}`}
                    icon={Wallet}
                    color="#a78bfa"
                    gradient="rgba(124,106,247,0.08)"
                    sub={`Total for ${year}`}
                />
            </div>

            {/* Main Charts */}
            {loading ? (
                <div className="flex flex-col gap-6">
                    <div className="flo-card h-[360px]"><div className="w-full h-full bg-[var(--surface2)] animate-pulse" /></div>
                    <div className="flo-card h-[360px]"><div className="w-full h-full bg-[var(--surface2)] animate-pulse" /></div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col xl:flex-row gap-6 mb-6">
                        <div className="flo-card flex-1 w-full overflow-x-auto min-w-[300px]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[rgba(78,205,196,0.1)] p-1.5 rounded-lg">
                                    <BarChart3 size={18} color="var(--income)" />
                                </div>
                                <h2 className="text-[1.2rem] font-bold">Monthly Income vs Expenses</h2>
                            </div>
                            <div className="min-w-[500px] h-[260px]">
                                <BarChartComponent data={summary} />
                            </div>
                        </div>

                        <div className="flo-card flex-1 w-full overflow-x-auto min-w-[300px]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[rgba(124,106,247,0.1)] p-1.5 rounded-lg">
                                    <TrendingUp size={18} color="var(--accent)" />
                                </div>
                                <h2 className="text-[1.2rem] font-bold">Cumulative Wealth Growth</h2>
                            </div>
                            <div className="min-w-[500px] h-[260px]">
                                <CumulativeSavingsChart data={summary} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-6 mb-6">
                        <div className="flo-card flex-1 w-full overflow-x-auto min-w-[300px]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[rgba(124,106,247,0.1)] p-1.5 rounded-lg">
                                    <Activity size={18} color="var(--accent)" />
                                </div>
                                <h2 className="text-[1.2rem] font-bold">Savings Trend</h2>
                            </div>
                            <div className="min-w-[500px] h-[260px]">
                                <SavingsTrendChart data={summary} />
                            </div>
                        </div>

                        <div className="flo-card flex-1 w-full min-w-[300px]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[rgba(78,205,196,0.1)] p-1.5 rounded-lg">
                                    <PieChartIcon size={18} color="#4ecdc4" />
                                </div>
                                <h2 className="text-[1.2rem] font-bold">Needs vs Wants Split</h2>
                            </div>
                            <div className="h-[260px]">
                                <NeedsVsWantsChart data={categories} />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-6">
                        <div className="flo-card w-full xl:w-2/5 order-2 xl:order-1">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="bg-[rgba(255,217,61,0.1)] p-1.5 rounded-lg">
                                    <PieChartIcon size={18} color="var(--warning)" />
                                </div>
                                <h2 className="text-[1.2rem] font-bold">Expense Distribution</h2>
                            </div>
                            <div className="h-[260px]">
                                <PieChartComponent data={categories} />
                            </div>
                        </div>

                        <div className="flo-card w-full xl:w-3/5 order-1 xl:order-2">
                            <h2 className="text-[1.2rem] font-bold mb-6">Top Expense Categories</h2>
                            <CategoryBarChart data={categories} />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
