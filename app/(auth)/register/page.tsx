'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Waves, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
    if (password.length === 0) return { level: 0, label: '', color: '' }
    if (password.length < 8) return { level: 1, label: 'Weak', color: 'var(--expense)' }
    const hasNumber = /\d/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasSpecial = /[!@#$%^&*]/.test(password)
    const score = [hasNumber, hasUpper, hasSpecial].filter(Boolean).length
    if (score === 0) return { level: 1, label: 'Weak', color: 'var(--expense)' }
    if (score === 1) return { level: 2, label: 'Medium', color: 'var(--warning)' }
    return { level: 3, label: 'Strong', color: 'var(--income)' }
}

export default function RegisterPage() {
    const router = useRouter()
    const { register, login } = useAuth()

    const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const strength = getPasswordStrength(formData.password)

    const validate = () => {
        const errors: Record<string, string> = {}
        if (!formData.name.trim()) errors.name = 'Name is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format'
        if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters'
        if (!/\d/.test(formData.password)) errors.password = 'Password must contain a number'
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match'
        return errors
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const errors = validate()
        setFieldErrors(errors)
        if (Object.keys(errors).length > 0) return

        setLoading(true)
        try {
            await register(formData.name, formData.email, formData.password)
            // Auto-login after registration
            await login(formData.email, formData.password)
            toast.success('Account created! Welcome to Flo 🎉')
            window.location.href = '/dashboard'
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Registration failed'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124, 106, 247, 0.12) 0%, #0a0a0f 70%)' }}>
            <div className="w-full max-w-[440px]">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-3">
                        <div style={{ background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)', borderRadius: '12px', padding: '8px' }}>
                            <Waves size={28} color="white" />
                        </div>
                        <span className="text-4xl font-bold gradient-text">Flo</span>
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Start tracking your finances today</p>
                </div>

                <div className="flo-card" style={{ borderRadius: '20px' }}>
                    <h1 className="text-2xl font-bold mb-1">Create account</h1>
                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '24px' }}>Join Flo and take control of your money</p>

                    {error && (
                        <div style={{ background: 'rgba(255, 107, 138, 0.1)', border: '1px solid rgba(255, 107, 138, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: 'var(--expense)', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Full Name</label>
                            <input
                                type="text"
                                className="flo-input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                            {fieldErrors.name && <p style={{ color: 'var(--expense)', fontSize: '0.78rem', marginTop: '4px' }}>{fieldErrors.name}</p>}
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Email</label>
                            <input
                                type="email"
                                className="flo-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            {fieldErrors.email && <p style={{ color: 'var(--expense)', fontSize: '0.78rem', marginTop: '4px' }}>{fieldErrors.email}</p>}
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label className="flo-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="flo-input"
                                    placeholder="Min. 8 characters with a number"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                            {formData.password && (
                                <div style={{ marginTop: '6px' }}>
                                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= strength.level ? strength.color : 'var(--border)', transition: 'background 0.3s' }} />
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: strength.color }}>{strength.label}</p>
                                </div>
                            )}
                            {fieldErrors.password && <p style={{ color: 'var(--expense)', fontSize: '0.78rem', marginTop: '4px' }}>{fieldErrors.password}</p>}
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label className="flo-label">Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="flo-input"
                                    placeholder="Repeat password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    style={{ paddingRight: '44px' }}
                                />
                                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--income)' }}>
                                        <Check size={18} />
                                    </div>
                                )}
                            </div>
                            {fieldErrors.confirmPassword && <p style={{ color: 'var(--expense)', fontSize: '0.78rem', marginTop: '4px' }}>{fieldErrors.confirmPassword}</p>}
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
                                <>Create Account <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>

                    <div className="divider" />

                    <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>
                        Already have an account?{' '}
                        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
