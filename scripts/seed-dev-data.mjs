import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env.local')
    process.exit(1)
}

const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'Test@1234'
const TEST_NAME = 'Test User'

// Today's real date drives which months get seeded, so "this month" in the
// app always lines up with whatever day the script is run.
const now = new Date()
const thisMonthIdx = now.getMonth() // 0-based
const thisYear = now.getFullYear()

function monthsAgo(n) {
    const d = new Date(thisYear, thisMonthIdx - n, 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
}

function dateIn(monthsBack, day) {
    const { month, year } = monthsAgo(monthsBack)
    return new Date(year, month - 1, day)
}

async function seed() {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db

    // --- User (upsert so the script is safe to re-run) ---
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12)
    const existingUser = await db.collection('users').findOne({ email: TEST_EMAIL })

    let userId
    if (existingUser) {
        userId = existingUser._id
        await db.collection('users').updateOne(
            { _id: userId },
            { $set: { name: TEST_NAME, password: hashedPassword, role: 'user', updatedAt: new Date() } }
        )
        console.log(`Reusing existing user ${TEST_EMAIL} (${userId})`)
    } else {
        const result = await db.collection('users').insertOne({
            name: TEST_NAME,
            email: TEST_EMAIL,
            password: hashedPassword,
            role: 'user',
            refreshTokenHash: '',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        userId = result.insertedId
        console.log(`Created user ${TEST_EMAIL} (${userId})`)
    }

    // Clear this user's existing seeded data so the script can be re-run cleanly.
    await Promise.all([
        db.collection('transactions').deleteMany({ userId }),
        db.collection('budgets').deleteMany({ userId }),
        db.collection('goals').deleteMany({ userId }),
        db.collection('recurringtransactions').deleteMany({ userId }),
        db.collection('categories').deleteMany({ userId }),
        db.collection('cards').deleteMany({ userId }),
    ])
    console.log("Cleared this user's previous seed data")

    // --- Card (created first so transactions below can reference its _id) ---
    // statementDay pinned to today's day-of-month + dueDaysAfterStatement of
    // 3 puts the computed due date 3 days from whenever this script last ran
    // — close enough to exercise the due-reminder cron manually, far enough
    // out not to already be overdue by the time anyone reads the output.
    const cardResult = await db.collection('cards').insertOne({
        userId,
        name: 'HDFC Millennia',
        last4: '4242',
        creditLimit: 50000,
        apr: 36,
        statementDay: now.getDate(),
        dueDaysAfterStatement: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    })
    const cardId = cardResult.insertedId
    console.log(`Inserted 1 card (${cardId})`)

    // --- Categories (a couple of custom ones, alongside the app's built-in list) ---
    await db.collection('categories').insertMany([
        { userId, name: 'Side Hustle', type: 'income', color: '#6ee7b7', createdAt: new Date(), updatedAt: new Date() },
        { userId, name: 'Pet Care', type: 'expense', color: '#fbbf24', createdAt: new Date(), updatedAt: new Date() },
    ])

    // --- Transactions: 4 months of history (3 past + current) ---
    const transactions = []
    const txn = (monthsBack, day, title, amount, type, category, extra = {}) =>
        transactions.push({
            userId,
            title,
            amount,
            type,
            category,
            date: dateIn(monthsBack, day),
            note: extra.note,
            isLent: extra.isLent || false,
            repaid: extra.repaid || false,
            paymentMethod: extra.paymentMethod,
            cardId: extra.cardId,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

    for (let m = 3; m >= 0; m--) {
        // Income
        txn(m, 1, 'Monthly Salary', 60000, 'income', 'Salary')
        if (m === 1 || m === 3) txn(m, 15, 'Freelance Project', 8000, 'income', 'Freelance')

        // Steady recurring-ish expenses
        txn(m, 2, 'Rent', 15000, 'expense', 'Housing')
        txn(m, 5, 'Electricity Bill', 1800, 'expense', 'Utilities')
        txn(m, 10, 'Internet Bill', 900, 'expense', 'Utilities')
        txn(m, 8, 'Groceries', 3200, 'expense', 'Food')
        txn(m, 18, 'Groceries', 2800, 'expense', 'Food')
        txn(m, 12, 'Petrol', 2000, 'expense', 'Transport')
        txn(m, 22, 'Cab rides', 900, 'expense', 'Transport')
        txn(m, 14, 'Movie night', 1200, 'expense', 'Entertainment')
        txn(m, 9, 'Pet food', 600, 'expense', 'Pet Care')
    }

    // This month: deliberately spike Food and Entertainment so the
    // "Where You're Overspending" and "Biggest Movers" panels have
    // something real to show.
    txn(0, 20, 'Weekend dining out', 4200, 'expense', 'Food')
    txn(0, 24, 'Birthday dinner', 3500, 'expense', 'Food')
    txn(0, 25, 'Concert tickets', 3800, 'expense', 'Entertainment')
    txn(0, 26, 'New shoes', 2600, 'expense', 'Shopping')
    txn(0, 5, 'Doctor visit', 1500, 'expense', 'Health')

    // Lent money — one pending, one repaid
    txn(1, 6, 'Lent to Arjun', 5000, 'expense', 'Lent', { isLent: true, repaid: false, note: 'For his rent' })
    txn(2, 11, 'Lent to Priya', 2000, 'expense', 'Lent', { isLent: true, repaid: true, note: 'Movie tickets' })

    // Card-tagged spends this month, plus one payment against the card —
    // per the spec's own testing note to seed "a test card and sample card
    // spends." Both use Shopping/Other (no budget set on either this month)
    // rather than Transport, which already has a budget deliberately seeded
    // to stay "comfortably under" — adding a card spend there would push it
    // over and break that existing demo invariant.
    // Outstanding should read as 3000+1800-2000 = 2800 after seeding.
    txn(0, 7, 'Online electronics', 3000, 'expense', 'Shopping', { paymentMethod: 'card', cardId })
    txn(0, 16, 'Flight booking', 1800, 'expense', 'Other', { paymentMethod: 'card', cardId })
    txn(0, 19, 'Payment to HDFC Millennia', 2000, 'card_payment', 'Card Payment', { cardId })

    await db.collection('transactions').insertMany(transactions)
    console.log(`Inserted ${transactions.length} transactions`)

    // --- Budgets for the current month ---
    // Food and Entertainment are deliberately set low so this month's spike
    // pushes them over 100% (exercises BudgetCard's "over budget" state and
    // the daily-cron alert email path). Transport stays comfortably under.
    const { month: curMonth, year: curYear } = monthsAgo(0)
    await db.collection('budgets').insertMany([
        { userId, category: 'Food', limitAmount: 8000, month: curMonth, year: curYear, alert80SentAt: null, alert100SentAt: null, createdAt: new Date(), updatedAt: new Date() },
        { userId, category: 'Entertainment', limitAmount: 4000, month: curMonth, year: curYear, alert80SentAt: null, alert100SentAt: null, createdAt: new Date(), updatedAt: new Date() },
        { userId, category: 'Transport', limitAmount: 4000, month: curMonth, year: curYear, alert80SentAt: null, alert100SentAt: null, createdAt: new Date(), updatedAt: new Date() },
    ])
    console.log('Inserted 3 budgets for the current month')

    // --- Goals ---
    await db.collection('goals').insertMany([
        {
            userId,
            title: 'Emergency Fund',
            targetAmount: 50000,
            targetDate: new Date(thisYear, thisMonthIdx + 6, 1),
            currentAmount: 15000,
            contributions: [
                { amount: 10000, date: dateIn(2, 3), note: 'Initial deposit' },
                { amount: 5000, date: dateIn(1, 3), note: 'Monthly top-up' },
            ],
            createdAt: dateIn(2, 1),
            updatedAt: new Date(),
        },
        {
            userId,
            title: 'New Laptop',
            targetAmount: 80000,
            targetDate: new Date(thisYear, thisMonthIdx + 3, 1),
            currentAmount: 5000,
            contributions: [{ amount: 5000, date: dateIn(1, 10), note: 'First contribution' }],
            createdAt: dateIn(1, 10),
            updatedAt: new Date(),
        },
    ])
    console.log('Inserted 2 goals with contributions')

    // --- Recurring transactions ---
    const nextRent = new Date(thisYear, thisMonthIdx + 1, 2)
    const nextSubscription = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // in 3 days
    const nextGym = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) // in 2 days

    await db.collection('recurringtransactions').insertMany([
        {
            userId,
            title: 'Netflix Subscription',
            amount: 500,
            type: 'expense',
            category: 'Entertainment',
            frequency: 'monthly',
            startDate: dateIn(3, 2),
            nextRunDate: nextSubscription,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            userId,
            title: 'Gym Membership',
            amount: 200,
            type: 'expense',
            category: 'Health',
            frequency: 'weekly',
            startDate: dateIn(2, 1),
            nextRunDate: nextGym,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            userId,
            title: 'Old Magazine Subscription',
            amount: 150,
            type: 'expense',
            category: 'Other',
            frequency: 'monthly',
            startDate: dateIn(3, 15),
            nextRunDate: nextRent,
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ])
    console.log('Inserted 3 recurring transaction templates')

    await mongoose.disconnect()
    console.log('\nDone. Login with:')
    console.log(`  email:    ${TEST_EMAIL}`)
    console.log(`  password: ${TEST_PASSWORD}`)
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
