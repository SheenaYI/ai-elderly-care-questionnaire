import { PenLine } from 'lucide-react'
import type { ConfigurableField } from '@/data/placeholders'
import { cn } from '@/lib/cn'

/**
 * 待研究团队填写的字段。
 *
 * ⚠️ 研究内容策略（研究团队指定）：
 *   这些内容在 V1.0 中尚未确定，本系统一律**不编造**。
 *   当前策略为"**暂不在网页上显示具体占位字段**"——研究团队补齐之前，
 *   页面上只保留说明文字（例如"以下信息待研究团队补充确认"），
 *   不展示 `[待填写：…]` 名录，以免参与者看到大量空占位而降低阅读体验。
 *
 * 行为：
 *   - 字段**未填写**（pending）→ 默认渲染 `null`（不显示任何占位内容）；
 *     若确需显示占位（例如内部评审、上线前自查），传 `showWhenPending`。
 *   - 字段**已填写** → 正常显示内容（研究团队补齐后自动出现在页面上）。
 *
 * 研究内容本身仍集中定义在 `src/data/placeholders.ts`，页面组件不硬编码。
 */
export default function PendingField({
  field,
  className,
  inline = false,
  showWhenPending = false,
}: {
  field: ConfigurableField
  className?: string
  inline?: boolean
  /** 为 true 时在未填写的情况下也显示占位样式（仅用于内部自查）。 */
  showWhenPending?: boolean
}) {
  // 已填写：直接展示内容（补齐后无需改动任何页面）
  if (!field.pending && field.value) {
    return <span className={cn('font-medium text-forest-900', className)}>{field.value}</span>
  }

  // 未填写且不要求展示占位：不渲染任何内容
  if (!showWhenPending) return null

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
      <span className="sr-only">此信息尚未确定，待研究团队填写，未作编造。</span>
    </span>
  )
}

/**
 * 一组待填写字段的列表展示。
 *
 * 未填写的字段默认被过滤掉（见上）；全部已填写时正常显示完整信息表。
 */
export function PendingFieldList({
  fields,
  showWhenPending = false,
}: {
  fields: readonly ConfigurableField[]
  showWhenPending?: boolean
}) {
  const visible = fields.filter((f) => !f.pending || showWhenPending)
  if (visible.length === 0) return null

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {visible.map((field) => (
        <div key={field.key} className="rounded-panel border border-sage-200 bg-white px-3.5 py-3">
          <dt className="text-[0.85rem] font-medium text-sage-700">{field.label}</dt>
          <dd className="mt-1.5">
            <PendingField field={field} showWhenPending={showWhenPending} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
