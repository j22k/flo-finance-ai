export default function TypingIndicator() {
    return (
        <div className="flex gap-1.5 p-3 bg-[var(--surface2)] border border-[var(--border)] rounded-[18px_18px_18px_4px] max-w-[60px]">
            <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
    )
}
