import { useState, useCallback, useEffect } from 'react'
import { ChatMessage, ChatAction } from '@/types/chat'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function useChat(contextWindow?: string) {
    const { accessToken } = useAuth()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [suggestions, setSuggestions] = useState<string[]>([])

    const fetchSuggestions = useCallback(async () => {
        if (!accessToken) return
        try {
            const res = await api.get('/api/ai/suggestions')
            setSuggestions(res.data.suggestions)
        } catch (err) {
            console.error('Failed to fetch suggestions', err)
        }
    }, [accessToken])

    useEffect(() => {
        if (accessToken) {
            fetchSuggestions()
        }
    }, [fetchSuggestions, contextWindow, accessToken])

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return

        const userMsg: ChatMessage = {
            role: 'user',
            content,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMsg])
        setIsLoading(true)
        setStreamingContent('')

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    contextWindow
                })
            })

            if (!response.ok) throw new Error('Failed to connect to Flo AI')

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let accumulated = ''
            let finalAction: ChatAction | undefined = undefined

            while (true) {
                const { done, value } = await reader!.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n\n').filter(Boolean)

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = JSON.parse(line.slice(6))

                    if (data.delta) {
                        accumulated += data.delta
                        setStreamingContent(accumulated)
                    }

                    if (data.done) {
                        finalAction = data.action
                    }
                }
            }

            const botMsg: ChatMessage = {
                role: 'assistant',
                content: accumulated,
                timestamp: new Date(),
                action: finalAction
            }

            setMessages(prev => [...prev, botMsg])
            setStreamingContent('')
        } catch (err: any) {
            toast.error(err.message || 'Something went wrong')
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    const clearChat = () => {
        setMessages([])
        setStreamingContent('')
        fetchSuggestions()
    }

    const executeAction = async (action: ChatAction) => {
        try {
            const res = await api.post('/api/ai/quick-action', { action })
            const data = res.data
            if (data.success) {
                toast.success('Action completed successfully!')
                return true
            } else {
                toast.error(data.error || 'Action failed')
                return false
            }
        } catch (err) {
            toast.error('Failed to execute action')
            return false
        }
    }

    return {
        messages,
        isLoading,
        streamingContent,
        suggestions,
        sendMessage,
        clearChat,
        executeAction
    }
}
