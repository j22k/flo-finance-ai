'use client'

import { useRef, useEffect } from 'react'
import { X, Trash2, Maximize2, Sparkles } from 'lucide-react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import SuggestedQuestions from './SuggestedQuestions'
import TypingIndicator from './TypingIndicator'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/context/AuthContext'

interface ChatPanelProps {
    onClose: () => void
    contextWindow?: string
}

export default function ChatPanel({ onClose, contextWindow }: ChatPanelProps) {
    const { user } = useAuth()
    const {
        messages,
        isLoading,
        streamingContent,
        suggestions,
        sendMessage,
        clearChat,
        executeAction
    } = useChat(contextWindow)

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, streamingContent, isLoading])

    return (
        <div className="flex flex-col h-full bg-[#0f0f18] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[rgba(124,106,247,0.15)] to-[rgba(78,205,196,0.08)] border-bottom border-[var(--border)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        F
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-[1rem] flex items-center gap-1.5">
                            Flo AI <Sparkles size={14} className="text-[var(--warning)]" />
                        </h3>
                        <p className="text-[var(--muted)] text-[0.75rem]">Your financial advisor</p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={clearChat} className="p-2 text-[var(--muted)] hover:text-[var(--expense)] transition-colors" title="Clear chat">
                        <Trash2 size={18} />
                    </button>
                    <button onClick={onClose} className="p-2 text-[var(--muted)] hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Context Pill */}
            {contextWindow && (
                <div className="px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
                    <span className="text-[0.7rem] uppercase tracking-wider text-[var(--muted)] font-bold flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                        Context: {contextWindow}
                    </span>
                </div>
            )}

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 scroll-smooth scrollbar-hide">
                {(!messages || messages.length === 0) && !isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-80 p-6 animate-in fade-in zoom-in-95">
                        <div className="w-16 h-16 rounded-3xl bg-[var(--surface2)] flex items-center justify-center mb-4 border border-[var(--border)] text-3xl">
                            👋
                        </div>
                        <h2 className="text-xl font-bold mb-2">Hi {user?.name?.split(' ')[0] || 'there'}!</h2>
                        <p className="text-[var(--muted)] text-[0.9rem] mb-8 max-w-[240px]">
                            I know your finances inside out. Ask me anything about your spending or budgets.
                        </p>
                        <div className="w-full">
                            <SuggestedQuestions suggestions={suggestions} onSelect={sendMessage} />
                        </div>
                    </div>
                )}

                {messages?.map((msg, i) => (
                    <ChatMessage key={i} message={msg} onAction={executeAction} />
                ))}

                {streamingContent && (
                    <ChatMessage
                        message={{ role: 'assistant', content: streamingContent, timestamp: new Date() }}
                        isStreaming={true}
                        onAction={executeAction}
                    />
                )}

                {isLoading && !streamingContent && (
                    <div className="flex flex-col gap-2">
                        <TypingIndicator />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions (shown after first msg if space allows) */}
            {messages?.length > 0 && !isLoading && suggestions?.length > 0 && (
                <div className="px-4 pt-2 pb-0">
                    <SuggestedQuestions suggestions={suggestions} onSelect={sendMessage} />
                </div>
            )}

            {/* Input */}
            <div className="p-4 bg-[var(--surface)]/50 border-t border-[var(--border)]">
                <ChatInput onSend={sendMessage} isLoading={isLoading} />
                <p className="text-[0.6rem] text-[var(--muted)] text-center mt-2 uppercase tracking-tighter">
                    Flo can make mistakes. Verify important info.
                </p>
            </div>
        </div>
    )
}
