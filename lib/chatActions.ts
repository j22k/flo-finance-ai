import { ChatAction, ActionResult } from '@/types/chat'
import connectDB from './mongodb'
import Transaction from '@/models/Transaction'
import Budget from '@/models/Budget'

export async function executeChatAction(action: ChatAction, userId: string): Promise<ActionResult> {
    await connectDB()

    try {
        switch (action.type) {
            case 'create_transaction': {
                const tx = await Transaction.create({ ...action.data, userId })
                return { success: true, result: tx }
            }
            case 'update_transaction': {
                const tx = await Transaction.findOneAndUpdate(
                    { _id: action.data._id, userId },
                    { $set: action.data },
                    { new: true }
                )
                if (!tx) throw new Error('Transaction not found or unauthorized')
                return { success: true, result: tx }
            }
            case 'delete_transaction': {
                const tx = await Transaction.findOneAndDelete({ _id: action.data._id, userId })
                if (!tx) throw new Error('Transaction not found or unauthorized')
                return { success: true, result: { message: 'Transaction deleted successfully.' } }
            }
            case 'create_budget':
            case 'update_budget': {
                const budget = await Budget.findOneAndUpdate(
                    { userId, category: action.data.category, month: action.data.month, year: action.data.year },
                    { $set: { limitAmount: action.data.limitAmount } },
                    { new: true, upsert: true }
                )
                return { success: true, result: budget }
            }
            default:
                throw new Error('Unknown action type')
        }
    } catch (e: any) {
        console.error('Execute action error:', e)
        return { success: false, error: e.message }
    }
}
