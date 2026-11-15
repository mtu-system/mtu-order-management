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
  MapPin,
  Map as MapIcon,
  Link2,
  Target,
  Route as RouteIcon,
  Radar,
  BellRing,
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

type MenuGroup = {
  title?: string
  items: MenuItem[]
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
  const groups = getMenuGroups(user.role)
  const allMenus = groups.flatMap((group) => group.items)
  const activeMenu = allMenus.find((menu) => menu.href === pathname)
  const initial = (user.full_name || user.email || '?').charAt(0).toUpperCase()
  const firstName = (user.full_name || user.email || 'User').split(' ')[0]

  return (
    <div className="app-bg min-h-screen">
      {/* SIDEBAR — menu scroll sendiri, user + logout selalu terlihat */}
      <aside className="glass fixed bottom-4 left-4 top-4 z-30 flex w-[244px] flex-col rounded-3xl px-3 pb-3 pt-4">
        <div className="mb-2 flex items-center gap-2.5 px-2 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-[0_2px_8px_rgba(8,40,104,0.12)]">
            <Image
              src="/mtu.png"
              alt="Mandiri Trucking"
              width={30}
              height={26}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-[14px] font-extrabold leading-tight text-[#082868]">
              MTU Order
            </h1>
            <p className="text-[11px] text-slate-500">Control Tower</p>
          </div>
        </div>

        <nav className="nav-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {groups.map((group, index) => (
            <div key={group.title || `group-${index}`} className="mb-1">
              {group.title && (
                <p className="px-3 pb-1.5 pt-5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#082868]/60">
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((menu) => {
                  const Icon = menu.icon
                  const isActive = pathname === menu.href

                  return (
                    <Link
                      key={menu.href}
                      href={menu.href}
                      prefetch={false}
                      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition ${
                        isActive
                          ? 'bg-[#082868] font-semibold text-white shadow-[0_6px_16px_rgba(8,40,104,0.28)]'
                          : 'text-slate-700 hover:bg-[#082868]/[0.06] hover:text-[#082868]'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isActive ? 'bg-white/15' : 'bg-[#082868]/[0.07]'
                        }`}
                      >
                        <Icon className="h-[17px] w-[17px]" />
                      </span>
                      {menu.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-2 shrink-0 border-t border-[#082868]/10 pt-3">
          <div className="mb-2.5 flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#082868] to-[#1E4DB7] text-sm font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-slate-800">
                {user.full_name || firstName}
              </p>
              <p className="text-[11px] leading-tight text-slate-500">
                {ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* KONTEN */}
      <div className="flex min-h-screen flex-col gap-4 p-4 pl-[276px]">
        <header className="glass flex h-[60px] shrink-0 items-center justify-between rounded-2xl px-5">
          <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
            <span>{ROLE_LABEL[user.role]}</span>
            <span>/</span>
            <span className="font-semibold text-slate-900">
              {activeMenu?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-[#082868]/[0.07] px-3 py-1 text-[12px] font-semibold text-[#082868] sm:inline">
              {new Date().toLocaleDateString('id-ID', {
                timeZone: 'Asia/Jakarta',
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#082868] to-[#1E4DB7] text-xs font-bold text-white">
              {initial}
            </div>
          </div>
        </header>

        <main className="app-glass flex-1">{children}</main>
      </div>
    </div>
  )
}

function getMenuGroups(role: UserRole): MenuGroup[] {
  switch (role) {
    case 'manager':
      return [
        {
          items: [
            { label: 'Dashboard', href: '/manager', icon: LayoutDashboard },
          ],
        },
        {
          title: 'Order',
          items: [
            { label: 'Orders', href: '/manager/orders', icon: ClipboardList },
            {
              label: 'Activity Logs',
              href: '/manager/activity-logs',
              icon: History,
            },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            {
              label: 'Control Tower',
              href: '/manager/control-tower',
              icon: Radar,
            },
            { label: 'Peringatan', href: '/manager/alerts', icon: BellRing },
            {
              label: 'Laporan Keselamatan',
              href: '/manager/safety-report',
              icon: ShieldCheck,
            },
            {
              label: 'Monitoring',
              href: '/manager/monitoring',
              icon: MapPin,
            },
            { label: 'Live Map', href: '/manager/live-map', icon: MapIcon },
          ],
        },
        {
          title: 'Laporan',
          items: [
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
            {
              label: 'Laporan Unit',
              href: '/manager/unit-report',
              icon: RouteIcon,
            },
          ],
        },
        {
          title: 'Pengaturan',
          items: [
            { label: 'Unit GPS', href: '/manager/gps-devices', icon: Link2 },
            { label: 'Geofence', href: '/manager/geofences', icon: Target },
          ],
        },
      ]

    case 'marketing':
    case 'marketing_admin':
      return [
        {
          items: [
            { label: 'Dashboard', href: '/marketing', icon: LayoutDashboard },
          ],
        },
        {
          title: 'Order',
          items: [
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
            { label: 'Aktivitas', href: '/marketing/activity', icon: Activity },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            {
              label: 'Control Tower',
              href: '/marketing/control-tower',
              icon: Radar,
            },
            {
              label: 'Monitoring',
              href: '/marketing/monitoring',
              icon: MapPin,
            },
            { label: 'Live Map', href: '/marketing/live-map', icon: MapIcon },
            {
              label: 'Laporan Unit',
              href: '/marketing/unit-report',
              icon: RouteIcon,
            },
          ],
        },
      ]

    case 'operational':
      return [
        {
          items: [
            { label: 'Dashboard', href: '/operational', icon: LayoutDashboard },
          ],
        },
        {
          title: 'Order',
          items: [
            {
              label: 'Waiting Unit',
              href: '/operational/orders',
              icon: ClipboardList,
            },
            {
              label: 'Aktivitas',
              href: '/operational/activity',
              icon: Activity,
            },
            { label: 'History', href: '/operational/history', icon: History },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            {
              label: 'Control Tower',
              href: '/operational/control-tower',
              icon: Radar,
            },
            {
              label: 'Peringatan',
              href: '/operational/alerts',
              icon: BellRing,
            },
            {
              label: 'Laporan Keselamatan',
              href: '/operational/safety-report',
              icon: ShieldCheck,
            },
            {
              label: 'Monitoring',
              href: '/operational/monitoring',
              icon: MapPin,
            },
            { label: 'Live Map', href: '/operational/live-map', icon: MapIcon },
            {
              label: 'Laporan Unit',
              href: '/operational/unit-report',
              icon: RouteIcon,
            },
          ],
        },
        {
          title: 'Pengaturan',
          items: [
            {
              label: 'Unit GPS',
              href: '/operational/gps-devices',
              icon: Link2,
            },
            {
              label: 'Geofence',
              href: '/operational/geofences',
              icon: Target,
            },
          ],
        },
      ]

    case 'hse':
      return [
        {
          title: 'Inspeksi',
          items: [
            { label: 'Waiting Inspection', href: '/hse', icon: ShieldCheck },
            { label: 'Aktivitas', href: '/hse/activity', icon: Activity },
            {
              label: 'Inspection History',
              href: '/hse/history',
              icon: History,
            },
          ],
        },
        {
          title: 'Laporan',
          items: [
            {
              label: 'Laporan Keselamatan',
              href: '/hse/safety-report',
              icon: ShieldCheck,
            },
          ],
        },
      ]

    case 'vm':
      return [
        {
          items: [{ label: 'Unit Vendor', href: '/vm', icon: Truck }],
        },
      ]

    default:
      return []
  }
}