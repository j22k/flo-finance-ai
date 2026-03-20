'use client'

import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { Transaction, CATEGORIES } from '@/types'
import TransactionForm from '@/components/TransactionForm'

export default function TransactionsPage() {
    const { categories } = useCategories()
    const allCategories = Array.from(new Set([...CATEGORIES, ...categories.map(c => c.name)]))
    
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1)
    const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear())
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const {
        transactions,
        total,
        totalPages,
        loading,
        createTransaction,
        updateTransaction,
        deleteTransaction,
    } = useTransactions({
        type: typeFilter,
        category: categoryFilter,
        month: monthFilter,
        year: yearFilter,
        page,
        limit: 20,
    })

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTx, setEditingTx] = useState<Transaction | undefined>()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleCreate = async (data: Omit<Transaction, '_id' | 'createdAt'>) => {
        await createTransaction(data)
        setIsModalOpen(false)
    }

    const handleUpdate = async (data: Omit<Transaction, '_id' | 'createdAt'>) => {
        if (editingTx) {
            await updateTransaction(editingTx._id, data)
            setEditingTx(undefined)
            setIsModalOpen(false)
        }
    }

    const handleDelete = async (id: string) => {
        await deleteTransaction(id)
        setDeletingId(null)
    }

    const filteredTx = transactions.filter((tx) =>
        tx.title.toLowerCase().includes(search.toLowerCase())
    )

    const MONTHS = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }),
    }))

    const YEARS = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold text-[var(--text)]">Transactions</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">View and manage your income and expenses.</p>
                </div>
                <button
                    onClick={() => { setEditingTx(undefined); setIsModalOpen(true) }}
                    className="btn-primary w-full sm:w-auto justify-center"
                >
                    <Plus size={18} /> Add Transaction
                </button>
            </div>

            {/* Filters */}
            <div className="flo-card mb-6 p-4 md:px-5 md:py-4 flex flex-col xl:flex-row gap-4 xl:items-center">
                <div className="flex items-center gap-2 flex-1 w-full xl:min-w-[200px]">
                    <Search size={18} color="var(--muted)" />
                    <input
                        type="text"
                        placeholder="Search by title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
                    />
                </div>

                <div className="hidden xl:block w-[1px] h-6 bg-[var(--border)]" />

                <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto overflow-x-auto">
                    <div className="flex items-center gap-1.5">
                        <Filter size={16} color="var(--muted)" />
                        <span className="text-[0.75rem] text-[var(--muted)] font-bold tracking-wider uppercase">FILTER:</span>
                    </div>

                    <select className="flo-select w-full sm:w-[120px] py-1.5 px-2.5" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <option value="all">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                    </select>

                    <select className="flo-select w-full sm:w-[160px] py-1.5 px-2.5" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                        <option value="all">All Categories</option>
                        {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select className="flo-select w-full sm:w-[130px] py-1.5 px-2.5" value={monthFilter} onChange={(e) => { setMonthFilter(Number(e.target.value)); setPage(1); }}>
                        {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>

                    <select className="flo-select w-full sm:w-[100px] py-1.5 px-2.5" value={yearFilter} onChange={(e) => { setYearFilter(Number(e.target.value)); setPage(1); }}>
                        {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="flo-card" style={{ padding: '0', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                        <span className="spinner" style={{ width: '32px', height: '32px' }} />
                    </div>
                ) : filteredTx.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                        <p style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text)' }}>No transactions found</p>
                        <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>Try adjusting your filters or add a new transaction.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="flo-table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '24px' }}>Title</th>
                                    <th>Category</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTx.map((tx) => (
                                    <tr key={tx._id}>
                                        <td style={{ paddingLeft: '24px' }}>
                                            <p style={{ fontWeight: 600, color: 'var(--text)' }}>{tx.title}</p>
                                            {tx.note && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>{tx.note}</p>}
                                        </td>
                                        <td><span className="badge badge-category">{tx.category}</span></td>
                                        <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{format(new Date(tx.date), 'MMMM d, yyyy')}</td>
                                        <td><span className={`badge badge-${tx.type}`}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</span></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="amount" style={{ color: tx.type === 'income' ? 'var(--income)' : 'var(--expense)', fontWeight: 600, fontSize: '1.05rem' }}>
                                                {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button
                                                    onClick={() => { setEditingTx(tx); setIsModalOpen(true); }}
                                                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingId(tx._id)}
                                                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--expense)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            Showing {filteredTx.length} of {total} transactions
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <button
                                className="btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                disabled={page === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <TransactionForm
                    initialData={editingTx}
                    onClose={() => { setIsModalOpen(false); setEditingTx(undefined); }}
                    onSubmit={editingTx ? handleUpdate : handleCreate}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deletingId && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                        <div style={{ background: 'rgba(255,107,138,0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <Trash2 size={32} color="var(--expense)" />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Delete Transaction?</h2>
                        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                            This action cannot be undone. This will permanently delete this transaction from your account.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDeletingId(null)}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                style={{ flex: 1, justifyContent: 'center', background: 'var(--expense)' }}
                                onClick={() => handleDelete(deletingId)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
