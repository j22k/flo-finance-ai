import { Types } from 'mongoose'
import connectDB from './mongodb'
import Transaction from '@/models/Transaction'
import User, { IUser } from '@/models/User'
import { sendEmail } from './email'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function generateAndSendMonthlyReport(user: any, date: Date = new Date()) {
    try {
        await connectDB()
        
        // If we are running this on the 1st of the month, we want the PREVIOUS month's data
        const reportDate = subMonths(date, 0) // Default to current month for manual, but logic can be adjusted
        const monthStart = startOfMonth(reportDate)
        const monthEnd = endOfMonth(reportDate)
        const monthName = format(reportDate, 'MMMM yyyy')

        // Fetch Stats
        const statsResult = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(user._id),
                    date: { $gte: monthStart, $lte: monthEnd },
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ])

        let income = 0
        let expense = 0
        statsResult.forEach((r) => {
            if (r._id === 'income') income = r.total
            if (r._id === 'expense') expense = r.total
        })

        const categoryResult = await Transaction.aggregate([
            {
                $match: {
                    userId: new Types.ObjectId(user._id),
                    date: { $gte: monthStart, $lte: monthEnd },
                    type: 'expense'
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                },
            },
            { $sort: { total: -1 } },
            { $limit: 10 }
        ])

        const savings = income - expense
        const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(1) : '0'

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { 
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #1a1a1a; 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 40px 20px;
                        background-color: #ffffff;
                    }
                    .header { 
                        border-bottom: 2px solid #7c6af7;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .report-title {
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        color: #7c6af7;
                        margin: 0;
                        font-weight: 700;
                    }
                    .report-period {
                        font-size: 24px;
                        color: #0a0a0f;
                        margin: 5px 0 0 0;
                        font-weight: 400;
                    }
                    .summary-section {
                        margin-bottom: 40px;
                    }
                    .stats-container {
                        display: flex;
                        width: 100%;
                        margin: 20px 0;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .stat-item {
                        flex: 1;
                        padding: 20px;
                        text-align: left;
                    }
                    .stat-item:not(:last-child) {
                        border-right: 1px solid #e5e7eb;
                    }
                    .label {
                        font-size: 11px;
                        text-transform: uppercase;
                        color: #6b7280;
                        margin-bottom: 8px;
                        font-weight: 600;
                    }
                    .value {
                        font-size: 20px;
                        font-weight: 700;
                        color: #111827;
                    }
                    .income-value { color: #059669; }
                    .expense-value { color: #dc2626; }
                    
                    .table-title {
                        font-size: 14px;
                        font-weight: 700;
                        color: #111827;
                        margin: 40px 0 15px 0;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #f3f4f6;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .table th {
                        text-align: left;
                        font-size: 11px;
                        text-transform: uppercase;
                        color: #6b7280;
                        padding: 10px 0;
                        border-bottom: 1px solid #f3f4f6;
                    }
                    .table td {
                        padding: 12px 0;
                        font-size: 14px;
                        border-bottom: 1px solid #f3f4f6;
                    }
                    .amount-col {
                        text-align: right;
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: 600;
                    }
                    .footer {
                        margin-top: 60px;
                        padding-top: 20px;
                        border-top: 1px solid #f3f4f6;
                        font-size: 11px;
                        color: #9ca3af;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <p class="report-title">Financial Statement</p>
                    <h1 class="report-period">${monthName}</h1>
                </div>

                <p>Hello ${user.name},</p>
                <p>Please find your summarized financial activity for the period of ${monthName}.</p>

                <div class="stats-container">
                    <div class="stat-item">
                        <div class="label">Total Income</div>
                        <div class="value income-value">$${income.toLocaleString()}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Total Expenses</div>
                        <div class="value expense-value">$${expense.toLocaleString()}</div>
                    </div>
                    <div class="stat-item">
                        <div class="label">Net Savings</div>
                        <div class="value" style="color: #7c6af7;">$${savings.toLocaleString()}</div>
                    </div>
                </div>

                <div class="table-title">Spending by Category</div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th class="amount-col">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categoryResult.length > 0 ? categoryResult.map(c => `
                            <tr>
                                <td>${c._id}</td>
                                <td class="amount-col">$${c.total.toLocaleString()}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="2" style="text-align: center; color: #9ca3af; padding: 20px;">No expense data recorded for this period.</td>
                            </tr>
                        `}
                    </tbody>
                </table>

                <div class="footer">
                    This is an automated report generated by Flo Finance Tracker.
                    <br>
                    Confidential Report.
                </div>
            </body>
            </html>
        `

        return await sendEmail({
            to: user.email,
            subject: `Financial Report - ${monthName}`,
            html
        })
    } catch (error) {
        console.error(`Error sending report to ${user.email}:`, error)
        return { success: false, error }
    }
}
