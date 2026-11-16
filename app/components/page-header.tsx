type PageHeaderProps = {
  title: string
  subtitle?: React.ReactNode
  // Info kecil di samping judul (jumlah, badge status, dsb).
  meta?: React.ReactNode
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  meta,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-slate-900">
            {title}
          </h1>
          {meta}
        </div>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}
