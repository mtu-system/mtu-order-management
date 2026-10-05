export default function Loading() {
  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      {/* SIDEBAR SKELETON -- ukuran sama persis kaya DashboardShell biar gak ada "lompatan" layout */}
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-gray-200 bg-white px-3 py-4">
        <div className="mb-3 flex items-center gap-2.5 border-b border-gray-200 px-2 pb-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2 pt-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-9 animate-pulse rounded-lg bg-gray-100"
              style={{ animationDelay: `${index * 80}ms` }}
            />
          ))}
        </nav>

        <div className="border-t border-gray-200 pt-3">
          <div className="h-9 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="flex h-[62px] items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="h-3.5 w-40 animate-pulse rounded bg-gray-100" />
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 animate-pulse rounded-full bg-gray-100" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-2 w-12 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-7 shadow-sm">
            <svg
              className="h-7 w-7 animate-spin text-[#2563EB]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-semibold text-gray-500">Memuat...</p>
          </div>
        </main>
      </div>
    </div>
  )
}