import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Info, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useQuestionnaire } from '@/app/store'
import {
  ATTRIBUTE_BY_KEY,
  PROFILES,
  UNIFIED_PREMISES,
} from '@/data/profiles'
import { profileIdForAttributes } from '@/data/dceTasks'
import {
  CUSTOM_CONFIG_CONFIRM_HINT,
  CUSTOM_CONFIG_INTRO,
  CUSTOM_CONFIG_NOTE,
  CUSTOM_CONFIG_TITLE,
  CUSTOM_CONFIG_TOGGLES,
  isCustomConfigComplete,
} from '@/data/questionnaire'
import type { AttributeLevel, CustomConfigRecord, ProfileId } from '@/types'

/**
 * 模块六｜理想配置自由设定（**V1.0 之外新增**）
 *
 * 让参与者用三个"系统设置开关"主动拼出自己最愿意长期使用的一套配置。
 * 与模块三 DCE 的区别：
 *   - DCE：在**给定的两两对比**中做被迫取舍 → 反映权衡
 *   - 本模块：**自己设定**三个开关 → 反映理想偏好
 * 两者对比可以看出"理想"与"实际取舍"之间的差距。
 *
 * 实现要点：
 *   - 三个开关**彼此独立**，共 8 种组合，与 C1–C8 一一对应。
 *   - 开关状态由 `role="switch"` + `aria-checked` 表达，键盘可用，
 *     且**不依赖颜色单独传达状态**（同时显示"开/关"文字与图标）。
 *   - 每调整一次记录一次作答耗时（用于数据质量分析）。
 *   - 记录内容：三个水平 + 匹配到的配置编码 + 耗时。
 */

type Levels = { X1: AttributeLevel; X2: AttributeLevel; X3: AttributeLevel }

const DEFAULT_LEVELS: Levels = { X1: 0, X2: 0, X3: 0 }

/** 单个开关。 */
function ToggleSwitch({
  title,
  researchTitle,
  offLabel,
  onLabel,
  offHint,
  onHint,
  checked,
  onChange,
}: {
  title: string
  researchTitle: string
  offLabel: string
  onLabel: string
  offHint: string
  onHint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="rounded-surface border border-sage-200 bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.05rem] font-semibold text-forest-800">{title}</h3>
        <span className="font-mono text-[0.75rem] text-sage-600">{researchTitle}</span>
      </div>

      {/* 开关本体：整块可点，触控目标远大于 44px */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title}：当前为${checked ? onLabel : offLabel}，点击切换`}
        onClick={() => onChange(!checked)}
        className="mt-3 flex w-full items-center justify-between gap-4 rounded-panel border border-sage-200 bg-sage-50 px-4 py-3 text-left transition-colors hover:bg-sage-100"
      >
        <span className="min-w-0">
          <span className="block text-[0.8rem] font-medium text-sage-700">
            {checked ? '当前：开' : '当前：关'}
          </span>
          <span className="mt-0.5 block text-[1rem] font-semibold text-forest-900">
            {checked ? onLabel : offLabel}
          </span>
        </span>

        {/* 视觉开关：颜色 + 圆点位置共同表达状态 */}
        <span
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
            checked ? 'bg-forest-700' : 'bg-sage-300'
          }`}
          aria-hidden="true"
        >
          <span
            className={`absolute h-6 w-6 rounded-full bg-white shadow transition-all ${
              checked ? 'left-7' : 'left-1'
            }`}
          />
        </span>
      </button>

      <p className="mt-2.5 text-[0.85rem] leading-relaxed text-sage-700">
        {checked ? onHint : offHint}
      </p>
    </div>
  )
}

