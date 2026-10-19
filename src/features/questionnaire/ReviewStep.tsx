import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  Send,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { useQuestionnaire, isRatingComplete } from '@/app/store'
import { checkCompletion } from '@/lib/validation/schemas'
import { submitSurvey, type SubmitOutcome } from '@/lib/submission'
import { dataModeNotice } from '@/lib/config'
import { TASKS_PER_BLOCK, PROFILES_PER_PARTICIPANT } from '@/data/dceTasks'
import { SCALE_ITEM_COUNT } from '@/data/scales'
import { Q9_CONCERNS, Q8_LIKERT_OPTIONS } from '@/data/questionnaire'
import { ATTRIBUTE_BY_KEY } from '@/data/profiles'

/**
 * 提交前检查页。
 *
 * 职责：
 *   1. 明确列出每一部分的完成情况（未完成项必须可见）。
 *   2. 只有全部必答题完成才允许提交。
 *   3. 提交失败时**保留本地填写状态**并提示重试；绝不误报成功。
 */

function CheckRow({
  label,
  detail,
  done,
}: {
  label: string
  detail: string
  done: boolean
}) {
  return (
    <li className="flex items-start gap-3 border-b border-sage-100 py-3.5 last:border-0">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-champagne-700" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-[1rem] font-semibold text-forest-800">
          {label}
          <span className="ml-2 text-[0.85rem] font-medium">
            {done ? (
              <span className="text-forest-700">已完成</span>
            ) : (
              <span className="text-champagne-800">未完成</span>
            )}
          </span>
        </p>
        <p className="mt-0.5 text-[0.88rem] leading-relaxed text-sage-700">{detail}</p>
      </div>
    </li>
  )
}

