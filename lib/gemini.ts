import { GoogleGenerativeAI } from '@google/generative-ai'

export async function streamChat(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'model' | 'assistant'; content: string }>
) {
    const rawKey = process.env.FLO_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''
    const apiKey = rawKey.trim().replace(/^["']|["']$/g, '')

    if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please add FLO_GEMINI_API_KEY to your .env.local')
    }
    const genAI = new GoogleGenerativeAI(apiKey)

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
    })
    const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
    }))

    const lastMessage = messages[messages.length - 1].content

    const chat = model.startChat({
        history,
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
    })

    const result = await chat.sendMessageStream(lastMessage)
    return result.stream
}

export async function ask(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 512
) {
    const apiKey = (process.env.FLO_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '')
    if (!apiKey) {
        throw new Error('Gemini API Key is missing. Please add FLO_GEMINI_API_KEY to your .env.local')
    }
    const genAI = new GoogleGenerativeAI(apiKey)

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt
    })

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7
        }
    })

    const response = await result.response
    return response.text()
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
