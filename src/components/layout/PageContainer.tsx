import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 内容区容器：控制阅读宽度与页面节奏。 */
export default function PageContainer({
  children,
  size = 'default',
  className,
}: {
  children: ReactNode
  size?: 'default' | 'narrow' | 'wide'
  className?: string
}) {
  const maxWidth = {
    narrow: 'max-w-2xl',
    default: 'max-w-4xl',
    wide: 'max-w-5xl',
  }[size]

  return (
    <div className={cn('mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14', maxWidth, className)}>
      {children}
    </div>
  )
}
