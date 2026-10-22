import Groq from 'groq-sdk'

export interface AIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_call_id?: string
    name?: string
    tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

export interface AITool {
    type: 'function'
    function: { name: string; description: string; parameters: Record<string, unknown> }
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
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
        // One action per turn — chat()'s buffering/flush design can represent
        // several tool calls, but the chat route only ever acts on the first
        // (mutating actions need a confirm card each), so asking the model
        // for more than one per turn would mean the rest are silently lost.
        parallel_tool_calls: tools.length ? false : undefined,
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

    for (const buf of Array.from(toolCalls.values())) {
        yield { type: 'tool_call', id: buf.id, name: buf.name, arguments: buf.args }
    }

    yield { type: 'done' }
}
