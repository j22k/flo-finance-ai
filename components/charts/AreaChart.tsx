'use client'

import {
    AreaChart as ReAreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { MonthlySummary } from '@/types'

interface AreaChartProps {
    data: MonthlySummary[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div
                style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '0.85rem',
                }}
            >
                <p style={{ color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>{label}</p>
                {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
                    <p key={i} style={{ color: entry.color, marginBottom: '4px' }}>
                        {entry.name}: <span className="amount">₹{entry.value.toLocaleString()}</span>
                    </p>
                ))}
            </div>
        )
    }
    return null
}

export default function AreaChartComponent({ data }: AreaChartProps) {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <ReAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff6b8a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ff6b8a" stopOpacity={0.0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,61,0.8)" />
                <XAxis
                    dataKey="name"
                    tick={{ fill: '#8888aa', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: '#8888aa', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    wrapperStyle={{ fontSize: '0.8rem', color: 'var(--muted)', paddingTop: '12px' }}
                />
                <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#4ecdc4"
                    strokeWidth={2}
                    fill="url(#incomeGrad)"
                    dot={false}
                    activeDot={{ r: 6, fill: '#4ecdc4' }}
                />
                <Area
                    type="monotone"
                    dataKey="expense"
                    name="Expense"
                    stroke="#ff6b8a"
                    strokeWidth={2}
                    fill="url(#expenseGrad)"
                    dot={false}
                    activeDot={{ r: 6, fill: '#ff6b8a' }}
                />
            </ReAreaChart>
        </ResponsiveContainer>
    )
}
