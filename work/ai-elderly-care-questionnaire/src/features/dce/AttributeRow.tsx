import { Eye, MonitorCog, Users } from 'lucide-react'
import type { AttributeKey, AttributeLevel } from '@/types'
import { ATTRIBUTE_BY_KEY } from '@/data/profiles'

const icons: Record<AttributeKey, typeof Eye> = {
  X1: Eye,
  X2: Users,
  X3: MonitorCog,
}

/**
 * 方案卡片中的单个属性区块。
 *
 * 视觉规则（对应设计规范"The Difference-Only Rule"）：
 *   - 两方案之间**确有差异**的属性 → 浅金色背景 + "不同"标记
 *   - 完全相同的属性 → 白/浅灰背景，并标注"两方案相同"
 *
 * ⚠️ 浅金色只用于标记实验属性的差异，不暗示任何方案更优、
 *    更安全或更先进。
 */
export default function AttributeRow({
  attributeKey,
  level,
  isDifferent,
  comparisonLabel,
}: {
  attributeKey: AttributeKey
  level: AttributeLevel
  /** 该属性在两方案之间是否不同。 */
  isDifferent: boolean
  /** 用于"相同"提示的对照方案名，例如"方案 B"。 */
  comparisonLabel?: string
}) {
  const definition = ATTRIBUTE_BY_KEY[attributeKey]
  const value = definition.levels[level]
  const Icon = icons[attributeKey]

  return (
    <section
      className={`relative rounded-panel px-3.5 py-3.5 ${
        isDifferent ? 'bg-champagne-50 ring-1 ring-inset ring-champagne-200' : 'bg-sage-50'
      }`}
      aria-label={`${definition.title}：${value.label}${
        isDifferent ? '，此项与另一方案不同' : '，此项与另一方案相同'
      }`}
    >
      {isDifferent && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-champagne-100 px-2 py-0.5 text-[0.7rem] font-semibold text-champagne-800">
          不同
        </span>
      )}

      <div className="flex items-center gap-2 pr-14">
        <Icon className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
        <h4 className="text-[0.85rem] font-medium text-sage-700">{definition.title}</h4>
      </div>

      <p className="mt-1.5 text-[1rem] font-semibold leading-relaxed text-forest-900">
        {value.label}
      </p>
      <p className="mt-1 text-[0.85rem] leading-relaxed text-sage-700">{value.description}</p>

      {!isDifferent && comparisonLabel && (
        <p className="mt-1.5 text-[0.78rem] text-sage-600">与{comparisonLabel}相同</p>
      )}
    </section>
  )
}
