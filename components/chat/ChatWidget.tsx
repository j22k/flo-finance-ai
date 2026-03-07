'use client'

import { useState, useEffect } from 'react'
import { Sparkles, MessageCircle, ChevronDown } from 'lucide-react'
import ChatPanel from './ChatPanel'
import { usePathname } from 'next/navigation'

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [hasPrompted, setHasPrompted] = useState(false)
    const pathname = usePathname()

    // Context window based on pathname
    const getContextWindow = () => {
        if (pathname === '/dashboard') return 'Dashboard Overview'
        if (pathname === '/transactions') return 'Transactions History'
        if (pathname === '/budgets') return 'Budgeting & Limits'
        if (pathname === '/analytics') return 'Spending Analysis'
        return 'Finance Tracker'
    }

    // Auto-pulse or prompt after some time
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isOpen && !hasPrompted) {
                setHasPrompted(true)
            }
        }, 10000)
        return () => clearTimeout(timer)
    }, [isOpen, hasPrompted])

    return (
        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end pointer-events-none">
            {/* Chat Panel */}
            {isOpen && (
                <div className="mb-4 w-[90vw] h-[70vh] max-w-[400px] max-h-[600px] pointer-events-auto animate-in slide-in-from-bottom-5 duration-300">
                    <ChatPanel onClose={() => setIsOpen(false)} contextWindow={getContextWindow()} />
                </div>
            )}

            {/* Floating Toggle Button */}
            <div className="pointer-events-auto flex items-center gap-3">
                {/* Tooltip hint */}
                {!isOpen && (
                    <div className="bg-[var(--surface2)] text-white text-[0.8rem] px-3 py-1.5 rounded-xl border border-[var(--border)] shadow-xl animate-in fade-in slide-in-from-right-2 hidden md:block select-none">
                        Need financial advice?
                    </div>
                )}

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`chat-widget-btn w-14 h-14 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 shadow-2xl ${isOpen ? 'rotate-[180deg]' : ''
                        }`}
                    title="Ask Flo AI"
                >
                    {isOpen ? <ChevronDown size={24} /> : <Sparkles size={24} className="animate-pulse" />}

                    {/* Unread badge logic here if needed */}
                    {!isOpen && (
                        <div className="absolute top-0 right-0 w-4 h-4 bg-[var(--expense)] rounded-full border-2 border-[var(--bg)] animate-bounce" />
                    )}
                </button>
            </div>
        </div>
    )
}
