import { Types } from 'mongoose'
import connectDB from './mongodb'
import Budget from '@/models/Budget'
import User from '@/models/User'
import Transaction from '@/models/Transaction'
import { sendEmail } from './email'

export async function checkAndSendBudgetAlerts(date: Date = new Date()) {
    await connectDB()

    const month = date.getMonth() + 1
    const year = date.getFullYear()

    const budgets = await Budget.find({
        month,
        year,
        $or: [{ alert80SentAt: null }, { alert100SentAt: null }],
    })

    let checked = 0
    let alertsSent = 0

    for (const budget of budgets) {
        checked++
        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0, 23, 59, 59)

        const result = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(budget.userId),
                    type: 'expense',
                    category: budget.category,
                    date: { $gte: monthStart, $lte: monthEnd },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])

        const spent = result[0]?.total || 0
        const percentage = (spent / budget.limitAmount) * 100

        if (percentage < 80) continue

        const user = await User.findById(budget.userId)
        if (!user) continue

        if (percentage >= 100 && !budget.alert100SentAt) {
            await sendEmail({
                to: user.email,
                subject: `Budget exceeded: ${budget.category}`,
                html: `<p>Hello ${user.name},</p><p>You've spent <strong>₹${spent.toLocaleString()}</strong> on <strong>${budget.category}</strong> this month, exceeding your budget of ₹${budget.limitAmount.toLocaleString()}.</p>`,
            })
            budget.alert80SentAt = budget.alert80SentAt || new Date()
            budget.alert100SentAt = new Date()
            await budget.save()
            alertsSent++
        } else if (percentage >= 80 && !budget.alert80SentAt) {
            await sendEmail({
                to: user.email,
                subject: `Budget alert: ${budget.category} at ${Math.round(percentage)}%`,
                html: `<p>Hello ${user.name},</p><p>You've spent <strong>₹${spent.toLocaleString()}</strong> on <strong>${budget.category}</strong> this month — ${Math.round(percentage)}% of your ₹${budget.limitAmount.toLocaleString()} budget.</p>`,
            })
            budget.alert80SentAt = new Date()
            await budget.save()
            alertsSent++
        }
    }

    return { checked, alertsSent }
}
