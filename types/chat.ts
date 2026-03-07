import { Transaction } from './index'
import { Budget } from './index'

export interface ChatMessage {
    role: 'user' | 'model' | 'assistant'
    content: string
    timestamp: Date
    isStreaming?: boolean
    action?: ChatAction
}

export interface ChatAction {
    type: 'create_transaction' | 'update_transaction' | 'delete_transaction' | 'create_budget' | 'update_budget'
    data: any
}

export interface ActionResult {
    success: boolean
    result?: Transaction | Budget | { message: string }
    error?: string
}
