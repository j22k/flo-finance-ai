import { z } from 'zod'
import connectDB from '@/lib/mongodb'
import Transaction from '@/models/Transaction'
import Budget from '@/models/Budget'
import { ActionResult } from '@/types/chat'
import { AITool } from '@/lib/ai'

export interface Intent<TArgs = any> {
    name: string
    description: string
    mutates: boolean
    schema: z.ZodType<TArgs>
    parameters: Record<string, unknown>
    handler: (args: TArgs, userId: string) => Promise<ActionResult>
}

const addTransactionSchema = z.object({
    title: z.string().min(1),
    amount: z.number().positive(),
    type: z.enum(['income', 'expense']),
    category: z.string().min(1),
    date: z.string(),
    note: z.string().optional(),
})

const updateTransactionSchema = z.object({
    _id: z.string(),
    title: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().min(1).optional(),
    date: z.string().optional(),
    note: z.string().optional(),
})

const deleteTransactionSchema = z.object({
    _id: z.string(),
})

const setBudgetSchema = z.object({
    category: z.string().min(1),
    limitAmount: z.number().positive(),
    month: z.number(),
    year: z.number(),
})

export const INTENTS: Intent[] = [
    {
        name: 'add_transaction',
        description: 'Create a new income or expense transaction for the user.',
        mutates: true,
        schema: addTransactionSchema,
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                amount: { type: 'number' },
                type: { type: 'string', enum: ['income', 'expense'] },
                category: { type: 'string' },
                date: { type: 'string', description: 'ISO date string, e.g. 2026-10-21' },
                note: { type: 'string' },
            },
            required: ['title', 'amount', 'type', 'category', 'date'],
        },
        handler: async (args: z.infer<typeof addTransactionSchema>, userId: string) => {
            await connectDB()
            const tx = await Transaction.create({ ...args, userId })
            return { success: true, result: tx }
        },
    },
    {
        name: 'update_transaction',
        description: "Update an existing transaction by its id.",
        mutates: true,
        schema: updateTransactionSchema,
        parameters: {
            type: 'object',
            properties: {
                _id: { type: 'string' },
                title: { type: 'string' },
                amount: { type: 'number' },
                type: { type: 'string', enum: ['income', 'expense'] },
                category: { type: 'string' },
                date: { type: 'string' },
                note: { type: 'string' },
            },
            required: ['_id'],
        },
        handler: async (args: z.infer<typeof updateTransactionSchema>, userId: string) => {
            await connectDB()
            const { _id, ...data } = args
            const tx = await Transaction.findOneAndUpdate({ _id, userId }, { $set: data }, { new: true })
            if (!tx) throw new Error('Transaction not found or unauthorized')
            return { success: true, result: tx }
        },
    },
    {
        name: 'delete_transaction',
        description: 'Delete a transaction by its id.',
        mutates: true,
        schema: deleteTransactionSchema,
        parameters: {
            type: 'object',
            properties: { _id: { type: 'string' } },
            required: ['_id'],
        },
        handler: async (args: z.infer<typeof deleteTransactionSchema>, userId: string) => {
            await connectDB()
            const tx = await Transaction.findOneAndDelete({ _id: args._id, userId })
            if (!tx) throw new Error('Transaction not found or unauthorized')
            return { success: true, result: { message: 'Transaction deleted successfully.' } }
        },
    },
    {
        name: 'set_budget',
        description: 'Create or update a monthly budget limit for a category.',
        mutates: true,
        schema: setBudgetSchema,
        parameters: {
            type: 'object',
            properties: {
                category: { type: 'string' },
                limitAmount: { type: 'number' },
                month: { type: 'number' },
                year: { type: 'number' },
            },
            required: ['category', 'limitAmount', 'month', 'year'],
        },
        handler: async (args: z.infer<typeof setBudgetSchema>, userId: string) => {
            await connectDB()
            const { category, limitAmount, month, year } = args
            const budget = await Budget.findOneAndUpdate(
                { userId, category, month, year },
                { $set: { limitAmount } },
                { new: true, upsert: true }
            )
            return { success: true, result: budget }
        },
    },
]

export function toAITools(intents: Intent[]): AITool[] {
    return intents.map((intent) => ({
        type: 'function',
        function: {
            name: intent.name,
            description: intent.description,
            parameters: intent.parameters,
        },
    }))
}

export function parseIntent(
    name: string,
    rawArguments: string
): { ok: true; intent: Intent; args: unknown } | { ok: false; error: string } {
    const intent = INTENTS.find((i) => i.name === name)
    if (!intent) {
        return { ok: false, error: `Unknown intent: ${name}` }
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(rawArguments)
    } catch {
        return { ok: false, error: 'Malformed tool arguments' }
    }

    const result = intent.schema.safeParse(parsed)
    if (!result.success) {
        return { ok: false, error: result.error.message }
    }

    return { ok: true, intent, args: result.data }
}
