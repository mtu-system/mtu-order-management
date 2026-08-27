import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MTU Order Management',
  description: 'Internal Order Management System - PT Mandiri Trans Utama',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}