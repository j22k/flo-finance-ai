'use client'

import {
    PieChart as RePieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { CategoryStat } from '@/types'

const COLORS = [
    '#7c6af7', '#4ecdc4', '#ff6b8a', '#ffd93d', '#ff9966',
    '#a8edea', '#fed6e3', '#96fbc4', '#f5f7fa', '#c3cfe2',
    '#fd746c', '#74b9ff',
]

interface PieChartProps {
    data: CategoryStat[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload
        return (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem' }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '4px' }}>{d.category}</p>
                <p style={{ color: 'var(--income)' }}>₹{d.total.toLocaleString()}</p>
                <p style={{ color: 'var(--muted)' }}>{d.percentage}% of expenses</p>
            </div>
        )
    }
    return null
}

export default function PieChartComponent({ data }: PieChartProps) {
    if (!data.length) {
        return (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                No expense data
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={260}>
            <RePieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="45%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="category"
                >
                    {data.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    formatter={(value) => (
                        <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{value}</span>
                    )}
                    wrapperStyle={{ paddingTop: '8px' }}
                />
            </RePieChart>
        </ResponsiveContainer>
    )
}
