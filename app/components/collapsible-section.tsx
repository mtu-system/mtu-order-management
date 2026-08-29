'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type CollapsibleSectionProps = {
  id?: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (id && window.location.hash === `#${id}`) {
      setOpen(true)
    }
  }, [id])

  return (
    <div
      id={id}
      className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-gray-50/60"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-gray-900">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        <ChevronDown
          className={`h-4.5 w-4.5 shrink-0 text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 py-5">{children}</div>
      )}
    </div>
  )
}