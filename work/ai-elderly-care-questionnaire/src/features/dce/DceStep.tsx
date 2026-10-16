import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import ProfileCard from './ProfileCard'
import SimulationModal from '@/features/simulation/SimulationModal'
import { useQuestionnaire } from '@/app/store'
import { PROFILES } from '@/data/profiles'
import { DCE_CHOICE_QUESTION, DCE_TASK_PROMPT, TASKS_PER_BLOCK } from '@/data/dceTasks'
import { UNIFIED_PREMISES } from '@/data/profiles'
import type { ProfileId, TaskId } from '@/types'

/**
 * 模块三｜DCE 离散选择实验（每卷 6 题）
 *
 * 严格使用 V1.0 的 C1–C8 配置与 T01–T12 任务配对、A/B 分卷规则。
 *
 * 记录要求（关键）：
 *   - **不是**只记录"用户选择了方案A"，而是记录其真正选择的 C1–C8 配置。
 *   - 每题记录：task_id、block_id、task_display_order、
 *     left/right_profile_id、left/right_profile_attributes、
 *     selected_side、selected_profile_id、response_duration_ms。
 *
 * 稳定性要求：
 *   - 题目顺序与左右位置来自草稿中已保存的 `dceTaskOrder`，
 *     返回上一题**不会**重新随机。
 *   - 每题的作答时长从"进入该题"开始计，切换题目时重置。
 */

/** 将秒级/毫秒级时长规范化为整数毫秒，并设合理上限。 */
function normalizeDuration(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.min(Math.round(ms), 24 * 60 * 60 * 1000)
}

