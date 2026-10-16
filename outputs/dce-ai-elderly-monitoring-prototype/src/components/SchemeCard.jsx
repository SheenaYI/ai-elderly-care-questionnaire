import { Eye, MonitorCog, Play, UsersRound } from 'lucide-react'
import AttributeRow from './AttributeRow'
import { ATTRIBUTE_DEFINITIONS } from '../data/schemes'

const attributeIcons = {
  sharingLevel: Eye,
  recipients: UsersRound,
  monitoringMode: MonitorCog,
}

function SchemeCard({ scheme, isSelected, onSelect, onOpenSimulation }) {
  function handleCardKeyDown(event) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  function handleCardClick(event) {
    if (event.target.closest('button, input, label')) return
    onSelect()
  }

  return (
    <article
      className={`group relative flex min-h-full cursor-pointer flex-col rounded-2xl border bg-white p-5 shadow-card transition duration-200 sm:p-6 ${
        isSelected
          ? 'border-forest-700 ring-2 ring-forest-100 shadow-selected'
          : 'border-sage-200 hover:-translate-y-0.5 hover:border-sage-500 hover:shadow-selected'
      }`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${scheme.label}：${isSelected ? '已选择' : '未选择'}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-sage-100 pb-5">
        <div>
          <p className="text-sm font-medium text-sage-500">系统配置</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-forest-800">{scheme.label}</h2>
        </div>

        <label
          className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors ${
            isSelected ? 'bg-forest-50 text-forest-800' : 'text-sage-700 hover:bg-sage-50'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="radio"
            className="sr-only"
            name="preferred-scheme"
            checked={isSelected}
            onChange={onSelect}
          />
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
              isSelected ? 'border-forest-700' : 'border-sage-400'
            }`}
            aria-hidden="true"
          >
            {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />}
          </span>
          <span>{isSelected ? '已选择' : '选择方案'}</span>
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {ATTRIBUTE_DEFINITIONS.map((definition) => (
          <AttributeRow
            key={definition.key}
            definition={definition}
            valueKey={scheme[definition.key]}
            Icon={attributeIcons[definition.key]}
          />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenSimulation()
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-forest-700 bg-white px-4 py-3 text-base font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          <Play className="h-4.5 w-4.5" aria-hidden="true" />
          查看模拟情景
        </button>
      </div>
    </article>
  )
}

export default SchemeCard
