import { isDifferentAttribute, ATTRIBUTE_VALUES } from '../data/schemes'

function AttributeRow({ definition, valueKey, Icon }) {
  const value = ATTRIBUTE_VALUES[definition.key][valueKey]
  const isDifferent = isDifferentAttribute(definition.key)

  return (
    <section
      className={`relative rounded-xl px-4 py-4 ${
        isDifferent ? 'bg-amber-50' : 'bg-sage-50'
      }`}
      aria-label={`${definition.title}：${value.label}${isDifferent ? '，此项与另一方案不同' : ''}`}
    >
      {isDifferent && (
        <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          不同
        </span>
      )}
      <div className="flex items-center gap-2 pr-12 text-sm font-medium text-sage-700">
        <Icon className="h-4.5 w-4.5 text-forest-700" aria-hidden="true" />
        <h3>{definition.title}</h3>
      </div>
      <p className="mt-2 text-base font-semibold leading-6 text-slate-800">{value.label}</p>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{value.description}</p>
    </section>
  )
}

export default AttributeRow
