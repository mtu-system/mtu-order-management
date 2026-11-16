'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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
  ChevronDown,
  MoreHorizontal,
  Menu,
  X,
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
  // Menu yang jarang dipakai: tidak tampil di grup, masuk ke "Lainnya".
  overflow?: boolean
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

function collapsedStorageKey(role: UserRole) {
  return `mtu-nav-collapsed:${role}`
}

// Status lipat grup disimpan di localStorage, dibaca lewat
// useSyncExternalStore supaya aman saat SSR (server selalu "[]").
const COLLAPSED_EVENT = 'mtu-nav-collapsed'

function readCollapsedRaw(role: UserRole) {
  try {
    return window.localStorage.getItem(collapsedStorageKey(role)) || '[]'
  } catch {
    return '[]'
  }
}

function parseCollapsed(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCollapsed(role: UserRole, titles: string[]) {
  try {
    window.localStorage.setItem(collapsedStorageKey(role), JSON.stringify(titles))
  } catch {
    // localStorage tidak tersedia (private mode, dsb) -- abaikan.
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT))
}

function subscribeCollapsed(callback: () => void) {
  window.addEventListener(COLLAPSED_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname()
  const groups = getMenuGroups(user.role)
  const allMenus = groups.flatMap((group) => group.items)
  const overflowMenus = allMenus.filter((menu) => menu.overflow)
  const activeMenu = allMenus.find((menu) => menu.href === pathname)
  const initial = (user.full_name || user.email || '?').charAt(0).toUpperCase()
  const firstName = (user.full_name || user.email || 'User').split(' ')[0]

  const collapsedRaw = useSyncExternalStore(
    subscribeCollapsed,
    () => readCollapsedRaw(user.role),
    () => '[]'
  )
  const collapsed = useMemo(() => parseCollapsed(collapsedRaw), [collapsedRaw])
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navPath, setNavPath] = useState(pathname)
  const moreRef = useRef<HTMLDivElement>(null)

  // Tutup popover & sidebar mobile saat pindah halaman.
  if (navPath !== pathname) {
    setNavPath(pathname)
    setMoreOpen(false)
    setMobileOpen(false)
  }

  useEffect(() => {
    if (!moreOpen) return

    function onPointerDown(event: PointerEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [moreOpen])

  function toggleGroup(title: string) {
    const next = collapsed.includes(title)
      ? collapsed.filter((item) => item !== title)
      : [...collapsed, title]
    writeCollapsed(user.role, next)
  }

  const overflowActive = overflowMenus.some((menu) => menu.href === pathname)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-[var(--border)] bg-white transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4">
          <Image
            src="/mtu.png"
            alt="Mandiri Trucking"
            width={28}
            height={24}
            className="h-6 w-auto object-contain"
          />
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold leading-tight text-[var(--mtu-navy)]">
              MTU Order
            </p>
            <p className="text-[11px] leading-tight text-slate-500">
              {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        <nav className="nav-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {groups.map((group, index) => {
            const items = group.items.filter((menu) => !menu.overflow)
            if (items.length === 0) return null

            const title = group.title
            const containsActive = items.some((menu) => menu.href === pathname)
            const isCollapsed =
              Boolean(title) && collapsed.includes(title as string) && !containsActive

            return (
              <div key={title || `group-${index}`} className={index > 0 ? 'mt-3' : ''}>
                {title && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(title)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 hover:text-slate-800"
                  >
                    {title}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>
                )}

                {!isCollapsed && (
                  <div className="mt-0.5 flex flex-col gap-px">
                    {items.map((menu) => (
                      <NavLink
                        key={menu.href}
                        menu={menu}
                        active={pathname === menu.href}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {overflowMenus.length > 0 && (
            <div ref={moreRef} className="relative mt-3">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className={`relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition ${
                  overflowActive || moreOpen
                    ? 'bg-[var(--mtu-navy)]/[0.07] text-[var(--mtu-navy)]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {overflowActive && (
                  <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--mtu-navy)]" />
                )}
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                Lainnya
                {overflowActive && activeMenu && (
                  <span className="ml-auto truncate text-[11px] font-semibold">
                    {activeMenu.label}
                  </span>
                )}
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border border-[var(--border)] bg-white p-1 shadow-lg"
                >
                  {overflowMenus.map((menu) => (
                    <NavLink
                      key={menu.href}
                      menu={menu}
                      active={pathname === menu.href}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mtu-navy)] text-[13px] font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-slate-800">
                {user.full_name || firstName}
              </p>
              <p className="truncate text-[11px] leading-tight text-slate-500">
                {user.email}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* KONTEN */}
      <div className="flex min-h-screen flex-col lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[13px] text-slate-500">
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <span className="hidden sm:inline">{ROLE_LABEL[user.role]}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-semibold text-slate-900">
              {activeMenu?.label || 'Dashboard'}
            </span>
          </div>

          <span className="hidden shrink-0 text-[12.5px] font-medium text-slate-500 sm:inline">
            {new Date().toLocaleDateString('id-ID', {
              timeZone: 'Asia/Jakarta',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </header>

        <main className="app-main flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  )
}

function NavLink({ menu, active }: { menu: MenuItem; active: boolean }) {
  const Icon = menu.icon

  return (
    <Link
      href={menu.href}
      prefetch={false}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition ${
        active
          ? 'bg-[var(--mtu-navy)]/[0.07] font-semibold text-[var(--mtu-navy)]'
          : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--mtu-navy)]" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{menu.label}</span>
    </Link>
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
            { label: 'Activity Logs', href: '/manager/activity-logs', icon: History },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            { label: 'Control Tower', href: '/manager/control-tower', icon: Radar },
            { label: 'Peringatan', href: '/manager/alerts', icon: BellRing },
            { label: 'Monitoring', href: '/manager/monitoring', icon: MapPin },
            { label: 'Live Map', href: '/manager/live-map', icon: MapIcon },
          ],
        },
        {
          title: 'Laporan',
          items: [
            { label: 'Laporan Keselamatan', href: '/manager/safety-report', icon: ShieldCheck },
            { label: 'Reject Report', href: '/manager/reject-report', icon: XCircle },
            { label: 'Booking Report', href: '/manager/booking-report', icon: CalendarClock },
            { label: 'Customer Overview', href: '/manager/customer-overview', icon: Users },
            { label: 'Laporan Unit', href: '/manager/unit-report', icon: RouteIcon, overflow: true },
          ],
        },
        {
          title: 'Pengaturan',
          items: [
            { label: 'Unit GPS', href: '/manager/gps-devices', icon: Link2, overflow: true },
            { label: 'Geofence', href: '/manager/geofences', icon: Target, overflow: true },
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
            { label: 'Create Order', href: '/marketing/orders/create', icon: PlusCircle },
            { label: 'Order History', href: '/marketing/orders/history', icon: History },
            { label: 'Aktivitas', href: '/marketing/activity', icon: Activity },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            { label: 'Control Tower', href: '/marketing/control-tower', icon: Radar },
            { label: 'Monitoring', href: '/marketing/monitoring', icon: MapPin },
            { label: 'Live Map', href: '/marketing/live-map', icon: MapIcon },
            { label: 'Laporan Unit', href: '/marketing/unit-report', icon: RouteIcon, overflow: true },
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
            { label: 'Waiting Unit', href: '/operational/orders', icon: ClipboardList },
            { label: 'History', href: '/operational/history', icon: History },
            { label: 'Aktivitas', href: '/operational/activity', icon: Activity },
          ],
        },
        {
          title: 'Pemantauan',
          items: [
            { label: 'Control Tower', href: '/operational/control-tower', icon: Radar },
            { label: 'Peringatan', href: '/operational/alerts', icon: BellRing },
            { label: 'Monitoring', href: '/operational/monitoring', icon: MapPin },
            { label: 'Live Map', href: '/operational/live-map', icon: MapIcon },
          ],
        },
        {
          title: 'Laporan',
          items: [
            { label: 'Laporan Keselamatan', href: '/operational/safety-report', icon: ShieldCheck },
            { label: 'Laporan Unit', href: '/operational/unit-report', icon: RouteIcon, overflow: true },
          ],
        },
        {
          title: 'Pengaturan',
          items: [
            { label: 'Unit GPS', href: '/operational/gps-devices', icon: Link2, overflow: true },
            { label: 'Geofence', href: '/operational/geofences', icon: Target, overflow: true },
          ],
        },
      ]

    case 'hse':
      return [
        {
          title: 'Inspeksi',
          items: [
            { label: 'Waiting Inspection', href: '/hse', icon: ShieldCheck },
            { label: 'Inspection History', href: '/hse/history', icon: History },
            { label: 'Aktivitas', href: '/hse/activity', icon: Activity },
          ],
        },
        {
          title: 'Laporan',
          items: [
            { label: 'Laporan Keselamatan', href: '/hse/safety-report', icon: ShieldCheck },
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
