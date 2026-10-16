import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Info, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import ProfileSummary from '@/features/dce/ProfileSummary'
import { useQuestionnaire, isRatingComplete } from '@/app/store'
import { PROFILES, UNIFIED_PREMISES } from '@/data/profiles'
import {
  CONSTRUCTS,
  LIKERT_OPTIONS,
  LIKERT_SCALE_PROMPT,
  SCALE_ITEMS,
  SCALE_ITEM_COUNT,
} from '@/data/scales'
import { PROFILES_PER_PARTICIPANT } from '@/data/dceTasks'
import type { LikertValue, ProfileId, ProfileRatingScores, ScaleItemId } from '@/types'

/**
 * 模块四｜随机配置感知评价
 *
 * 每位参与者从 C1–C8 中按预设**平衡规则**获得 4 个不同配置，
 * 评价任务顺序随机。分配机制见 src/lib/randomization（可复现、可审计）。
 *
 * 注意：
 *   - 不是只评价 DCE 中选中的配置。
 *   - 每个配置 12 道量表题，全部必答。
 *   - 隐私担忧（P1–P3）分数越高表示**担忧越强**，不做反向计分。
 *   - 所有配置的"授权与暂停设置"相同，此说明固定显示，
 *     避免 A3（自主感）被误解为配置间差异。
 */

const ALL_ITEM_IDS: readonly ScaleItemId[] = SCALE_ITEMS.map((i) => i.id)

function emptyScores(): Partial<ProfileRatingScores> {
  return {}
}

