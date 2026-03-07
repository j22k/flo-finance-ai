'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Transaction, PaginatedTransactions } from '@/types'
import toast from 'react-hot-toast'

interface UseTransactionsOptions {
    month?: number
    year?: number
    category?: string
    type?: string
    page?: number
    limit?: number
}

export function useTransactions(options: UseTransactionsOptions = {}) {
    const [data, setData] = useState<PaginatedTransactions | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchTransactions = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (options.month) params.set('month', String(options.month))
            if (options.year) params.set('year', String(options.year))
            if (options.category && options.category !== 'all') params.set('category', options.category)
            if (options.type && options.type !== 'all') params.set('type', options.type)
            if (options.page) params.set('page', String(options.page))
            if (options.limit) params.set('limit', String(options.limit))

            const response = await api.get(`/api/transactions?${params.toString()}`)
            setData(response.data)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load transactions'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [options.month, options.year, options.category, options.type, options.page, options.limit])

    useEffect(() => {
        fetchTransactions()
    }, [fetchTransactions])

    const createTransaction = async (data: Omit<Transaction, '_id' | 'createdAt'>) => {
        try {
            const response = await api.post('/api/transactions', data)
            toast.success('Transaction added!')
            await fetchTransactions()
            return response.data.transaction
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add transaction'
            toast.error(msg)
            throw err
        }
    }

    const updateTransaction = async (id: string, data: Partial<Transaction>) => {
        try {
            const response = await api.put(`/api/transactions/${id}`, data)
            toast.success('Transaction updated!')
            await fetchTransactions()
            return response.data.transaction
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update transaction'
            toast.error(msg)
            throw err
        }
    }

    const deleteTransaction = async (id: string) => {
        try {
            await api.delete(`/api/transactions/${id}`)
            toast.success('Transaction deleted!')
            await fetchTransactions()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete transaction'
            toast.error(msg)
            throw err
        }
    }

    return {
        transactions: data?.transactions || [],
        total: data?.total || 0,
        page: data?.page || 1,
        totalPages: data?.totalPages || 0,
        loading,
        error,
        refetch: fetchTransactions,
        createTransaction,
        updateTransaction,
        deleteTransaction,
    }
}
