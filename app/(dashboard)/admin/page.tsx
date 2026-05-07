'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { 
  Users, 
  Activity, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  Loader2
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts'
import toast from 'react-hot-toast'

interface Stats {
  totalUsers: number
  activeUsers: number
}

interface ActivityData {
  date: string
  registrations: number
  transactions: number
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activity, setActivity] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/api/admin/stats')
        setStats(response.data.stats)
        setActivity(response.data.activity)
        setAuthorized(true)
      } catch (error: any) {
        if (error.response?.status === 403) {
          toast.error('You do not have admin access')
          router.push('/dashboard')
        } else {
          toast.error('Failed to load admin stats')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-indigo-400" />
            Admin Control Center
          </h1>
          <p className="text-slate-400 mt-2">Monitor platform growth and user engagement</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Total Platform Users" 
          value={stats?.totalUsers || 0} 
          icon={<Users className="w-6 h-6" />}
          trend="+12%"
          trendUp={true}
          gradient="from-blue-600 to-indigo-600"
        />
        <StatCard 
          title="Active Users (30d)" 
          value={stats?.activeUsers || 0} 
          icon={<Activity className="w-6 h-6" />}
          trend="+5.4%"
          trendUp={true}
          gradient="from-emerald-600 to-teal-600"
        />
        <StatCard 
          title="Conversion Rate" 
          value={`${((stats?.activeUsers || 0) / (stats?.totalUsers || 1) * 100).toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6" />}
          trend="-0.8%"
          trendUp={false}
          gradient="from-violet-600 to-purple-600"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            Platform Activity (Last 7 Days)
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
                <defs>
                  <linearGradient id="colorTrans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" />
                <Area 
                  name="Transactions"
                  type="monotone" 
                  dataKey="transactions" 
                  stroke="#818cf8" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorTrans)" 
                />
                <Area 
                  name="New Users"
                  type="monotone" 
                  dataKey="registrations" 
                  stroke="#2dd4bf" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorReg)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <h3 className="text-xl font-semibold text-white mb-6">User Acquisition</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{fill: '#ffffff05'}}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar 
                  name="Registrations"
                  dataKey="registrations" 
                  fill="#c084fc" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

const StatCard = ({ title, value, icon, trend, trendUp, gradient }: any) => (
  <div className={`relative overflow-hidden p-6 rounded-3xl border border-white/10 bg-gradient-to-br ${gradient} bg-opacity-10 group transition-all duration-300 hover:scale-[1.02]`}>
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      {React.cloneElement(icon, { className: "w-24 h-24" })}
    </div>
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-2xl bg-white/10 text-white">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-white/10 ${trendUp ? 'text-emerald-300' : 'text-rose-300'}`}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <h4 className="text-slate-200 text-sm font-medium">{title}</h4>
      <div className="text-3xl font-bold text-white mt-1">{value}</div>
    </div>
  </div>
)

export default AdminDashboard
