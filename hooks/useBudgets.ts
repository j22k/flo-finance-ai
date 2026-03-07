'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Budget } from '@/types'
import toast from 'react-hot-toast'

interface UseBudgetsOptions {
    month?: number
    year?: number
}

export function useBudgets(options: UseBudgetsOptions = {}) {
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchBudgets = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (options.month) params.set('month', String(options.month))
            if (options.year) params.set('year', String(options.year))

            const response = await api.get(`/api/budgets?${params.toString()}`)
            setBudgets(response.data.budgets)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load budgets'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [options.month, options.year])

    useEffect(() => {
        fetchBudgets()
    }, [fetchBudgets])

    const createOrUpdateBudget = async (data: {
        category: string
        limitAmount: number
        month: number
        year: number
    }) => {
        try {
            const response = await api.post('/api/budgets', data)
            toast.success('Budget saved!')
            await fetchBudgets()
            return response.data.budget
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save budget'
            toast.error(msg)
            throw err
        }
    }

    const deleteBudget = async (id: string) => {
        try {
            await api.delete(`/api/budgets/${id}`)
            toast.success('Budget deleted!')
            await fetchBudgets()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete budget'
            toast.error(msg)
            throw err
        }
    }

    return {
        budgets,
        loading,
        error,
        refetch: fetchBudgets,
        createOrUpdateBudget,
        deleteBudget,
    }
}
