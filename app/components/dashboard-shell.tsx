'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './logout-button'
import type { UserRole } from '@/lib/auth'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  History,
  ShieldCheck,
  Users,
  BarChart3,
  ScrollText,
  Truck,
} from 'lucide-react'

type DashboardShellProps = {
  children: React.ReactNode
  user: {
    full_name: string | null
    email: string
    role: UserRole
  }
}

type MenuItem = {
  label: string
  href: string
  icon: LucideIcon
}

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname()
  const menus = getMenus(user.role)
  const initial = (user.full_name || user.email || '?').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col bg-[#01236A]">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white">
              MTU Order
            </h1>
            <p className="text-[11px] text-blue-200/70">Management System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-2">
          {menus.map((menu) => {
            const Icon = menu.icon
            const isActive = pathname === menu.href

            return (
              <Link
                key={menu.href}
                href={menu.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-blue-200/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white" />
                )}

                <Icon
                  className={`h-4 w-4 shrink-0 transition ${
                    isActive
                      ? 'text-white'
                      : 'text-blue-200/70 group-hover:text-white'
                  }`}
                />
                {menu.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="ml-64 flex min-h-screen flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-8">
  <p className="text-sm text-gray-400">
    Internal Order Management System
  </p>

  <div className="flex items-center gap-2.5">
    <div className="text-right">
      <p className="text-sm font-medium leading-tight text-gray-900">
        {user.full_name || 'User'}
      </p>
      <p className="text-xs capitalize leading-tight text-gray-400">
        {user.role}
      </p>
    </div>

    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#01236A] text-xs font-semibold text-white">
      {initial}
    </div>
  </div>
</header>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}

function getMenus(role: UserRole): MenuItem[] {
  switch (role) {
    case 'manager':
      return [
        { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
        { label: 'Orders', href: '/manager/orders', icon: ClipboardList },
        { label: 'Monitoring', href: '/manager/monitoring', icon: BarChart3 },
        { label: 'Reports', href: '/manager/reports', icon: ScrollText },
        { label: 'Users', href: '/manager/users', icon: Users },
        {
          label: 'Activity Logs',
          href: '/manager/activity-logs',
          icon: History,
        },
      ]

    case 'marketing':
      return [
        { label: 'Dashboard', href: '/marketing', icon: LayoutDashboard },
        { label: 'Orders', href: '/marketing/orders', icon: ClipboardList },
        {
          label: 'Create Order',
          href: '/marketing/orders/create',
          icon: PlusCircle,
        },
        {
          label: 'Order History',
          href: '/marketing/orders/history',
          icon: History,
        },
      ]

    case 'operational':
      return [
        { label: 'Dashboard', href: '/operational', icon: LayoutDashboard },
        {
          label: 'Waiting Unit',
          href: '/operational/orders',
          icon: ClipboardList,
        },
        { label: 'History', href: '/operational/history', icon: History },
      ]

    case 'hse':
      return [
        { label: 'Waiting Inspection', href: '/hse', icon: ShieldCheck },
        { label: 'Inspection History', href: '/hse/history', icon: History },
      ]

    default:
      return []
  }
}