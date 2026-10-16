import type { ReactNode } from 'react'

/**
 * 页面标题区（编辑式排版）。
 *
 * 使用统一的字号与间距节奏，标题与副标题之间保持充分留白，
 * 便于中老年参与者快速定位当前页面。
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="border-b border-sage-200 pb-8">
      {eyebrow && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-sage-600">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.3] text-forest-800 sm:text-[2.125rem]">
        {title}
      </h1>
      {subtitle && (
        <div className="mt-4 max-w-2xl text-[1.0625rem] leading-8 text-sage-700">{subtitle}</div>
      )}
      {children && <div className="mt-6">{children}</div>}
    </header>
  )
}
