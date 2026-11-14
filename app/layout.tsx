import type { Metadata } from 'next'
import '@fontsource-variable/inter'
import './globals.css'
import { ToastProvider } from '@/app/components/toast-provider'
import { ConfirmDialogProvider } from '@/app/components/confirm-dialog-provider'
import NavigationLoadingProvider from '@/app/components/navigation-loading-provider'
import AlertWatcher from '@/app/components/alert-watcher'


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
      <body className="font-sans">
             <ToastProvider>
          <ConfirmDialogProvider>
            <NavigationLoadingProvider><AlertWatcher />
{children}</NavigationLoadingProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  )
}