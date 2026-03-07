'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { User } from '@/types'
import { setAccessToken, getAccessToken } from '@/lib/api'

interface AuthContextType {
    user: User | null
    accessToken: string | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    register: (name: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const handleSetToken = useCallback((newToken: string | null) => {
        setToken(newToken)
        setAccessToken(newToken)
    }, [])

    const tryRefresh = useCallback(async () => {
        try {
            const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
            const { accessToken } = response.data
            handleSetToken(accessToken)

            const payload = JSON.parse(atob(accessToken.split('.')[1]))
            return payload.userId
        } catch {
            handleSetToken(null)
            return null
        }
    }, [handleSetToken])

    useEffect(() => {
        const initAuth = async () => {
            // Check sessionStorage for user data (persisted across refreshes within tab)
            const savedUser = sessionStorage.getItem('flo_user')
            if (savedUser) {
                const parsedUser = JSON.parse(savedUser)
                setUser(parsedUser)
                // Also try to refresh the token
                await tryRefresh()
                setLoading(false)
                return
            }

            // Try to restore session via refresh token cookie
            try {
                const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
                const { accessToken } = response.data
                handleSetToken(accessToken)

                const payload = JSON.parse(atob(accessToken.split('.')[1]))
                const cachedUser = localStorage.getItem('flo_user_info')
                if (cachedUser) {
                    setUser(JSON.parse(cachedUser))
                }
            } catch {
                handleSetToken(null)
            } finally {
                setLoading(false)
            }
        }

        initAuth()
    }, [tryRefresh])

    const login = async (email: string, password: string) => {
        const response = await axios.post('/api/auth/login', { email, password }, { withCredentials: true })
        const { accessToken, user: userData } = response.data
        handleSetToken(accessToken)
        setUser(userData)
        sessionStorage.setItem('flo_user', JSON.stringify(userData))
        localStorage.setItem('flo_user_info', JSON.stringify(userData))
    }

    const logout = async () => {
        try {
            await axios.post('/api/auth/logout', {}, { withCredentials: true })
        } catch {
            // ignore
        }
        handleSetToken(null)
        setUser(null)
        sessionStorage.removeItem('flo_user')
        localStorage.removeItem('flo_user_info')
    }

    const register = async (name: string, email: string, password: string) => {
        await axios.post('/api/auth/register', { name, email, password })
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken: token,
                loading,
                login,
                logout,
                register,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
