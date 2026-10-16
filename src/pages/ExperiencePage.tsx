import { useMemo, useState } from 'react'
import { ArrowRight, Info, MonitorPlay, RotateCcw, ShieldCheck } from 'lucide-react'
import PageContainer from '@/components/layout/PageContainer'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import ProfileSummary from '@/features/dce/ProfileSummary'
import SimulationModal from '@/features/simulation/SimulationModal'
import { PROFILES, PROFILE_IDS, UNIFIED_PREMISES, getAttributeLevel } from '@/data/profiles'
import type { ProfileId } from '@/types'
import { useQuestionnaire } from '@/app/store'
import { markPriorExperience } from '@/lib/storage'

/**
 * 页面二：情景体验
 *
 * 独立于正式问卷的体验页面，帮助参与者理解不同系统配置的实际含义。
 *
 * 关键约束：
 *   - 与正式问卷**明确区分**：本页的选择不会写入 DCE 选择数据。
 *   - 复用 DCE 问卷中的同一个模拟组件（不重复实现逻辑）。
 *   - 记录"参与者是否在正式问卷前体验过"，供 Pilot 检查与后续分析。
 */

const SAMPLE_TOKENS = [
  { label: '当前查看配置', key: 'profile' },
] as const

export default function ExperiencePage() {
  const [selected, setSelected] = useState<ProfileId>('C1')
  const [simulationOpen, setSimulationOpen] = useState(false)

  const recordSimulationEvent = useQuestionnaire((s) => s.recordSimulationEvent)

  const profile = PROFILES[selected]

  const attributeReadout = useMemo(
    () =>
      (['X1', 'X2', 'X3'] as const).map((key) => ({
        key,
        level: profile[key],
        label: getAttributeLevel(key, profile[key]).label,
      })),
    [profile],
  )

  function handleStartSimulation() {
    // 记录预先体验标记（仅标记发生过，不写入 DCE 选择数据）
    markPriorExperience()
    setSimulationOpen(true)
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="02 情景体验 · 研究情景模拟"
        title="看见技术如何守护日常"
        subtitle="通过模拟情景，了解不同 AI 养老监测配置的运行方式。"
      >
        <Card tone="champagne" className="mt-1">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
            <div>
              <p className="text-[0.98rem] font-semibold text-champagne-800">
                这是独立的体验页面，不是正式问卷
              </p>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-champagne-800">
                您可以在这里自由切换配置、反复模拟。本页的所有选择
                <strong className="font-semibold">不会</strong>
                写入正式问卷的 DCE 选择数据，也不会影响您的问卷结果。
                若您在填写正式问卷前使用过本页，我们会记录这一情况供研究分析使用。
              </p>
            </div>
          </div>
        </Card>
      </PageHeader>

      {/* ── 配置选择 ───────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="exp-pick-title">
        <h2 id="exp-pick-title" className="text-[1.25rem] font-semibold text-forest-800">
          选择一种系统配置
        </h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-sage-700">
          八种配置来自三个属性的组合。所有配置的基础异常识别与报警能力都相同。
        </p>

        <div
          className="mt-5 grid gap-2.5 sm:grid-cols-4 lg:grid-cols-8"
          role="radiogroup"
          aria-label="选择要体验的系统配置"
        >
          {PROFILE_IDS.map((id) => {
            const isSelected = id === selected
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-panel border px-3 transition-colors ${
                  isSelected
                    ? 'border-forest-700 bg-forest-700 text-white shadow-selected'
                    : 'border-sage-200 bg-white text-forest-800 hover:border-sage-500 hover:bg-forest-50'
                }`}
              >
                <span className="text-[1.05rem] font-semibold">{id}</span>
                <span
                  className={`font-mono text-[0.68rem] tabular-nums ${
                    isSelected ? 'text-white/75' : 'text-sage-600'
                  }`}
                >
                  {PROFILES[id].X1}
                  {PROFILES[id].X2}
                  {PROFILES[id].X3}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── 当前配置详情 ───────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="exp-detail-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="exp-detail-title" className="text-[1.25rem] font-semibold text-forest-800">
            配置 {selected} 的三个属性
          </h2>
          <Badge tone="neutral">
            {SAMPLE_TOKENS[0].label}：{selected}
          </Badge>
        </div>

        <div className="mt-4">
          <ProfileSummary profileId={selected} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {attributeReadout.map((item) => (
            <div key={item.key} className="rounded-panel bg-white p-4 shadow-card">
              <p className="font-mono text-[0.75rem] uppercase tracking-wider text-sage-600">
                {item.key}
              </p>
              <p className="mt-1 text-[0.95rem] font-semibold text-forest-900">{item.label}</p>
            </div>
          ))}
        </div>

        <Card tone="sage" className="mt-5">
          <h3 className="text-[0.98rem] font-semibold text-forest-800">统一前提</h3>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-sage-700">
            {UNIFIED_PREMISES.sharedCapability}
          </p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-sage-700">
            {UNIFIED_PREMISES.items[2]}
          </p>
        </Card>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleStartSimulation}
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-panel bg-forest-700 px-6 text-[1rem] font-semibold text-white shadow-card transition hover:bg-forest-600"
          >
            <MonitorPlay className="h-5 w-5" aria-hidden="true" />
            开始模拟
          </button>

          <button
            type="button"
            onClick={() => setSelected('C1')}
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-panel border border-forest-700 px-6 text-[1rem] font-semibold text-forest-800 transition hover:bg-forest-50"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            重置为 C1
          </button>
        </div>
      </section>

      {/* ── 引导进入正式问卷 ───────────────────────────────── */}
      <Card tone="forest" className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-[1.15rem] font-semibold">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              准备好正式参与研究了吗？
            </h2>
            <p className="mt-1.5 text-[0.95rem] leading-relaxed text-forest-50/95">
              正式问卷包含知情同意、情景说明、6 道配置选择题、4 个配置的感受评价与总体评价。
            </p>
          </div>
          <ButtonLink
            to="/questionnaire/consent"
            variant="secondary"
            className="shrink-0 border-white bg-white text-forest-800 hover:bg-forest-50"
          >
            开始参与研究
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Card>

      {simulationOpen && (
        <SimulationModal
          profileId={selected}
          taskId={null}
          source="experience"
          onClose={() => setSimulationOpen(false)}
          onEvent={recordSimulationEvent}
        />
      )}
    </PageContainer>
  )
}
