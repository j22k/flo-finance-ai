'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic } from 'lucide-react'

interface ChatInputProps {
    onSend: (content: string) => void
    isLoading: boolean
}

export default function ChatInput({ onSend, isLoading }: ChatInputProps) {
    const [content, setContent] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
        }
    }, [content])

    const handleSend = () => {
        if (content.trim() && !isLoading) {
            onSend(content.trim())
            setContent('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex items-end gap-2 bg-[var(--surface2)] p-2 rounded-2xl border border-[var(--border)] focus-within:border-[var(--accent)] transition-all">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your finances..."
                className="flex-1 bg-transparent border-none outline-none text-[0.9rem] p-1.5 resize-none max-h-[120px] scrollbar-hide"
                rows={1}
            />

            {/* Voice input placeholder - browser support varies */}
            <button
                type="button"
                className="p-2 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                title="Voice input (if supported)"
            >
                <Mic size={18} />
            </button>

            <button
                onClick={handleSend}
                disabled={!content.trim() || isLoading}
                className={`p-2 rounded-xl transition-all ${content.trim() && !isLoading
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface)] text-[var(--muted)]'
                    }`}
            >
                <Send size={18} />
            </button>
        </div>
    )
}
