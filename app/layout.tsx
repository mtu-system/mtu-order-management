import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/app/components/toast-provider'
import { ConfirmDialogProvider } from '@/app/components/confirm-dialog-provider'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'MTU Order Management',
  description: 'Internal Order Management System - PT Mandiri Trans Utama',
  icons: {
    icon: '/mtu.png',
    shortcut: '/mtu.png',
    apple: '/mtu.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans">
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  )
}