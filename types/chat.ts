import { Transaction } from './index'
import { Budget } from './index'
import { Card } from './index'

export interface ChatMessage {
    role: 'user' | 'model' | 'assistant'
    content: string
    timestamp: Date
    isStreaming?: boolean
    action?: ChatAction
}

export interface ChatAction {
    type: 'add_transaction' | 'update_transaction' | 'delete_transaction' | 'set_budget' | 'add_card' | 'record_card_payment'
    data: any
}

export interface ActionResult {
    success: boolean
    result?: Transaction | Budget | Card | { message: string }
    error?: string
}
