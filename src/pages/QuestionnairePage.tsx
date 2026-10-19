import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import PageContainer from '@/components/layout/PageContainer'
import ProgressBar from '@/components/ui/ProgressBar'
import Card from '@/components/ui/Card'
import ConsentStep from '@/features/questionnaire/ConsentStep'
import ScenarioStep from '@/features/questionnaire/ScenarioStep'
import DceStep from '@/features/dce/DceStep'
import RatingsStep from '@/features/ratings/RatingsStep'
import OverallStep from '@/features/questionnaire/OverallStep'
import IdealConfigStep from '@/features/questionnaire/IdealConfigStep'
import ReviewStep from '@/features/questionnaire/ReviewStep'
import { DeclinedPage, DonePage } from '@/features/questionnaire/DoneStep'
import {
  STEP_META,
  TOTAL_PROGRESS_STEPS,
  isStepId,
  type StepId,
} from '@/features/questionnaire/steps'
import { useQuestionnaire } from '@/app/store'
import type { SubmitOutcome } from '@/lib/submission'

/**
 * 问卷流程容器。
 *
 * 采用分步骤问卷（不是一页无限滚动的长表单）。
 * 每个步骤可独立进入（支持直接访问 URL 与刷新恢复）。
 *
 * 访问守卫：
 *   - 未同意则不能进入 scenario 及之后的步骤。
 *   - 未有卷别则不能进入 dce。
 *   - done 步骤只在提交后显示。
 */

const STEP_COMPONENT_MAP: Record<Exclude<StepId, 'done'>, string> = {
  consent: 'consent',
  scenario: 'scenario',
  dce: 'dce',
  ratings: 'ratings',
  overall: 'overall',
  ideal: 'ideal',
  review: 'review',
}

export default function QuestionnairePage() {
  const { step } = useParams<{ step?: string }>()
  const navigate = useNavigate()

  const restore = useQuestionnaire((s) => s.restore)
  const isHydrated = useQuestionnaire((s) => s.isHydrated)
  const draft = useQuestionnaire((s) => s.draft)
  const markDraftSubmitted = useQuestionnaire((s) => s.markDraftSubmitted)

  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null)

  // 首次进入问卷时从本地恢复草稿
  useEffect(() => {
    if (!isHydrated) restore()
  }, [isHydrated, restore])

  const go = useCallback(
    (target: StepId) => {
      navigate(`/questionnaire/${target}`)
    },
    [navigate],
  )

  // 默认进入知情同意
  const currentStep: StepId = isStepId(step) ? step : 'consent'
  if (!step) {
    return <Navigate to="/questionnaire/consent" replace />
  }
  if (!isStepId(step)) {
    return <Navigate to="/404" replace />
  }

  // ── 访问守卫 ────────────────────────────────────────────
  const requiresConsent: StepId[] = ['scenario', 'dce', 'ratings', 'overall', 'ideal', 'review']
  if (requiresConsent.includes(currentStep) && draft.consentStatus !== 'agreed') {
    return <Navigate to="/questionnaire/consent" replace />
  }

  // done 步骤需要一次成功提交结果
  if (currentStep === 'done' && !outcome) {
    return <Navigate to="/questionnaire/review" replace />
  }

  const meta = STEP_META[currentStep]
  const showProgress = currentStep !== 'done'

  function handleSubmitted(result: SubmitOutcome) {
    setOutcome(result)
    // 只有后台确认成功时才清理本地草稿并记录已提交
    if (result.ok) {
      markDraftSubmitted()
    }
    go('done')
  }

  return (
    <PageContainer size="wide">
      {/* ── 步骤头部 ─────────────────────────────────────── */}
      <header className="mb-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-sage-600">
              问卷流程
            </p>
            <h1 className="mt-2 text-[1.5rem] font-semibold leading-tight text-forest-800 sm:text-[1.75rem]">
              {meta.index}. {meta.title}
            </h1>
          </div>
          {currentStep !== 'consent' && draft.assignedBlock && (
            <p className="rounded-panel bg-sage-100 px-3 py-1.5 text-[0.82rem] font-medium text-sage-800">
              卷别 {draft.assignedBlock}
            </p>
          )}
        </div>

        {showProgress && (
          <div className="mt-5">
            <ProgressBar
              current={Math.min(meta.index, TOTAL_PROGRESS_STEPS)}
              total={TOTAL_PROGRESS_STEPS}
              label={`进度：第 ${Math.min(meta.index, TOTAL_PROGRESS_STEPS)} 步 / 共 ${TOTAL_PROGRESS_STEPS} 步 · ${meta.short}`}
            />
          </div>
        )}
      </header>

      {/* ── 步骤内容 ─────────────────────────────────────── */}
      {currentStep === 'consent' && (
        <ConsentStep onAgreed={() => go('scenario')} onDeclined={() => go('done')} />
      )}

      {currentStep === 'scenario' && <ScenarioStep onContinue={() => go('dce')} />}

      {currentStep === 'dce' && <DceStep onContinue={() => go('ratings')} />}

      {currentStep === 'ratings' && <RatingsStep onContinue={() => go('overall')} />}

      {currentStep === 'overall' && <OverallStep onContinue={() => go('ideal')} />}

      {currentStep === 'ideal' && <IdealConfigStep onContinue={() => go('review')} />}

      {currentStep === 'review' && (
        <ReviewStep onBack={() => go('ideal')} onSubmitted={handleSubmitted} />
      )}

      {currentStep === 'done' && (
        draft.consentStatus === 'declined' && !outcome ? (
          <DeclinedPage />
        ) : (
          <DonePage outcome={outcome} participantId={draft.participantId} />
        )
      )}

      {/* 开发期提示：确保步骤组件映射完整（不会被渲染） */}
      {!STEP_COMPONENT_MAP[currentStep as Exclude<StepId, 'done'>] && currentStep !== 'done' && (
        <Card>
          <p className="text-[1rem] text-alert-700">未知步骤：{currentStep}</p>
        </Card>
      )}
    </PageContainer>
  )
}
