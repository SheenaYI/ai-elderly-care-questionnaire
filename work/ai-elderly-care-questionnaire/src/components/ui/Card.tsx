import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 通用内容面板。 */
export default function Card({
  children,
  className,
  as: Tag = 'section',
  tone = 'white',
  id,
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  tone?: 'white' | 'sage' | 'champagne' | 'forest'
  id?: string
}) {
  const tones = {
    white: 'bg-white border-sage-200',
    sage: 'bg-sage-50 border-sage-200',
    champagne: 'bg-champagne-50 border-champagne-200',
    forest: 'bg-forest-800 border-forest-700 text-white',
  }
  return (
    <Tag id={id} className={cn('rounded-surface border p-5 shadow-card sm:p-6', tones[tone], className)}>
      {children}
    </Tag>
  )
}
