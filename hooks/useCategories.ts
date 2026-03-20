import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { UserCategory } from '@/types'

export function useCategories() {
  const [categories, setCategories] = useState<UserCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async (type?: 'income' | 'expense') => {
    try {
      setLoading(true)
      const url = type ? `/api/categories?type=${type}` : '/api/categories'
      const response = await api.get(url)
      setCategories(response.data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch categories')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const addCategory = async (category: Omit<UserCategory, '_id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true)
      const response = await api.post('/api/categories', category)
      setCategories(prev => [...prev, response.data])
      return response.data
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to add category')
    } finally {
      setLoading(false)
    }
  }

  const updateCategory = async (id: string, data: Partial<UserCategory>) => {
    try {
      setLoading(true)
      const response = await api.put(`/api/categories/${id}`, data)
      setCategories(prev => prev.map(c => c._id === id ? response.data : c))
      return response.data
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update category')
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      setLoading(true)
      await api.delete(`/api/categories/${id}`)
      setCategories(prev => prev.filter(c => c._id !== id))
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete category')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory
  }
}
