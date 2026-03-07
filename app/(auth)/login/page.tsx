'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Waves, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuth()

    const [formData, setFormData] = useState({ email: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await login(formData.email, formData.password)
            toast.success('Welcome back!')
            window.location.href = '/dashboard'
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Invalid credentials'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124, 106, 247, 0.12) 0%, #0a0a0f 70%)' }}>
            <div className="w-full max-w-[420px]">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-3">
                        <div style={{ background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)', borderRadius: '12px', padding: '8px' }}>
                            <Waves size={28} color="white" />
                        </div>
                        <span className="text-4xl font-bold gradient-text" style={{ fontFamily: 'var(--font-outfit)' }}>Flo</span>
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Your personal finance companion</p>
                </div>

                {/* Card */}
                <div className="flo-card" style={{ borderRadius: '20px' }}>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>Welcome back</h1>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '24px' }}>Sign in to your account</p>

                    {error && (
                        <div style={{ background: 'rgba(255, 107, 138, 0.1)', border: '1px solid rgba(255, 107, 138, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: 'var(--expense)', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label className="flo-label">Email</label>
                            <input
                                type="email"
                                className="flo-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="flo-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="flo-input"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    style={{ paddingRight: '44px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem' }}
                        >
                            {loading ? (
                                <span className="spinner" style={{ width: '18px', height: '18px' }} />
                            ) : (
                                <>Sign In <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>

                    <div className="divider" />

                    <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Don&apos;t have an account?{' '}
                        <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
