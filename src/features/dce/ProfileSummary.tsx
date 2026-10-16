import type { ProfileId } from '@/types'
import { PROFILES, getAttributeLevel } from '@/data/profiles'

/**
 * 配置属性摘要（用于模块四评价页与后台）。
 * 三个属性水平逐条列出，供参与者确认"我正在评价哪一个配置"。
 */
export default function ProfileSummary({
  profileId,
  compact = false,
}: {
  profileId: ProfileId
  compact?: boolean
}) {
  const profile = PROFILES[profileId]

  return (
    <dl className={compact ? 'grid gap-2' : 'grid gap-2.5 sm:grid-cols-3'}>
      {(['X1', 'X2', 'X3'] as const).map((key) => (
        <div key={key} className="rounded-panel bg-sage-50 px-3.5 py-3">
          <dt className="text-[0.78rem] font-medium text-sage-700">
            {key === 'X1' ? '能看到什么' : key === 'X2' ? '谁能查看' : '平时如何监测'}
          </dt>
          <dd className="mt-1 text-[0.92rem] font-semibold leading-relaxed text-forest-900">
            {getAttributeLevel(key, profile[key]).label}
          </dd>
        </div>
      ))}
    </dl>
  )
}