/** 单个量表题（5 点 Likert，大尺寸单选） */
function LikertItem({
  itemId,
  text,
  value,
  onChange,
}: {
  itemId: ScaleItemId
  text: string
  value: LikertValue | undefined
  onChange: (value: LikertValue) => void
}) {
  return (
    <fieldset className="rounded-panel border border-sage-200 bg-white px-4 py-4">
      <legend className="px-1 text-[0.78rem] font-mono text-sage-600">{itemId}</legend>
      <p className="text-[1rem] font-medium leading-8 text-forest-900">{text}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {LIKERT_OPTIONS.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={`flex min-h-13 cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border px-2 py-2.5 text-center transition-colors ${
                checked
                  ? 'border-forest-700 bg-forest-700 text-white'
                  : 'border-sage-200 bg-sage-50 text-sage-700 hover:border-sage-500 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name={`item-${itemId}`}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              <span className="font-mono text-[1rem] font-semibold tabular-nums" aria-hidden="true">
                {option.value}
              </span>
              <span className="text-[0.8rem] leading-tight">{option.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function RatingsStep({ onContinue }: { onContinue: () => void }) {
  const draft = useQuestionnaire((s) => s.draft)
  const ensureRatingPlan = useQuestionnaire((s) => s.ensureRatingPlan)
  const saveProfileRating = useQuestionnaire((s) => s.saveProfileRating)

  const [currentIndex, setCurrentIndex] = useState(0)
  const plan = draft.ratingPlan

  // 生成待评价配置（仅首次生效）
  useEffect(() => {
    ensureRatingPlan()
  }, [ensureRatingPlan])

  // 当前配置下已保存的答案；未保存时从草稿读取
  const currentProfileId: ProfileId | undefined = plan[currentIndex]
  const savedRating = useMemo(
    () => draft.profileRatings.find((r) => r.profileId === currentProfileId),
    [draft.profileRatings, currentProfileId],
  )

  const [scores, setScores] = useState<Partial<ProfileRatingScores>>(emptyScores)
  const [showErrors, setShowErrors] = useState(false)

  // 切换配置时载入该配置已保存的评分（保持"返回可修改"）
  useEffect(() => {
    if (!currentProfileId) return
    setShowErrors(false)
    setScores(savedRating ? { ...savedRating.scores } : emptyScores())
    // 仅在配置切换时重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentProfileId])

  const answeredCount = ALL_ITEM_IDS.filter((id) => typeof scores[id] === 'number').length
  const isCurrentComplete = answeredCount === SCALE_ITEM_COUNT

  const completedProfiles = useMemo(
    () => draft.profileRatings.filter((r) => isRatingComplete(r)).length,
    [draft.profileRatings],
  )
  const allComplete = completedProfiles >= PROFILES_PER_PARTICIPANT

  function handleSave(andNext: boolean) {
    if (!currentProfileId) return
    const profile = PROFILES[currentProfileId]

    if (!isCurrentComplete) {
      setShowErrors(true)
      return
    }

    saveProfileRating({
      profileId: currentProfileId,
      X1: profile.X1,
      X2: profile.X2,
      X3: profile.X3,
      ratingOrder: currentIndex + 1,
      scores: scores as ProfileRatingScores,
    })

    setShowErrors(false)
    if (andNext && currentIndex < plan.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  if (plan.length === 0 || !currentProfileId) {
    return (
      <Card>
        <p role="status" className="text-[1rem] text-sage-700">
          正在准备待评价的配置…
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 进度 ─────────────────────────────────────────── */}
      <Card tone="sage" className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.82rem] font-medium text-sage-700">配置感受评价</p>
            <p className="mt-0.5 text-[1.15rem] font-semibold text-forest-800">
              第 {currentIndex + 1} 个配置 / 共 {plan.length} 个
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">配置 {currentProfileId}</Badge>
            <Badge tone={allComplete ? 'success' : 'champagne'}>
              {allComplete && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {`已完成 ${completedProfiles} / ${PROFILES_PER_PARTICIPANT} 个配置`}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="配置导航">
          {plan.map((profileId, index) => {
            const record = draft.profileRatings.find((r) => r.profileId === profileId)
            const done = isRatingComplete(record)
            const isCurrent = index === currentIndex
            return (
              <button
                key={profileId}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`配置 ${profileId}${done ? '，已完成' : '，未完成'}${isCurrent ? '，当前配置' : ''}`}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-panel border px-3 text-[0.85rem] font-semibold transition-colors ${
                  isCurrent
                    ? 'border-forest-700 bg-forest-700 text-white'
                    : done
                      ? 'border-forest-200 bg-forest-50 text-forest-800 hover:border-forest-500'
                      : 'border-sage-300 bg-white text-sage-700 hover:border-sage-500'
                }`}
              >
                {profileId}
                {done && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── 当前配置属性 ─────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-panel bg-forest-50 p-2 text-forest-700" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[1.15rem] font-semibold text-forest-800">
              当前评价配置：{currentProfileId}
            </h2>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-sage-700">
              请针对下面这一个完整配置，回答随后的 {SCALE_ITEM_COUNT} 道题。
              请按"长期使用这一配置"的感受作答。
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProfileSummary profileId={currentProfileId} />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-panel border border-sage-200 bg-sage-50 px-4 py-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-[0.9rem] leading-8 text-sage-700">
            <strong className="font-semibold text-forest-800">
              {UNIFIED_PREMISES.autonomyControlNotice}
            </strong>
            也就是说，无论您看到哪一个配置，授权与暂停设置都是相同的。
          </p>
        </div>
      </Card>

      {/* ── 12 道量表题 ──────────────────────────────────── */}
      {CONSTRUCTS.map((construct) => (
        <section key={construct.key} aria-labelledby={`construct-${construct.key}`}>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`construct-${construct.key}`} className="text-[1.2rem] font-semibold text-forest-800">
              {construct.title}
            </h2>
            <p className="text-[0.82rem] text-sage-600">{construct.direction}</p>
          </div>

          {construct.key === 'privacy' && (
            <div className="mb-3.5 flex items-start gap-3 rounded-panel border border-champagne-200 bg-champagne-50 px-4 py-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
              <p className="text-[0.88rem] leading-relaxed text-champagne-800">
                本组题询问的是"担忧"程度：分数越高表示担忧越强。
                <strong className="font-semibold">这不是隐私满意度题。</strong>
              </p>
            </div>
          )}

          <div className="space-y-3">
            {construct.items.map((itemId) => {
              const item = SCALE_ITEMS.find((i) => i.id === itemId)
              if (!item) return null
              return (
                <LikertItem
                  key={itemId}
                  itemId={itemId}
                  text={item.text}
                  value={scores[itemId]}
                  onChange={(value) => setScores((prev) => ({ ...prev, [itemId]: value }))}
                />
              )
            })}
          </div>
        </section>
      ))}

      {/* ── 保存与导航 ───────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.92rem] text-sage-700">
            <span className="font-mono font-semibold text-forest-800">
              {answeredCount} / {SCALE_ITEM_COUNT}
            </span>{' '}
            道题已作答
          </p>
          <p className="text-[0.88rem] text-sage-600">{LIKERT_SCALE_PROMPT}</p>
        </div>

        {showErrors && !isCurrentComplete && (
          <p className="mt-3.5 flex items-center gap-2 text-[0.9rem] text-champagne-800" role="alert">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            请完成本配置的全部 {SCALE_ITEM_COUNT} 道题后再继续。
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="secondary"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            上一个配置
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => handleSave(false)}>
              保存本配置评价
            </Button>
            <Button size="lg" onClick={() => handleSave(true)}>
              {currentIndex === plan.length - 1 ? '保存本配置' : '保存并进入下一个配置'}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      {allComplete && (
        <Card tone="sage">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-[0.95rem] leading-8 text-sage-700">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
              {PROFILES_PER_PARTICIPANT} 个配置的评价都已完整填写。您可以继续，也可以返回修改。
            </p>
            <Button size="lg" onClick={onContinue} className="shrink-0">
              继续：总体评价
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
