'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, Tag, TrendingDown, TrendingUp } from 'lucide-react'
import { useCategories } from '@/hooks/useCategories'
import { CATEGORIES } from '@/types'

export default function CategoriesPage() {
    const { categories, loading, addCategory, updateCategory, deleteCategory } = useCategories()
    
    const [isCreating, setIsCreating] = useState(false)
    const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense')
    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    const handleCreate = async () => {
        if (!newCategoryName.trim()) return
        try {
            await addCategory({ name: newCategoryName, type: newCategoryType })
            setIsCreating(false)
            setNewCategoryName('')
        } catch (error) {
            console.error(error)
        }
    }

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) return
        try {
            await updateCategory(id, { name: editName })
            setEditingId(null)
            setEditName('')
        } catch (error) {
            console.error(error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return
        try {
            await deleteCategory(id)
        } catch (error) {
            console.error(error)
        }
    }

    const renderList = (type: 'income' | 'expense') => {
        const customFiltered = categories.filter((c) => c.type === type)
        const builtInFiltered = CATEGORIES.filter(c => type === 'expense' ? c !== 'Salary' && c !== 'Freelance' && c !== 'Investment' : c === 'Salary' || c === 'Freelance' || c === 'Investment')

        return (
            <div className="flex-1 min-w-[100%] lg:min-w-[45%] bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl block" style={{ background: type === 'income' ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255, 107, 138, 0.15)' }}>
                        {type === 'income' ? <TrendingUp size={22} color="var(--income)" /> : <TrendingDown size={22} color="var(--expense)" />}
                    </div>
                    <div>
                        <h3 className="text-[1.2rem] font-bold">
                            {type === 'income' ? 'Income Categories' : 'Expense Categories'}
                        </h3>
                        <p className="text-[0.8rem] text-[var(--muted)]">Default and custom options</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Built-in Defaults */}
                    {builtInFiltered.map((catName) => (
                        <div key={`builtin-${catName}`} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface2)] opacity-80 cursor-default border border-transparent">
                            <div className="flex items-center gap-3">
                                <Tag size={16} className="text-[var(--muted)]" />
                                <span className="font-semibold text-[0.95rem]">{catName}</span>
                            </div>
                            <span className="text-[0.7rem] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 rounded-md text-[var(--muted)] tracking-wide uppercase font-bold">Default</span>
                        </div>
                    ))}

                    {/* Custom Categories */}
                    {customFiltered.map((cat) => (
                        <div key={cat._id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface2)] border border-[rgba(124,106,247,0.2)] shadow-sm transition-all hover:border-[var(--accent-light)] group">
                            {editingId === cat._id ? (
                                <div className="flex items-center gap-2 w-full">
                                    <input
                                        autoFocus
                                        className="flo-input flex-1 !my-0 !py-2"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat._id)}
                                    />
                                    <button onClick={() => handleUpdate(cat._id)} className="p-2 bg-[var(--accent)] text-white rounded-lg hover:brightness-110 active:scale-95 transition-all">
                                        <Check size={16} />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="p-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] active:scale-95 transition-all">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Tag size={16} className="text-[var(--accent)]" />
                                        <span className="font-semibold text-[0.95rem]">{cat.name}</span>
                                    </div>
                                    <div className="flex gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setEditingId(cat._id)
                                                setEditName(cat.name)
                                            }}
                                            className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.05)] rounded-md transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat._id)}
                                            className="p-1.5 text-[var(--expense)] hover:text-white hover:bg-[rgba(255,107,138,0.2)] rounded-md transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    
                    {customFiltered.length === 0 && (
                        <div className="text-center p-6 border border-dashed border-[var(--border)] rounded-xl mt-2">
                            <p className="text-[var(--muted)] text-[0.85rem]">No custom {type} categories added yet.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (loading) return (
        <div className="dashboard-content dashboard-layout flex items-center justify-center min-h-[50vh]">
            <span className="spinner w-8 h-8" />
        </div>
    )

    return (
        <main className="pb-24 md:pb-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-[1.8rem] font-extrabold mb-1">Categories</h1>
                    <p className="text-[var(--muted)] text-[0.875rem]">Manage your income and expense categories.</p>
                </div>
                {!isCreating && (
                    <button onClick={() => setIsCreating(true)} className="btn-primary w-full sm:w-auto shadow-lg shadow-[rgba(124,106,247,0.25)] flex items-center justify-center gap-2">
                        <Plus size={18} /> Add Category
                    </button>
                )}
            </header>

            {isCreating && (
                <div className="bg-[var(--surface)] p-5 md:p-6 rounded-2xl mb-8 border border-[var(--border)] shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                        <div className="flex-1">
                            <label className="flo-label">Category Name</label>
                            <input
                                autoFocus
                                className="flo-input"
                                placeholder="e.g. Subscriptions, Groceries..."
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <div className="w-full sm:w-[150px]">
                            <label className="flo-label">Type</label>
                            <select
                                className="flo-select"
                                value={newCategoryType}
                                onChange={(e) => setNewCategoryType(e.target.value as 'income' | 'expense')}
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            <button onClick={handleCreate} className="btn-primary flex-1 sm:flex-none justify-center" disabled={!newCategoryName.trim()}>Save</button>
                            <button onClick={() => setIsCreating(false)} className="btn-secondary flex-1 sm:flex-none justify-center">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {renderList('expense')}
                {renderList('income')}
            </div>
        </main>
    )
}
