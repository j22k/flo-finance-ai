import { describe, it, expect } from 'vitest'
import { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Transaction from './Transaction'
import mongoose from 'mongoose'

describe('Transaction model — card fields', () => {
    it('accepts type:"card_payment" with a cardId', async () => {
        await connectDB()
        const tx = await Transaction.create({
            userId: new Types.ObjectId(), title: 'Payment to HDFC Millennia', amount: 5000,
            type: 'card_payment', category: 'Card Payment', date: new Date(),
            cardId: new Types.ObjectId(),
        })
        expect(tx.type).toBe('card_payment')
    })

    it('still loads a pre-existing document that has no paymentMethod or cardId at all', async () => {
        await connectDB()
        // Inserted via the raw driver, bypassing Mongoose defaults, to simulate
        // a document written before this migration — exactly what hard rule 1
        // ("existing rows must still load and display") is about.
        const { insertedId } = await mongoose.connection.db!.collection('transactions').insertOne({
            userId: new Types.ObjectId(), title: 'Old Rent', amount: 15000,
            type: 'expense', category: 'Housing', date: new Date(), createdAt: new Date(), updatedAt: new Date(),
        })
        const tx = await Transaction.findById(insertedId)
        expect(tx).not.toBeNull()
        expect(tx!.title).toBe('Old Rent')
        // Mongoose applies schema defaults on every read/hydration, regardless
        // of what's actually stored — so an old document with no paymentMethod
        // reads back as 'cash' (the schema default), not undefined. This is
        // the correct, desired behavior for hard rule 1: the old transaction
        // displays sensibly rather than blank. cardId has no default, so it
        // genuinely stays undefined.
        expect(tx!.paymentMethod).toBe('cash')
        expect(tx!.cardId).toBeUndefined()
    })
})
