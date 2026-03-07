import type { Metadata } from 'next'
import { Outfit, DM_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Flo — Personal Finance Tracker',
  description: 'Track your income, expenses, and budgets with beautiful analytics.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmMono.variable}`}>
      <body className="font-outfit">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#13131a',
                color: '#f0f0ff',
                border: '1px solid #2a2a3d',
              },
              success: {
                iconTheme: { primary: '#4ecdc4', secondary: '#13131a' },
              },
              error: {
                iconTheme: { primary: '#ff6b8a', secondary: '#13131a' },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
