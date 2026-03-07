import Sidebar from '@/components/Sidebar'
import ChatWidget from '@/components/chat/ChatWidget'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 md:ml-[240px] p-4 md:p-8 pb-24 md:pb-8 min-h-screen bg-[var(--bg)] w-full w-max-[100vw] overflow-x-hidden">
                {children}
            </main>
            <ChatWidget />
        </div>
    )
}
