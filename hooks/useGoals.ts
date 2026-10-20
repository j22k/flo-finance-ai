'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Goal } from '@/types'
import toast from 'react-hot-toast'

export function useGoals() {
    const [goals, setGoals] = useState<Goal[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchGoals = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await api.get('/api/goals')
            setGoals(response.data.goals)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load goals'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchGoals()
    }, [fetchGoals])

    const createGoal = async (data: { title: string; targetAmount: number; targetDate: string }) => {
        try {
            const response = await api.post('/api/goals', data)
            toast.success('Goal created!')
            await fetchGoals()
            return response.data.goal
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create goal'
            toast.error(msg)
            throw err
        }
    }

    const updateGoal = async (id: string, data: Partial<{ title: string; targetAmount: number; targetDate: string }>) => {
        try {
            const response = await api.put(`/api/goals/${id}`, data)
            toast.success('Goal updated!')
            await fetchGoals()
            return response.data.goal
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update goal'
            toast.error(msg)
            throw err
        }
    }

    const deleteGoal = async (id: string) => {
        try {
            await api.delete(`/api/goals/${id}`)
            toast.success('Goal deleted!')
            await fetchGoals()
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete goal'
            toast.error(msg)
            throw err
        }
    }

    const addContribution = async (id: string, data: { amount: number; note?: string }) => {
        try {
            const response = await api.post(`/api/goals/${id}/contributions`, data)
            toast.success('Contribution added!')
            await fetchGoals()
            return response.data.goal
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add contribution'
            toast.error(msg)
            throw err
        }
    }

    return {
        goals,
        loading,
        error,
        refetch: fetchGoals,
        createGoal,
        updateGoal,
        deleteGoal,
        addContribution,
    }
}
