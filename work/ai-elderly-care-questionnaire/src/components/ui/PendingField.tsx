import { PenLine } from 'lucide-react'
import type { ConfigurableField } from '@/data/placeholders'
import { cn } from '@/lib/cn'

/**
 * 待研究团队填写的字段。
 *
 * ⚠️ 这些内容在 V1.0 中尚未确定，本系统一律**不编造**。
 *    未填写时以醒目的占位样式呈现；填写后正常显示内容。
 *    该组件同时用于知情同意页与隐私说明页，保证口径一致。
 */
export default function PendingField({
  field,
  className,
  inline = false,
}: {
  field: ConfigurableField
  className?: string
  inline?: boolean
}) {
  if (!field.pending && field.value) {
    return (
      <span className={cn('font-medium text-forest-900', className)}>{field.value}</span>
    )
  }

  return (
    <span
      className={cn(
        inline
          ? 'inline-flex items-center gap-1 rounded bg-champagne-100 px-1.5 py-0.5 font-mono text-[0.85em] text-champagne-800'
          : 'flex items-start gap-2 rounded-panel border border-dashed border-champagne-300 bg-champagne-50 px-3 py-2 text-champagne-800',
        className,
      )}
      title={field.guidance}
    >
      <PenLine className={cn('shrink-0', inline ? 'h-3.5 w-3.5' : 'mt-0.5 h-4 w-4')} aria-hidden="true" />
      <span className={cn(inline ? '' : 'font-mono text-[0.88rem]')}>{field.placeholder}</span>
      {!inline && (
        <span className="sr-only">此信息尚未确定，待研究团队填写，未作编造。</span>
      )}
    </span>
  )
}

/** 一组待填写字段的列表展示。 */
export function PendingFieldList({ fields }: { fields: readonly ConfigurableField[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="rounded-panel border border-sage-200 bg-white px-3.5 py-3">
          <dt className="text-[0.85rem] font-medium text-sage-700">{field.label}</dt>
          <dd className="mt-1.5">
            <PendingField field={field} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
