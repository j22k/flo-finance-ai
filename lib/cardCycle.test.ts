import { describe, it, expect } from 'vitest'
import { computeCardCycle } from './cardCycle'

describe('computeCardCycle', () => {
    it('computes the due date as statementDate + dueDaysAfterStatement when today is after this month\'s statement day', () => {
        // statementDay 5, today the 10th -> this month's statement (the 5th) just happened;
        // the open cycle runs from the 5th to next month's 5th; due date is the 5th + 20 days.
        const result = computeCardCycle({ statementDay: 5, dueDaysAfterStatement: 20 }, new Date(2026, 9, 10)) // Oct 10
        expect(result.statementDate).toEqual(new Date(2026, 9, 5))
        expect(result.cycleStart).toEqual(new Date(2026, 9, 5))
        expect(result.cycleEnd).toEqual(new Date(2026, 10, 5))
        expect(result.dueDate).toEqual(new Date(2026, 9, 25))
    })

    it('uses last month\'s statement day when today is before this month\'s statement day', () => {
        // statementDay 20, today the 10th -> this month's statement (the 20th) hasn't happened yet;
        // the open cycle started last month's 20th.
        const result = computeCardCycle({ statementDay: 20, dueDaysAfterStatement: 15 }, new Date(2026, 9, 10)) // Oct 10
        expect(result.statementDate).toEqual(new Date(2026, 8, 20)) // Sep 20
        expect(result.cycleStart).toEqual(new Date(2026, 8, 20))
        expect(result.cycleEnd).toEqual(new Date(2026, 9, 20))
        expect(result.dueDate).toEqual(new Date(2026, 9, 5)) // Sep 20 + 15 days = Oct 5
    })

    it('clamps a statementDay of 31 to the last day of a shorter month', () => {
        // statementDay 31, reference date in February (28 days in 2026, not a leap year).
        const result = computeCardCycle({ statementDay: 31, dueDaysAfterStatement: 10 }, new Date(2026, 1, 15)) // Feb 15 2026
        expect(result.statementDate).toEqual(new Date(2026, 0, 31)) // Jan 31 (today Feb 15 is before Feb's clamped statement day)
        expect(result.cycleEnd).toEqual(new Date(2026, 1, 28)) // Feb has 28 days in 2026
    })
})