export default function IdealConfigStep({ onContinue }: { onContinue: () => void }) {
  const draft = useQuestionnaire((s) => s.draft)
  const setCustomConfig = useQuestionnaire((s) => s.setCustomConfig)

  // 已保存过则沿用，否则从全 0（= C1）开始
  const [levels, setLevels] = useState<Levels>(() => {
    const saved = draft.customConfig
    return saved ? { X1: saved.X1, X2: saved.X2, X3: saved.X3 } : DEFAULT_LEVELS
  })

  // 进入本步骤时开始计时；离开/提交时结算
  const startedAtRef = useRef<number>(Date.now())

  const complete = isCustomConfigComplete(levels)
  const matchedProfileId: ProfileId | null = profileIdForAttributes(levels.X1, levels.X2, levels.X3)

  /** 每次切换都把当前状态写入草稿（保证刷新/返回不丢）。 */
  const commit = useCallback(
    (next: Levels) => {
      setLevels(next)
      const record: CustomConfigRecord = {
        X1: next.X1,
        X2: next.X2,
        X3: next.X3,
        matchedProfileId: profileIdForAttributes(next.X1, next.X2, next.X3),
        responseDurationMs: Math.min(
          Math.max(0, Date.now() - startedAtRef.current),
          24 * 60 * 60 * 1000,
        ),
      }
      setCustomConfig(record)
    },
    [setCustomConfig],
  )

  // 进入时先落一次草稿，确保即使参与者不改动开关也有记录
  useEffect(() => {
    if (!draft.customConfig) commit(levels)
    // 仅在首次挂载时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggle(key: keyof Levels, next: boolean) {
    commit({ ...levels, [key]: (next ? 1 : 0) as AttributeLevel })
  }

  function handleContinue() {
    // 结算最终耗时后再进入下一步
    commit(levels)
    onContinue()
  }

  const matchedProfile = matchedProfileId ? PROFILES[matchedProfileId] : null

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-[1.2rem] font-semibold text-forest-800">{CUSTOM_CONFIG_TITLE}</h2>
        <p className="mt-3 text-[1rem] leading-9 text-sage-700">{CUSTOM_CONFIG_INTRO}</p>
        <p className="mt-3 text-[0.92rem] leading-relaxed text-sage-700">{CUSTOM_CONFIG_NOTE}</p>

        <div className="mt-4 flex items-start gap-3 rounded-panel border border-forest-100 bg-forest-50 px-4 py-3.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-[0.92rem] leading-8 text-forest-800">
            {UNIFIED_PREMISES.sharedCapability}
          </p>
        </div>
      </Card>

      {/* ── 三个开关 ─────────────────────────────────────── */}
      <div className="space-y-3.5">
        {CUSTOM_CONFIG_TOGGLES.map((toggle) => (
          <ToggleSwitch
            key={toggle.key}
            title={toggle.title}
            researchTitle={toggle.researchTitle}
            offLabel={toggle.offLabel}
            onLabel={toggle.onLabel}
            offHint={toggle.offHint}
            onHint={toggle.onHint}
            checked={levels[toggle.key] === 1}
            onChange={(next) => handleToggle(toggle.key, next)}
          />
        ))}
      </div>

      {/* ── 当前组合预览 ─────────────────────────────────── */}
      <Card tone={complete ? 'sage' : 'champagne'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[1.05rem] font-semibold text-forest-800">
            {complete && <CheckCircle2 className="h-5 w-5 text-forest-700" aria-hidden="true" />}
            您设定的配置
          </h3>
          {matchedProfileId && (
            <span className="rounded-panel bg-white px-3 py-1.5 font-mono text-[0.85rem] font-semibold text-forest-800">
              {matchedProfileId}
            </span>
          )}
        </div>

        <dl className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
          {(['X1', 'X2', 'X3'] as const).map((key) => (
            <div key={key} className="rounded-panel bg-white/70 px-3.5 py-3">
              <dt className="text-[0.78rem] font-medium text-sage-700">
                {ATTRIBUTE_BY_KEY[key].title}
              </dt>
              <dd className="mt-1 text-[0.92rem] font-semibold leading-relaxed text-forest-900">
                {ATTRIBUTE_BY_KEY[key].levels[levels[key]].label}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[0.85rem] leading-relaxed text-sage-700">
          {complete
            ? CUSTOM_CONFIG_CONFIRM_HINT
            : '请确认三个开关的状态。'}
          {matchedProfile && (
            <>
              {' '}
              这个组合对应研究中的配置 <strong className="font-semibold">{matchedProfileId}</strong>。
            </>
          )}
        </p>
      </Card>

      <div className="flex items-start gap-2.5 px-1">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" aria-hidden="true" />
        <p className="text-[0.85rem] leading-relaxed text-sage-600">
          无论您怎么设置这三个开关，系统的基础异常识别与报警能力都不变。
          三个开关共有 8 种组合，都可以选择。
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.92rem] leading-relaxed text-sage-700">
            已设定：{levels.X1 === 1 ? '详细数据' : '仅摘要'} ·{' '}
            {levels.X2 === 1 ? '多方共享' : '仅指定子女'} ·{' '}
            {levels.X3 === 1 ? '全天持续详细监测' : '异常时详细监测'}
          </p>
          <Button size="lg" onClick={handleContinue} disabled={!complete} className="shrink-0">
            确认并继续
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
