import Link from 'next/link'
import LogoutButton from './logout-button'
import type { UserRole } from '@/lib/auth'

type DashboardShellProps = {
  children: React.ReactNode
  user: {
    full_name: string | null
    email: string
    role: UserRole
  }
}

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const menus = getMenus(user.role)

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r bg-white">
        {/* LOGO / TITLE */}
        <div className="border-b px-6 py-5">
          <h1 className="text-lg font-bold text-gray-900">
            MTU Order Management
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            Internal System
          </p>
        </div>

        {/* MENU */}
        <nav className="flex-1 space-y-1 p-4">
          {menus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-black"
            >
              {menu.label}
            </Link>
          ))}
        </nav>

        {/* USER */}
        <div className="border-t p-4">
          <div className="mb-3 px-4">
            <p className="text-sm font-semibold text-gray-900">
              {user.full_name || 'User'}
            </p>

            <p className="mt-1 truncate text-xs text-gray-500">
              {user.email}
            </p>

            <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-600">
              {user.role}
            </span>
          </div>

          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="ml-64 flex min-h-screen flex-1 flex-col">
        {/* HEADER */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
          <div>
            <p className="text-sm text-gray-500">
              Internal Order Management System
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {user.full_name || 'User'}
            </p>

            <p className="text-xs capitalize text-gray-500">
              {user.role}
            </p>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function getMenus(role: UserRole) {
  switch (role) {
    case 'manager':
      return [
        {
          label: 'Dashboard',
          href: '/manager',
        },
        {
          label: 'Orders',
          href: '/manager/orders',
        },
        {
          label: 'Monitoring',
          href: '/manager/monitoring',
        },
        {
          label: 'Reports',
          href: '/manager/reports',
        },
        {
          label: 'Users',
          href: '/manager/users',
        },
        {
          label: 'Activity Logs',
          href: '/manager/activity-logs',
        },
      ]

    case 'marketing':
      return [
        {
          label: 'Dashboard',
          href: '/marketing',
        },
        {
          label: 'Orders',
          href: '/marketing/orders',
        },
        {
          label: 'Create Order',
          href: '/marketing/orders/create',
        },
        {
          label: 'Order History',
          href: '/marketing/orders/history',
        },
      ]

    case 'operational':
      return [
        {
          label: 'Dashboard',
          href: '/operational',
        },
        {
          label: 'Orders',
          href: '/operational/orders',
        },
        {
          label: 'Waiting Unit',
          href: '/operational/orders/waiting-unit',
        },
      ]

    case 'hse':
      return [
        {
          label: 'Dashboard',
          href: '/hse',
        },
        {
          label: 'Waiting Inspection',
          href: '/hse/inspections',
        },
        {
          label: 'Inspection History',
          href: '/hse/inspections/history',
        },
      ]

    default:
      return []
  }
}