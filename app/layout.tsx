import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/app/components/toast-provider'
import { ConfirmDialogProvider } from '@/app/components/confirm-dialog-provider'

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
    <html lang="id">
      <body>
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  )
}