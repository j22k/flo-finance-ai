'use client'

import { DailySpend } from '@/types'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface SpendingCalendarProps {
    days: DailySpend[]
    month: number
    year: number
}

function intensityColor(total: number, max: number) {
    if (total <= 0 || max <= 0) return 'var(--surface2)'
    const ratio = total / max
    if (ratio > 0.75) return 'rgba(255,107,138,0.9)'
    if (ratio > 0.5) return 'rgba(255,107,138,0.6)'
    if (ratio > 0.25) return 'rgba(255,107,138,0.35)'
    return 'rgba(255,107,138,0.15)'
}

export default function SpendingCalendar({ days, month, year }: SpendingCalendarProps) {
    if (!days.length) {
        return <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>No data</div>
    }

    const leadingBlanks = new Date(year, month - 1, 1).getDay()
    const max = Math.max(...days.map((d) => d.total))

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
                {WEEKDAYS.map((w) => (
                    <div key={w} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
                        {w}
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                    <div key={`blank-${i}`} />
                ))}
                {days.map((d) => (
                    <div
                        key={d.day}
                        title={d.total > 0 ? `${month}/${d.day}/${year}: ₹${d.total.toLocaleString()} (${d.count} transaction${d.count === 1 ? '' : 's'})` : `${month}/${d.day}/${year}: no spending`}
                        style={{
                            aspectRatio: '1',
                            borderRadius: '8px',
                            background: intensityColor(d.total, max),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            color: d.total / (max || 1) > 0.5 ? '#fff' : 'var(--muted)',
                            fontWeight: 600,
                            cursor: 'default',
                        }}
                    >
                        {d.day}
                    </div>
                ))}
            </div>
        </div>
    )
}
