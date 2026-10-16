import { Check, Play } from 'lucide-react'
import type { ProfileId } from '@/types'
import { PROFILES } from '@/data/profiles'
import AttributeRow from './AttributeRow'

/**
 * DCE 方案卡片。
 *
 * 卡片内容**完全由配置编码派生**，不硬编码任何属性文案：
 *   - 三个属性按 (X1, X2, X3) 取值渲染
 *   - 与另一方案不同的属性用浅金色突出
 *
 * 可访问性：
 *   - 整卡可点选，支持 Enter / Space
 *   - 选中状态由"圆点 + 文字 + 边框"三重表达
 *   - 模拟按钮为独立按钮，不触发选择
 */
export default function ProfileCard({
  profileId,
  label,
  otherProfileId,
  otherLabel,
  isSelected,
  onSelect,
  onOpenSimulation,
}: {
  profileId: ProfileId
  /** 展示名称，例如"方案 A"。 */
  label: string
  /** 用于比较差异的另一个配置。 */
  otherProfileId: ProfileId
  /** 对照方案的展示名称。 */
  otherLabel: string
  isSelected: boolean
  onSelect: () => void
  onOpenSimulation: () => void
}) {
  const profile = PROFILES[profileId]
  const other = PROFILES[otherProfileId]

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    // 点击内部按钮或其标签时不改变选择
    if ((event.target as HTMLElement).closest('button, input, label, a')) return
    onSelect()
  }

  return (
    <article
      className={`group relative flex min-h-full cursor-pointer flex-col rounded-surface border bg-white p-5 shadow-card transition duration-200 sm:p-6 ${
        isSelected
          ? 'border-forest-700 ring-2 ring-forest-100 shadow-selected'
          : 'border-sage-200 hover:-translate-y-0.5 hover:border-sage-500 hover:shadow-selected'
      }`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${label}：配置 ${profileId}${isSelected ? '，已选择' : '，未选择'}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-sage-100 pb-4">
        <div>
          <p className="text-[0.82rem] font-medium text-sage-700">系统配置</p>
          <h3 className="mt-0.5 text-[1.5rem] font-semibold tracking-tight text-forest-800">
            {label}
          </h3>
        </div>

        <label
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-panel px-2 text-[0.9rem] font-medium transition-colors ${
            isSelected ? 'bg-forest-50 text-forest-800' : 'text-sage-700 hover:bg-sage-50'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="radio"
            className="sr-only"
            name="dce-choice"
            checked={isSelected}
            onChange={onSelect}
          />
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
              isSelected ? 'border-forest-700 bg-forest-700' : 'border-sage-500'
            }`}
            aria-hidden="true"
          >
            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </span>
          <span>{isSelected ? '已选择' : '选择此方案'}</span>
        </label>
      </div>

      <div className="mt-4 space-y-2.5">
        {(['X1', 'X2', 'X3'] as const).map((key) => (
          <AttributeRow
            key={key}
            attributeKey={key}
            level={profile[key]}
            isDifferent={profile[key] !== other[key]}
            comparisonLabel={otherLabel}
          />
        ))}
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenSimulation()
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-panel border border-forest-700 bg-white px-4 text-[0.95rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          查看模拟情景
        </button>
        <p className="mt-2 text-center text-[0.75rem] text-sage-600">
          模拟为可选的辅助理解工具，不影响本题作答
        </p>
      </div>
    </article>
  )
}
