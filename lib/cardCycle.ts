import { addDays, addMonths, getDaysInMonth, setDate, subMonths } from 'date-fns'

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
    const thisMonthStatementDate = clampedStatementDate(referenceDate, card.statementDay)

    let statementDate: Date
    let cycleEnd: Date

    if (referenceDate >= thisMonthStatementDate) {
        statementDate = thisMonthStatementDate
        cycleEnd = clampedStatementDate(addMonths(referenceDate, 1), card.statementDay)
    } else {
        statementDate = clampedStatementDate(subMonths(referenceDate, 1), card.statementDay)
        cycleEnd = thisMonthStatementDate
    }

    return {
        cycleStart: statementDate,
        cycleEnd,
        statementDate,
        dueDate: addDays(statementDate, card.dueDaysAfterStatement),
    }
}
