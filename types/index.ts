export interface User {
  id: string
  name: string
  email: string
}

export interface Transaction {
  _id: string
  title: string
  amount: number
  type: 'income' | 'expense'
  category: string
  date: string
  note?: string
  createdAt: string
}

export interface Budget {
  _id: string
  category: string
  limitAmount: number
  month: number
  year: number
}

export interface DashboardStats {
  income: number
  expense: number
  savings: number
  savingsRate: number
  transactionCount: number
}

export interface MonthlySummary {
  month: number
  name: string
  income: number
  expense: number
  savings: number
}

export interface CategoryStat {
  category: string
  total: number
  count: number
  percentage: number
}

export interface UserCategory {
  _id: string
  name: string
  type: 'income' | 'expense'
  color?: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedTransactions {
  transactions: Transaction[]
  total: number
  page: number
  totalPages: number
}

export const CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Health',
  'Shopping',
  'Salary',
  'Freelance',
  'Investment',
  'Education',
  'Utilities',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]
