import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'forest' | 'champagne' | 'alert' | 'info' | 'success'

const tones: Record<Tone, string> = {
  neutral: 'bg-sage-100 text-sage-800 border-sage-200',
  forest: 'bg-forest-700 text-white border-forest-700',
  champagne: 'bg-champagne-100 text-champagne-800 border-champagne-200',
  alert: 'bg-alert-50 text-alert-700 border-alert-100',
  info: 'bg-info-50 text-info-700 border-info-100',
  success: 'bg-forest-50 text-forest-700 border-forest-100',
}

/**
 * 状态标签。
 *
 * ⚠️ 可访问性：颜色永远不是唯一的信息载体。所有 Badge 都必须带文字，
 *    必要时配合图标（通过 children 传入）。
 */
export default function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.78rem] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