export default function DceStep({ onContinue }: { onContinue: () => void }) {
  const draft = useQuestionnaire((s) => s.draft)
  const ensureBlockAndPlan = useQuestionnaire((s) => s.ensureBlockAndPlan)
  const recordDceChoice = useQuestionnaire((s) => s.recordDceChoice)
  const recordSimulationEvent = useQuestionnaire((s) => s.recordSimulationEvent)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [pendingSelection, setPendingSelection] = useState<{
    side: 'left' | 'right'
    profileId: ProfileId
  } | null>(null)
  const [simulationProfile, setSimulationProfile] = useState<ProfileId | null>(null)

  // 每题进入时间，用于计算 response_duration_ms
  const questionStartedAt = useRef<number>(Date.now())

  // 确保卷别与题目方案已生成（仅首次生效，之后不重新随机）
  useEffect(() => {
    ensureBlockAndPlan()
  }, [ensureBlockAndPlan])

  const plan = draft.dceTaskOrder
  const block = draft.assignedBlock

  const currentPlan = plan[currentIndex]
  const task = currentPlan
    ? {
        taskId: currentPlan.taskId as TaskId,
        left: currentPlan.leftProfileId,
        right: currentPlan.rightProfileId,
      }
    : null

  // 切换到新题：重置选择、重置计时
  useEffect(() => {
    questionStartedAt.current = Date.now()
    if (!currentPlan) return
    const saved = draft.dceChoices.find((c) => c.taskId === currentPlan.taskId)
    setPendingSelection(
      saved ? { side: saved.selectedSide, profileId: saved.selectedProfileId } : null,
    )
    // 仅在题目切换时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentPlan?.taskId])

  const answeredCount = draft.dceChoices.length
  const allAnswered = answeredCount >= TASKS_PER_BLOCK

  const handleSelect = useCallback((side: 'left' | 'right', profileId: ProfileId) => {
    setPendingSelection({ side, profileId })
  }, [])

  function handleConfirm() {
    if (!task || !pendingSelection || !block) return

    const left = PROFILES[task.left]
    const right = PROFILES[task.right]

    recordDceChoice({
      taskId: task.taskId,
      blockId: block,
      taskDisplayOrder: currentIndex + 1,
      leftProfileId: task.left,
      rightProfileId: task.right,
      leftProfileAttributes: { X1: left.X1, X2: left.X2, X3: left.X3 },
      rightProfileAttributes: { X1: right.X1, X2: right.X2, X3: right.X3 },
      selectedSide: pendingSelection.side,
      // 记录真正选中的配置编码，而不是"方案A/B"这一展示位置
      selectedProfileId: pendingSelection.profileId,
      responseDurationMs: normalizeDuration(Date.now() - questionStartedAt.current),
    })

    if (currentIndex < plan.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  const answeredTasks = useMemo(
    () => new Set(draft.dceChoices.map((c) => c.taskId as string)),
    [draft.dceChoices],
  )

  if (!block || !task) {
    return (
      <Card>
        <p role="status" className="text-[1rem] text-sage-700">
          正在准备题目…
        </p>
      </Card>
    )
  }

  const isLastQuestion = currentIndex === plan.length - 1
  const currentAnswered = answeredTasks.has(task.taskId)
  const canConfirm = pendingSelection !== null

  return (
    <div className="space-y-6">
      {/* ── 进度 ─────────────────────────────────────────── */}
      <Card tone="sage" className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.82rem] font-medium text-sage-700">DCE 配置选择</p>
            <p className="mt-0.5 text-[1.15rem] font-semibold text-forest-800">
              第 {currentIndex + 1} 题 / 共 {plan.length} 题
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">卷别 {block}</Badge>
            <Badge tone="neutral">任务 {task.taskId}</Badge>
            <Badge tone={allAnswered ? 'success' : 'champagne'}>
              {allAnswered ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  已完成 {answeredCount} / {TASKS_PER_BLOCK}
                </>
              ) : (
                <>{`已完成 ${answeredCount} / ${TASKS_PER_BLOCK}`}</>
              )}
            </Badge>
          </div>
        </div>

        {/* 题目导航圆点：可跳回已作答的题目修改答案 */}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="题目导航">
          {plan.map((item, index) => {
            const done = answeredTasks.has(item.taskId)
            const isCurrent = index === currentIndex
            return (
              <button
                key={item.taskId}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`第 ${index + 1} 题${done ? '，已作答' : '，未作答'}${isCurrent ? '，当前题目' : ''}`}
                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-panel border px-2.5 text-[0.85rem] font-semibold transition-colors ${
                  isCurrent
                    ? 'border-forest-700 bg-forest-700 text-white'
                    : done
                      ? 'border-forest-200 bg-forest-50 text-forest-800 hover:border-forest-500'
                      : 'border-sage-300 bg-white text-sage-700 hover:border-sage-500'
                }`}
              >
                {index + 1}
                {done && <CheckCircle2 className="ml-1 h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </Card>

      {/* ── 题干与情景提示 ───────────────────────────────── */}
      <Card>
        <h2 className="text-[1.15rem] font-semibold leading-relaxed text-forest-800">
          {DCE_TASK_PROMPT}
        </h2>

        <div className="mt-4 flex items-start gap-3 rounded-panel border border-forest-100 bg-forest-50 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-[0.92rem] leading-8 text-forest-800">
            {UNIFIED_PREMISES.sharedCapability}
            两个方案的基础异常识别与报警能力完全相同，差别只在下方标为
            <span className="mx-1 rounded bg-champagne-100 px-1.5 py-0.5 text-[0.85rem] font-semibold text-champagne-800">
              不同
            </span>
            的属性上。
          </p>
        </div>
      </Card>

      {/* ── 两个方案卡片 ─────────────────────────────────── */}
      <div
        className="grid gap-5 lg:grid-cols-2"
        role="radiogroup"
        aria-label="请选择更愿意长期采用的系统配置"
      >
        <ProfileCard
          profileId={task.left}
          label="方案 A"
          otherProfileId={task.right}
          otherLabel="方案 B"
          isSelected={pendingSelection?.profileId === task.left}
          onSelect={() => handleSelect('left', task.left)}
          onOpenSimulation={() => setSimulationProfile(task.left)}
        />
        <ProfileCard
          profileId={task.right}
          label="方案 B"
          otherProfileId={task.left}
          otherLabel="方案 A"
          isSelected={pendingSelection?.profileId === task.right}
          onSelect={() => handleSelect('right', task.right)}
          onOpenSimulation={() => setSimulationProfile(task.right)}
        />
      </div>

      {/* ── 明确的选择确认区 ─────────────────────────────── */}
      <Card>
        <fieldset>
          <legend className="text-[1.15rem] font-semibold text-forest-800">
            {DCE_CHOICE_QUESTION}
          </legend>
          <p className="mt-1.5 text-[0.9rem] text-sage-700">
            请选择一项后确认。未选择时不能进入下一题。
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ['left', task.left, '方案 A'],
              ['right', task.right, '方案 B'],
            ] as const).map(([side, profileId, label]) => {
              const checked = pendingSelection?.side === side
              return (
                <label
                  key={side}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-panel border px-4 py-3 text-[1rem] transition-colors ${
                    checked
                      ? 'border-forest-700 bg-forest-50 font-semibold text-forest-900'
                      : 'border-sage-200 bg-white text-sage-700 hover:border-sage-500 hover:bg-sage-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="dce-side"
                    className="sr-only"
                    checked={checked}
                    onChange={() => handleSelect(side, profileId)}
                  />
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      checked ? 'border-forest-700' : 'border-sage-500'
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />}
                  </span>
                  <span>
                    {label}
                    <span className="ml-2 font-mono text-[0.8rem] text-sage-600">{profileId}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {!canConfirm && (
          <p className="mt-4 flex items-center gap-2 text-[0.88rem] text-champagne-800" role="status">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            请先选择您更愿意采用的方案。
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="secondary"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回上一题
          </Button>

          {isLastQuestion ? (
            <Button size="lg" onClick={handleConfirm} disabled={!canConfirm}>
              {currentAnswered ? '更新本题答案' : '确认本题作答'}
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </Button>
          ) : (
            <Button size="lg" onClick={handleConfirm} disabled={!canConfirm}>
              {currentAnswered ? '更新并进入下一题' : '确认并进入下一题'}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </Card>

      {/* ── 全部完成提示 ─────────────────────────────────── */}
      {allAnswered && (
        <Card tone="sage">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-[0.95rem] leading-8 text-sage-700">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
              6 道配置选择题已全部完成。您可以继续，也可以点击上方题目编号返回修改。
            </p>
            <Button size="lg" onClick={onContinue} className="shrink-0">
              继续：配置感受评价
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2.5 px-1 text-[0.85rem] leading-relaxed text-sage-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        本题的左右方案位置由系统随机决定。返回上一题或刷新页面都不会重新随机，
        以保证您看到的位置与之前一致。
      </p>

      {simulationProfile && (
        <SimulationModal
          profileId={simulationProfile}
          taskId={task.taskId}
          source="dce"
          onClose={() => setSimulationProfile(null)}
          onEvent={recordSimulationEvent}
        />
      )}
    </div>
  )
}
