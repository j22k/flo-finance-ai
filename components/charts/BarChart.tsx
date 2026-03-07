'use client'

import {
    BarChart as ReBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { MonthlySummary } from '@/types'

interface BarChartProps {
    data: MonthlySummary[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
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

export default function BarChartComponent({ data }: BarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,61,0.8)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--muted)', paddingTop: '12px' }} />
                <Bar dataKey="income" name="Income" fill="#4ecdc4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ff6b8a" radius={[4, 4, 0, 0]} />
            </ReBarChart>
        </ResponsiveContainer>
    )
}
