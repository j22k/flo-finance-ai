'use client'

import { ChatMessage as ChatMessageType, ChatAction } from '@/types/chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ActionConfirmCard from './ActionConfirmCard'
import { format } from 'date-fns'

interface ChatMessageProps {
    message: ChatMessageType
    isStreaming?: boolean
    onAction: (action: ChatAction) => Promise<boolean>
}

export default function ChatMessage({ message, isStreaming, onAction }: ChatMessageProps) {
    const isBot = message.role === 'assistant' || message.role === 'model'

    return (
        <div className={`flex flex-col mb-4 ${isBot ? 'items-start' : 'items-end'}`}>
            <div
                className={`relative group max-w-[85%] md:max-w-[80%] p-3.5 ${isBot
                    ? 'bg-[var(--surface2)] border border-[var(--border)] rounded-[20px_20px_20px_4px] text-[var(--text)]'
                    : 'bg-gradient-to-br from-[var(--accent)] to-[#6b5ee0] text-white rounded-[20px_20px_4px_20px] shadow-lg shadow-[rgba(124,106,247,0.2)]'
                    }`}
            >
                <div className={`prose prose-invert max-w-none text-[0.92rem] leading-relaxed ${!isBot ? 'prose-p:text-white' : ''}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                    </ReactMarkdown>
                </div>

                {isStreaming && (
                    <span className="inline-block w-2 h-4 bg-[var(--accent)] ml-1 animate-pulse align-middle" />
                )}

                <span className={`text-[0.65rem] mt-1 opacity-0 group-hover:opacity-60 transition-opacity absolute top-full ${isBot ? 'left-2' : 'right-2'} text-[var(--muted)]`}>
                    {format(message.timestamp, 'HH:mm')}
                </span>
            </div>

            {isBot && message.action && (
                <div className="w-full max-w-[85%] md:max-w-[80%] mt-2">
                    <ActionConfirmCard action={message.action} onConfirm={onAction} />
                </div>
            )}
        </div>
    )
}
