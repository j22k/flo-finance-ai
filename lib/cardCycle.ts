import { addDays, addMonths, getDaysInMonth, setDate, startOfDay, subMonths } from 'date-fns'

export interface CardCycle {
    cycleStart: Date
    cycleEnd: Date
    statementDate: Date
    dueDate: Date
}

function clampedStatementDate(reference: Date, statementDay: number): Date {
    return setDate(reference, Math.min(statementDay, getDaysInMonth(reference)))
}

export function computeCardCycle(
    card: { statementDay: number; dueDaysAfterStatement: number },
    referenceDate: Date
): CardCycle {
    // Normalize to midnight: without this, the returned dates inherit
    // whatever time of day referenceDate happened to be (e.g. whenever a
    // cron run fired), so the exact same calendar day produces a different
    // dueDate millisecond-for-millisecond on every run — breaking any dedup
    // logic that compares a stored date against a freshly computed one.
    const today = startOfDay(referenceDate)
    const thisMonthStatementDate = clampedStatementDate(today, card.statementDay)

    let statementDate: Date
    let cycleEnd: Date

    if (today >= thisMonthStatementDate) {
        statementDate = thisMonthStatementDate
        cycleEnd = clampedStatementDate(addMonths(today, 1), card.statementDay)
    } else {
        statementDate = clampedStatementDate(subMonths(today, 1), card.statementDay)
        cycleEnd = thisMonthStatementDate
    }

    return {
        cycleStart: statementDate,
        cycleEnd,
        statementDate,
        dueDate: addDays(statementDate, card.dueDaysAfterStatement),
    }
}
