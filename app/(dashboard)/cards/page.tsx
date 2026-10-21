'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import { useCards } from '@/hooks/useCards'
import CardForm from '@/components/CardForm'
import CardTile from '@/components/CardTile'
import api from '@/lib/api'
import { Card, CardSummary } from '@/types'

export default function CardsPage() {
    const { cards, loading, createCard, updateCard, deleteCard, recordPayment } = useCards()
    const [showForm, setShowForm] = useState(false)
    const [editingCard, setEditingCard] = useState<Card | null>(null)
    const [summaries, setSummaries] = useState<Record<string, CardSummary>>({})

    useEffect(() => {
        const fetchSummaries = async () => {
            const results = await Promise.all(
                cards.map((c) => api.get(`/api/cards/${c._id}/summary`).then((res) => [c._id, res.data] as const))
            )
            setSummaries(Object.fromEntries(results))
        }
        if (cards.length > 0) fetchSummaries()
    }, [cards])

    const handleRecordPayment = async (cardId: string, data: { amount: number }) => {
        await recordPayment(cardId, data)
        const res = await api.get(`/api/cards/${cardId}/summary`)
        setSummaries((prev) => ({ ...prev, [cardId]: res.data }))
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold">Cards</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">Track credit card spending and balances.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2 px-4 whitespace-nowrap">
                    <Plus size={18} /> Add Card
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flo-card" style={{ height: '220px', padding: 0, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--surface)', animation: 'pulse 1.5s ease infinite' }} />
                        </div>
                    ))}
                </div>
            ) : cards.length === 0 ? (
                <div className="flo-card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                    <div style={{ background: 'rgba(124,106,247,0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <CreditCard size={32} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>No cards yet</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                        Add a credit card to start tracking spending and balances.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {cards.map((card) => (
                        <CardTile
                            key={card._id}
                            card={card}
                            summary={summaries[card._id] || null}
                            onDelete={deleteCard}
                            onRecordPayment={handleRecordPayment}
                            onEdit={setEditingCard}
                        />
                    ))}
                </div>
            )}

            {showForm && (
                <CardForm onSubmit={createCard} onClose={() => setShowForm(false)} />
            )}

            {editingCard && (
                <CardForm
                    initialData={editingCard}
                    onSubmit={(data) => updateCard(editingCard._id, data)}
                    onClose={() => setEditingCard(null)}
                />
            )}
        </div>
    )
}
