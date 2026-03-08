import { createParser } from 'eventsource-parser'

export async function streamChat(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'model' | 'assistant'; content: string }>
) {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()

    if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please add GEMINI_API_KEY to your .env.local')
    }

    const model = 'gemini-1.5-flash-latest'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

    const contents = messages.map(msg => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }))

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents,
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            generation_config: {
                maxOutputTokens: 2048,
                temperature: 0.7
            }
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Flo AI] Gemini API Error Response:', JSON.stringify(errorData, null, 2))

        if (response.status === 429) {
            throw new Error('Flo is currently busy (Rate limit reached). Please wait a few seconds.')
        }

        throw new Error(errorData.error?.message || `API Error: ${response.status}`)
    }

    return response.body
}

export async function ask(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 512
) {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
    const model = 'gemini-1.5-flash-latest'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            generation_config: {
                maxOutputTokens: maxTokens,
                temperature: 0.7
            }
        })
    })

    const data = await response.json()
    if (!response.ok) {
        throw new Error(data.error?.message || 'API Error')
    }

    return data.candidates[0].content.parts[0].text
}

export function parseActionFromResponse(text: string) {
    const regex = /\[ACTION:([\s\S]*?)\]/
    const match = text.match(regex)
    if (match && match[1]) {
        try {
            return JSON.parse(match[1])
        } catch (e) {
            console.error('Failed to parse action JSON:', e)
            return null
        }
    }
    return null
}
