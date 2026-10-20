import connectDB from './mongodb'
import RecurringTransaction from '@/models/RecurringTransaction'
import Transaction from '@/models/Transaction'
import { addWeeks, addMonths, addYears } from 'date-fns'

const MAX_CATCHUP_ITERATIONS = 365

function advance(date: Date, frequency: 'weekly' | 'monthly' | 'yearly'): Date {
    if (frequency === 'weekly') return addWeeks(date, 1)
    if (frequency === 'yearly') return addYears(date, 1)
    return addMonths(date, 1)
}

export async function generateDueRecurringTransactions(today: Date = new Date()) {
    await connectDB()

    const due = await RecurringTransaction.find({ isActive: true, nextRunDate: { $lte: today } })

    let templatesProcessed = 0
    let transactionsCreated = 0

    for (const recurring of due) {
        templatesProcessed++
        let guard = 0

        while (recurring.nextRunDate <= today && guard < MAX_CATCHUP_ITERATIONS) {
            if (recurring.endDate && recurring.nextRunDate > recurring.endDate) {
                recurring.isActive = false
                break
            }

            await Transaction.create({
                userId: recurring.userId,
                title: recurring.title,
                amount: recurring.amount,
                type: recurring.type,
                category: recurring.category,
                date: recurring.nextRunDate,
                note: recurring.note,
            })
            transactionsCreated++

            recurring.nextRunDate = advance(recurring.nextRunDate, recurring.frequency)
            guard++
        }

        recurring.lastGeneratedAt = new Date()
        await recurring.save()
    }

    return { templatesProcessed, transactionsCreated }
}
