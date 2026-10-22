import { describe, it, expect } from 'vitest'
import mongoose, { Types } from 'mongoose'
import connectDB from '@/lib/mongodb'
import Card from './Card'

describe('Card model', () => {
    it('rejects a last4 that is not exactly 4 digits', async () => {
        await connectDB()
        const card = new Card({
            userId: new Types.ObjectId(), name: 'Test Card', last4: '12345',
            creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
        })
        await expect(card.validate()).rejects.toThrow()
    })

    it('accepts a valid card and defaults isActive to true', async () => {
        await connectDB()
        const card = await Card.create({
            userId: new Types.ObjectId(), name: 'HDFC Millennia', last4: '4242',
            creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
        })
        expect(card.isActive).toBe(true)
        expect(card.last4).toBe('4242')
    })

    it('loads a pre-existing Phase-2-shaped card with no reminder fields at all', async () => {
        await connectDB()
        const { insertedId } = await mongoose.connection.db!.collection('cards').insertOne({
            userId: new Types.ObjectId(), name: 'Old Card', last4: '4242',
            creditLimit: 50000, apr: 36, statementDay: 5, dueDaysAfterStatement: 20,
            isActive: true, createdAt: new Date(), updatedAt: new Date(),
        })
        const card = await Card.findById(insertedId)
        expect(card).not.toBeNull()
        expect(card!.reminder5SentAt ?? null).toBeNull()
    })
})
