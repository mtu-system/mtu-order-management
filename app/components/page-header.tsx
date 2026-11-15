type PageHeaderProps = {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#082868]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-slate-600">
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  )
}