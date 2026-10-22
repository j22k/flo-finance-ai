import { describe, it, expect } from 'vitest'
import { isCardDueSoon } from './cardDueStatus'

describe('isCardDueSoon', () => {
    it('is true when the due date is today or within the next 2 days and something is owed', () => {
        expect(isCardDueSoon(0, 1000)).toBe(true)
        expect(isCardDueSoon(1, 1000)).toBe(true)
        expect(isCardDueSoon(2, 1000)).toBe(true)
    })

    it('is false once the due date is more than 2 days out', () => {
        expect(isCardDueSoon(3, 1000)).toBe(false)
    })

    it('is false once the due date has passed, even though differenceInCalendarDays goes negative', () => {
        expect(isCardDueSoon(-1, 1000)).toBe(false)
        expect(isCardDueSoon(-10, 1000)).toBe(false)
    })

    it('is false when nothing is owed, regardless of how close the due date is', () => {
        expect(isCardDueSoon(0, 0)).toBe(false)
        expect(isCardDueSoon(1, -50)).toBe(false)
    })

    it('is false when there is no summary yet', () => {
        expect(isCardDueSoon(null, 1000)).toBe(false)
    })
})
