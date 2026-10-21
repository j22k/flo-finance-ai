import Groq from 'groq-sdk'

export interface AIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_call_id?: string
    name?: string
}

export interface AITool {
    type: 'function'
    function: { name: string; description: string; parameters: object }
}

export type AIStreamChunk =
    | { type: 'text'; text: string }
    | { type: 'tool_call'; id: string; name: string; arguments: string }
    | { type: 'done' }

let client: Groq | null = null
function getClient(): Groq {
    if (!client) {
        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            throw new Error('GROQ_API_KEY environment variable is not set. Add it to your .env.local file.')
        }
        client = new Groq({ apiKey })
    }
    return client
}

export async function* chat(messages: AIMessage[], tools: AITool[]): AsyncGenerator<AIStreamChunk> {
    const stream = await getClient().chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
        stream: true,
    })

    const toolCalls = new Map<number, { id: string; name: string; args: string }>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of stream as any) {
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) {
            yield { type: 'text', text: delta.content }
        }

        if (delta.tool_calls) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const tc of delta.tool_calls as any[]) {
                const buf = toolCalls.get(tc.index) || { id: '', name: '', args: '' }
                if (tc.id) buf.id = tc.id
                if (tc.function?.name) buf.name = tc.function.name
                if (tc.function?.arguments) buf.args += tc.function.arguments
                toolCalls.set(tc.index, buf)
            }
        }
    }

    for (const buf of toolCalls.values()) {
        yield { type: 'tool_call', id: buf.id, name: buf.name, arguments: buf.args }
    }

    yield { type: 'done' }
}
