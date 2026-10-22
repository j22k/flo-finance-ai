// Due-soon only applies when a due date is upcoming AND something is
// actually owed — once dueInDays goes negative (the due date has passed,
// which is true for roughly a third of every billing cycle) or outstanding
// is zero/negative (nothing owed, or a credit balance), highlighting the
// card red is misleading rather than useful.
export function isCardDueSoon(dueInDays: number | null, outstanding: number): boolean {
    return dueInDays !== null && dueInDays >= 0 && dueInDays <= 2 && outstanding > 0
}
