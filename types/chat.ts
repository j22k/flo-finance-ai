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
    type: 'add_transaction' | 'update_transaction' | 'delete_transaction' | 'set_budget'
    data: any
}

export interface ActionResult {
    success: boolean
    result?: Transaction | Budget | { message: string }
    error?: string
}
