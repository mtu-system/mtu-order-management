'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

type ToastItem = {
  id: number
  type: ToastType
  title: string
  message?: string
}

type ToastContextValue = {
  showToast: (type: ToastType, title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

type ToastStyle = {
  icon: any
  iconBg: string
  iconColor: string
  border: string
}

const toastStyles: Record<ToastType, ToastStyle> = {
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-200',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    border: 'border-red-200',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    border: 'border-amber-200',
  },
}

let toastIdCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = ++toastIdCounter

      setToasts((current) => [...current, { id, type, title, message }])

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id))
      }, 4500)
    },
    []
  )

  function dismiss(id: number) {
    setToasts((current) => current.filter((item) => item.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const style = toastStyles[toast.type]
          const Icon = style.icon

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-lg ${style.border} animate-[toast-in_0.2s_ease-out]`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}
              >
                <Icon className={`h-5 w-5 ${style.iconColor}`} />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-bold text-gray-900">
                  {toast.title}
                </p>
                {toast.message && (
                  <p className="mt-0.5 text-sm text-gray-600">
                    {toast.message}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-1 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast harus dipakai di dalam ToastProvider')
  }

  return {
    success: (title: string, message?: string) =>
      context.showToast('success', title, message),
    error: (title: string, message?: string) =>
      context.showToast('error', title, message),
    warning: (title: string, message?: string) =>
      context.showToast('warning', title, message),
  }
}