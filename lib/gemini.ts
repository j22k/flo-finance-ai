import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()

if (process.env.GEMINI_API_KEY) {
    console.log(`Flo AI: Using GEMINI_API_KEY from environment (length: ${process.env.GEMINI_API_KEY.trim().length})`)
} else if (process.env.GOOGLE_API_KEY) {
    console.log(`Flo AI: Using GOOGLE_API_KEY from environment (length: ${process.env.GOOGLE_API_KEY.trim().length})`)
} else {
    console.error('Flo AI: No API Key found!')
}

const genAI = new GoogleGenerativeAI(apiKey)
const MODEL_NAME = 'gemini-1.5-flash'

export async function streamChat(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'model' | 'assistant'; content: string }>
) {
    // Format messages for official Google Generative AI SDK
    const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }))

    const lastMessage = messages[messages.length - 1].content

    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemPrompt
    })

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.2
        }
    })

    const result = await chat.sendMessageStream(lastMessage)
    return result
}

export async function ask(
    systemPrompt: string,
    userMessage: string,
    maxTokens = 512
) {
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemPrompt
    })

    const result = await model.generateContent(userMessage)
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
