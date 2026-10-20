'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { RecurringTransaction } from '@/types'
import toast from 'react-hot-toast'

export function useRecurring() {
    const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchRecurring = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await api.get('/api/recurring')
            setRecurring(response.data.recurring)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load recurring transactions'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRecurring()
    }, [fetchRecurring])

    const createRecurring = async (data: {
        title: string
        amount: number
        type: 'income' | 'expense'
        category: string
        note?: string
        frequency: 'weekly' | 'monthly' | 'yearly'
        startDate: string
        endDate?: string
    }) => {
        try {
            const response = await api.post('/api/recurring', data)
            toast.success('Recurring transaction created!')
            await fetchRecurring()
            return response.data.recurring
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create recurring transaction'
            toast.error(msg)
            throw err
        }
    }

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            await api.put(`/api/recurring/${id}`, { isActive })
            toast.success(isActive ? 'Resumed' : 'Paused')
            await fetchRecurring()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update'
            toast.error(msg)
            throw err
        }
    }

    const deleteRecurring = async (id: string) => {
        try {
            await api.delete(`/api/recurring/${id}`)
            toast.success('Recurring transaction deleted!')
            await fetchRecurring()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete'
            toast.error(msg)
            throw err
        }
    }

    return {
        recurring,
        loading,
        error,
        refetch: fetchRecurring,
        createRecurring,
        toggleActive,
        deleteRecurring,
    }
}
