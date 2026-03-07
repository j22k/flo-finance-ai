'use client'

interface SuggestedQuestionsProps {
    suggestions: string[]
    onSelect: (q: string) => void
}

export default function SuggestedQuestions({ suggestions, onSelect }: SuggestedQuestionsProps) {
    if (!suggestions || suggestions.length === 0) return null

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
            {suggestions.map((s, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(s)}
                    className="suggestion-chip px-3 py-1.5 text-[0.8rem] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {s}
                </button>
            ))}
        </div>
    )
}
