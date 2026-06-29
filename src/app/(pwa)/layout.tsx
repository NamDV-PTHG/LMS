import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import BottomNav from '@/components/pwa/bottom-nav'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ToastProvider } from '@/components/ui/toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LMS',
  },
  formatDetection: { telephone: false },
  title: 'LMS — Học viên',
  description: 'Ứng dụng học tập nội bộ',
}

export const viewport: Viewport = {
  themeColor: '#185FA5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function PWALayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} font-sans`}>
      <AuthProvider>
        <ToastProvider>
          {children}
          <BottomNav />
        </ToastProvider>
      </AuthProvider>
    </div>
  )
}
