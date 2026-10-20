import connectDB from './mongodb'
import RecurringTransaction from '@/models/RecurringTransaction'
import Transaction from '@/models/Transaction'
import { addWeeks, addMonths, addYears, setDate, getDaysInMonth } from 'date-fns'

const MAX_CATCHUP_ITERATIONS = 365

// anchorDay keeps a monthly/yearly cadence pinned to the day-of-month the
// template started on. Without it, repeatedly calling addMonths on a date
// that got clamped (e.g. Jan 31 -> Feb 28) never recovers on later months
// that do have 31 days — the billing day would permanently drift to 28.
function advance(date: Date, frequency: 'weekly' | 'monthly' | 'yearly', anchorDay: number): Date {
    if (frequency === 'weekly') return addWeeks(date, 1)
    const next = frequency === 'yearly' ? addYears(date, 1) : addMonths(date, 1)
    return setDate(next, Math.min(anchorDay, getDaysInMonth(next)))
}

export async function generateDueRecurringTransactions(today: Date = new Date()) {
    await connectDB()

    const due = await RecurringTransaction.find({ isActive: true, nextRunDate: { $lte: today } })

    let templatesProcessed = 0
    let transactionsCreated = 0

    for (const recurring of due) {
        templatesProcessed++
        let guard = 0
        const anchorDay = recurring.startDate.getDate()

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

            recurring.nextRunDate = advance(recurring.nextRunDate, recurring.frequency, anchorDay)
            guard++
        }

        recurring.lastGeneratedAt = new Date()
        await recurring.save()
    }

    return { templatesProcessed, transactionsCreated }
}
