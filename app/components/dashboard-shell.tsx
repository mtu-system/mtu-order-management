'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  Activity,
  XCircle,
  Truck,
  CalendarClock,
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

const ROLE_LABEL: Record<UserRole, string> = {
  manager: 'Manager',
  marketing: 'Marketing',
  marketing_admin: 'Marketing Admin',
  operational: 'Operational',
  hse: 'HSE',
  vm: 'Vendor Management',
  pending: 'Pending',
}

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname()
  const menus = getMenus(user.role)
  const activeMenu = menus.find((menu) => menu.href === pathname)
  const initial = (user.full_name || user.email || '?').charAt(0).toUpperCase()
  const firstName = (user.full_name || user.email || 'User').split(' ')[0]

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-gray-200 bg-white px-3 py-4">
        <div className="mb-3 flex items-center gap-2.5 border-b border-gray-200 px-2 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-white p-1">
            <Image
              src="/mtu.png"
              alt="Mandiri Trucking"
              width={28}
              height={22}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-[13.5px] font-bold leading-tight text-gray-900">
              MTU Order
            </h1>
            <p className="text-[10.5px] text-gray-400">Control Tower</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {menus.map((menu) => {
            const Icon = menu.icon
            const isActive = pathname === menu.href

            return (
              <Link
                key={menu.href}
                href={menu.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
                  isActive
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {menu.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-200 pt-3">
          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="flex h-[62px] items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="flex items-center gap-2 text-[12.5px] text-gray-400">
            <span>{ROLE_LABEL[user.role]}</span>
            <span>/</span>
            <span className="font-semibold text-gray-900">
              {activeMenu?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
              {initial}
            </div>
            <div className="text-right">
              <p className="text-[13px] font-semibold leading-tight text-gray-800">
                {firstName}
              </p>
              <p className="text-[11px] capitalize leading-tight text-gray-400">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
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
        {
          label: 'Activity Logs',
          href: '/manager/activity-logs',
          icon: History,
        },
        {
          label: 'Reject Report',
          href: '/manager/reject-report',
          icon: XCircle,
        },
        {
          label: 'Booking Report',
          href: '/manager/booking-report',
          icon: CalendarClock,
        },
        {
          label: 'Customer Overview',
          href: '/manager/customer-overview',
          icon: Users,
        },
      ]

    case 'marketing':
    case 'marketing_admin':
      return [
        { label: 'Dashboard', href: '/marketing', icon: LayoutDashboard },
        { label: 'Orders', href: '/marketing/orders', icon: ClipboardList },
        {
          label: 'Create Order',
          href: '/marketing/orders/create',
          icon: PlusCircle,
        },
        { label: 'Aktivitas', href: '/marketing/activity', icon: Activity },
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
        { label: 'Aktivitas', href: '/operational/activity', icon: Activity },
        { label: 'History', href: '/operational/history', icon: History },
      ]

    case 'hse':
      return [
        { label: 'Waiting Inspection', href: '/hse', icon: ShieldCheck },
        { label: 'Aktivitas', href: '/hse/activity', icon: Activity },
        { label: 'Inspection History', href: '/hse/history', icon: History },
      ]

    case 'vm':
      return [
        { label: 'Unit Vendor', href: '/vm', icon: Truck },
      ]

    default:
      return []
  }
}