export default function ReviewStep({
  onBack,
  onSubmitted,
}: {
  onBack: () => void
  onSubmitted: (outcome: SubmitOutcome) => void
}) {
  const draft = useQuestionnaire((s) => s.draft)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<SubmitOutcome | null>(null)
  const [showIncomplete, setShowIncomplete] = useState(false)

  const modeNotice = dataModeNotice()
  const completion = checkCompletion(draft)

  const dceCount = draft.dceChoices.length
  const ratedCount = draft.profileRatings.filter((r) => isRatingComplete(r)).length

  async function handleSubmit() {
    setError(null)
    if (!completion.complete) {
      setShowIncomplete(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    try {
      const outcome = await submitSurvey(draft)
      if (outcome.ok) {
        onSubmitted(outcome)
      } else {
        // 提交失败：保留本地状态，提示重试
        setError(outcome)
      }
    } catch {
      setError({
        ok: false,
        mode: modeNotice.mode,
        message: '提交过程中发生未预期的错误。您的填写内容已保存在本机，请稍后重试。',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card as="section">
        <h2 className="text-[1.2rem] font-semibold text-forest-800">提交前检查</h2>
        <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
          请确认以下部分都已完成。如果有未完成项，您可以点击返回修改，或直接跳到对应步骤。
        </p>

        <ul className="mt-4">
          <CheckRow
            label="知情同意"
            detail="已阅读研究说明并选择同意参与本研究。"
            done={completion.consent}
          />
          <CheckRow
            label="身份信息"
            detail="Q2 年龄范围、Q3 答题身份、Q4 设备了解程度、Q5 照护经历均已作答。"
            done={completion.identity}
          />
          <CheckRow
            label="理解检查"
            detail="Q6、Q7 两道理解检查题均已完成（首次作答结果会被记录）。"
            done={completion.comprehension}
          />
          <CheckRow
            label={`DCE 配置选择（6 题）`}
            detail={`已完成 ${dceCount} / ${TASKS_PER_BLOCK} 道配置选择题。`}
            done={completion.dce}
          />
          <CheckRow
            label={`配置感受评价（${PROFILES_PER_PARTICIPANT} 个配置 × ${SCALE_ITEM_COUNT} 题）`}
            detail={`已完整评价 ${ratedCount} / ${PROFILES_PER_PARTICIPANT} 个配置。`}
            done={completion.ratings}
          />
          <CheckRow
            label="总体评价"
            detail="Q8 总体采纳意愿、Q9 最担心的问题均已作答（Q10 可跳过）。"
            done={completion.overall}
          />
          <CheckRow
            label="您的理想配置"
            detail="三个开关（共享层级 / 共享对象 / 详细监测方式）已设定为您最愿意长期使用的组合。"
            done={completion.customConfig}
          />
        </ul>

        {showIncomplete && !completion.complete && (
          <div
            className="mt-5 rounded-panel border border-champagne-300 bg-champagne-50 px-4 py-4"
            role="alert"
          >
            <p className="flex items-center gap-2 text-[1rem] font-semibold text-champagne-800">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              还有未完成的必答题，暂时无法提交
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {completion.missing.map((item) => (
                <li key={item.section} className="text-[0.92rem] leading-relaxed text-champagne-800">
                  · <strong className="font-semibold">{item.section}</strong>：{item.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-panel border border-alert-100 bg-alert-50 px-4 py-4" role="alert">
            <p className="flex items-center gap-2 text-[1rem] font-semibold text-alert-700">
              <CircleAlert className="h-5 w-5" aria-hidden="true" />
              提交失败，您的填写内容已保留
            </p>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-alert-700">{error.message}</p>
            {error.problems && error.problems.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {error.problems.slice(0, 8).map((problem) => (
                  <li key={`${problem.path}-${problem.message}`} className="text-[0.85rem] text-alert-700">
                    · {problem.path}：{problem.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[0.88rem] leading-relaxed text-alert-700">
              请点击下方"重新提交"重试。您的所有作答仍保存在本机，不会丢失。
            </p>
          </div>
        )}
      </Card>

      {/* ── 数据模式提示 ─────────────────────────────────── */}
      <Card tone={modeNotice.mode === 'demo' ? 'champagne' : 'sage'}>
        <p className="flex items-start gap-3 text-[0.95rem] leading-8 text-sage-700">
          <Info className="mt-1 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-forest-800">{modeNotice.title}</strong>
            <br />
            {modeNotice.detail}
          </span>
        </p>
      </Card>

      {/* ── 作答摘要（供参与者核对） ─────────────────────── */}
      <Card tone="sage">
        <h3 className="text-[1rem] font-semibold text-forest-800">您的作答摘要</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">分配卷别</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {draft.assignedBlock ?? '—'} 卷
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">DCE 选择题</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {dceCount} / {TASKS_PER_BLOCK} 题
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">被评价的配置</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {draft.ratingPlan.length > 0 ? draft.ratingPlan.join('、') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">Q8 总体采纳意愿</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {draft.overall.q8
                ? `${draft.overall.q8}（${
                    Q8_LIKERT_OPTIONS.find((o) => o.value === draft.overall.q8)?.label.replace(/^\d\s*/, '') ?? ''
                  }）`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">Q9 最担心的问题</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {draft.overall.q9
                ? Q9_CONCERNS.find((c) => c.value === draft.overall.q9)?.label ?? '—'
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">您的理想配置</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              {draft.customConfig ? (
                <>
                  {draft.customConfig.matchedProfileId ?? '—'}
                  <span className="ml-2 font-normal text-sage-700">
                    （{ATTRIBUTE_BY_KEY.X1.levels[draft.customConfig.X1].label}·
                    {ATTRIBUTE_BY_KEY.X2.levels[draft.customConfig.X2].label}·
                    {ATTRIBUTE_BY_KEY.X3.levels[draft.customConfig.X3].label}）
                  </span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[0.85rem] font-medium text-sage-700">情景模拟使用</dt>
            <dd className="mt-0.5 text-[0.95rem] font-semibold text-forest-900">
              打开过 {draft.simulationEvents.filter((e) => e.eventType === 'open').length} 次
              {draft.priorExperience && '（正式问卷前使用过体验页面）'}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="neutral">匿名编号：{draft.participantId.slice(0, 8)}…</Badge>
          <Badge tone="neutral">问卷版本 {draft.questionnaireVersion}</Badge>
        </div>
      </Card>

      {/* ── 操作 ─────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" onClick={onBack} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回修改
          </Button>

          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                正在提交…
              </>
            ) : (
              <>
                {error ? '重新提交' : '确认提交问卷'}
                <Send className="h-5 w-5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>

        <p className="mt-4 text-[0.85rem] leading-relaxed text-sage-600">
          提交后，您在本机保存的答题草稿将被清理。如果提交失败，草稿会保留以便重试。
        </p>
      </Card>
    </div>
  )
}
