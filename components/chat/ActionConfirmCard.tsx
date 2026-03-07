'use client'

import { ChatAction } from '@/types/chat'
import { Check, X, Zap } from 'lucide-react'
import { useState } from 'react'

interface ActionConfirmCardProps {
    action: ChatAction
    onConfirm: (action: ChatAction) => Promise<boolean>
}

export default function ActionConfirmCard({ action, onConfirm }: ActionConfirmCardProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'cancelled'>('idle')

    const handleConfirm = async () => {
        setStatus('loading')
        const success = await onConfirm(action)
        if (success) setStatus('done')
        else setStatus('idle')
    }

    if (status === 'done') return (
        <div className="flex items-center gap-2 p-3 text-[0.85rem] text-[var(--success)] bg-[rgba(78,205,196,0.1)] rounded-xl border border-[rgba(78,205,196,0.2)]">
            <Check size={16} /> Action completed!
        </div>
    )

    if (status === 'cancelled') return null

    const getActionLabel = () => {
        switch (action.type) {
            case 'create_transaction': return 'Add Transaction'
            case 'update_transaction': return 'Update Transaction'
            case 'delete_transaction': return 'Delete Transaction'
            case 'create_budget':
            case 'update_budget': return 'Update Budget'
            default: return 'Quick Action'
        }
    }

    const renderDataPill = (label: string, value: any) => (
        <div className="flex flex-col">
            <span className="text-[0.7rem] uppercase text-[var(--muted)] font-bold">{label}</span>
            <span className="text-[0.85rem] truncate">{value}</span>
        </div>
    )

    return (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 my-2 shadow-xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 mb-3 text-[var(--accent)]">
                <div className="bg-[rgba(124,106,247,0.15)] p-1.5 rounded-lg">
                    <Zap size={16} />
                </div>
                <span className="text-[0.85rem] font-bold uppercase tracking-wider">Quick Action</span>
            </div>

            <h3 className="font-bold text-[1rem] mb-3">{getActionLabel()}</h3>

            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-[var(--surface2)] rounded-xl">
                {action.data.title && renderDataPill('Title', action.data.title)}
                {action.data.amount && renderDataPill('Amount', `₹${action.data.amount}`)}
                {action.data.category && renderDataPill('Category', action.data.category)}
                {action.data.type && renderDataPill('Type', action.data.type)}
                {action.data.limitAmount && renderDataPill('New Limit', `₹${action.data.limitAmount}`)}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleConfirm}
                    disabled={status === 'loading'}
                    className="flex-1 btn-primary py-2 justify-center text-[0.85rem]"
                >
                    {status === 'loading' ? <span className="spinner w-4 h-4" /> : 'Confirm'}
                </button>
                <button
                    onClick={() => setStatus('cancelled')}
                    disabled={status === 'loading'}
                    className="flex-1 btn-secondary py-2 justify-center text-[0.85rem]"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
