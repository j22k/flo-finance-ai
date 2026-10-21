import { ChatAction, ActionResult } from '@/types/chat'
import { INTENTS } from './ai/intents'

export async function executeChatAction(action: ChatAction, userId: string): Promise<ActionResult> {
    const intent = INTENTS.find((i) => i.name === action.type)
    if (!intent) {
        return { success: false, error: `Unknown action type: ${action.type}` }
    }

    const validation = intent.schema.safeParse(action.data)
    if (!validation.success) {
        return { success: false, error: validation.error.message }
    }

    try {
        return await intent.handler(validation.data, userId)
    } catch (e: any) {
        console.error('Execute action error:', e)
        return { success: false, error: e.message }
    }
}
