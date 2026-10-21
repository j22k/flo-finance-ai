'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Card } from '@/types'
import toast from 'react-hot-toast'

export function useCards() {
    const [cards, setCards] = useState<Card[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCards = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await api.get('/api/cards')
            setCards(response.data.cards)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load cards'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCards()
    }, [fetchCards])

    const createCard = async (data: {
        name: string
        last4: string
        creditLimit: number
        apr: number
        statementDay: number
        dueDaysAfterStatement: number
    }) => {
        try {
            const response = await api.post('/api/cards', data)
            toast.success('Card added!')
            await fetchCards()
            return response.data.card
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add card'
            toast.error(msg)
            throw err
        }
    }

    const updateCard = async (id: string, data: Partial<{
        name: string
        last4: string
        creditLimit: number
        apr: number
        statementDay: number
        dueDaysAfterStatement: number
    }>) => {
        try {
            const response = await api.patch(`/api/cards/${id}`, data)
            toast.success('Card updated!')
            await fetchCards()
            return response.data.card
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update card'
            toast.error(msg)
            throw err
        }
    }

    const deleteCard = async (id: string) => {
        try {
            await api.delete(`/api/cards/${id}`)
            toast.success('Card removed!')
            await fetchCards()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to remove card'
            toast.error(msg)
            throw err
        }
    }

    const recordPayment = async (cardId: string, data: { amount: number; date?: string; note?: string }) => {
        try {
            const response = await api.post(`/api/cards/${cardId}/payments`, data)
            toast.success('Payment recorded!')
            return response.data.transaction
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to record payment'
            toast.error(msg)
            throw err
        }
    }

    return {
        cards,
        loading,
        error,
        refetch: fetchCards,
        createCard,
        updateCard,
        deleteCard,
        recordPayment,
    }
}
