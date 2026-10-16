import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Info,
  Lightbulb,
  MonitorPlay,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import {
  ATTRIBUTE_DEFINITIONS,
  UNIFIED_PREMISES,
} from '@/data/profiles'
import {
  COMPREHENSION_QUESTIONS,
  SCENARIO_STATEMENT,
} from '@/data/questionnaire'
import { useQuestionnaire } from '@/app/store'
import { isCorrectComprehensionAnswer } from '@/data/questionnaire'
import type { ComprehensionQuestionId } from '@/types'

/**
 * 模块二｜统一情景与属性说明 + 理解检查
 *
 * 必须让参与者清楚区分三件不同的事：
 *   1. 基础异常检测（所有方案都持续运行，能力完全相同）
 *   2. 详细监测与记录（由 X3 决定平时是否持续）
 *   3. 向接收者共享的信息（由 X1 决定，X2 决定共享给谁）
 *
 * 绝不能让人误以为"仅摘要信息"意味着系统无法检测异常。
 *
 * 理解检查行为：
 *   - 答错时展示正确解释，允许重新阅读后继续
 *   - 后台记录**首次**作答结果（isCorrect 与 firstAnswerIndex）
 */

const ATTRIBUTE_ICONS = [Eye, ShieldCheck, MonitorPlay] as const

function ComprehensionCard({
  questionId,
  onAnswered,
}: {
  questionId: ComprehensionQuestionId
  onAnswered: (record: {
    questionId: ComprehensionQuestionId
    firstAnswerIndex: number
    isCorrect: boolean
    retryCount: number
  }) => void
}) {
  const question = COMPREHENSION_QUESTIONS.find((q) => q.id === questionId)!
  const existing = useQuestionnaire((s) =>
    s.draft.comprehension.find((c) => c.questionId === questionId),
  )

  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [retryCount, setRetryCount] = useState(existing?.retryCount ?? 0)

  const isCorrect = selected !== null && isCorrectComprehensionAnswer(questionId, selected)

  function handleCheck() {
    if (selected === null) return
    const correct = isCorrectComprehensionAnswer(questionId, selected)
    setShowResult(true)
    onAnswered({
      questionId,
      // 若已有记录，store 会保留首次结果，不会覆盖
      firstAnswerIndex: selected,
      isCorrect: correct,
      retryCount,
    })
  }

  function handleRetry() {
    setShowResult(false)
    setSelected(null)
    setRetryCount((c) => c + 1)
  }

  const firstRecord = existing

  return (
    <Card tone={firstRecord && firstRecord.isCorrect ? 'sage' : 'white'}>
      <fieldset>
        <legend className="text-[1.05rem] font-semibold text-forest-800">
          {question.text}
        </legend>

        <div className="mt-4 grid gap-2.5">
          {question.options.map((option, index) => {
            const checked = selected === index
            const showCorrect = showResult && option.correct
            const showWrong = showResult && checked && !option.correct

            return (
              <label
                key={option.label}
                className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-panel border px-4 py-3 text-[0.98rem] transition-colors ${
                  showCorrect
                    ? 'border-forest-700 bg-forest-50 font-semibold text-forest-900'
                    : showWrong
                      ? 'border-alert-500 bg-alert-50 font-semibold text-alert-700'
                      : checked
                        ? 'border-forest-700 bg-forest-50 font-semibold text-forest-900'
                        : 'border-sage-200 bg-white text-sage-700 hover:border-sage-500 hover:bg-sage-50'
                }`}
              >
                <input
                  type="radio"
                  name={`comprehension-${questionId}`}
                  className="sr-only"
                  checked={checked}
                  disabled={showResult}
                  onChange={() => setSelected(index)}
                />
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    showCorrect
                      ? 'border-forest-700 bg-forest-700'
                      : showWrong
                        ? 'border-alert-500 bg-alert-500'
                        : checked
                          ? 'border-forest-700'
                          : 'border-sage-500'
                  }`}
                  aria-hidden="true"
                >
                  {showCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  {showWrong && <XCircle className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  {!showResult && checked && <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />}
                </span>
                {option.label}
                {showCorrect && <span className="ml-auto text-[0.82rem] font-medium">正确答案</span>}
                {showWrong && <span className="ml-auto text-[0.82rem] font-medium">您的选择</span>}
              </label>
            )
          })}
        </div>

        {!showResult ? (
          <Button
            className="mt-5"
            onClick={handleCheck}
            disabled={selected === null}
          >
            提交本题答案
          </Button>
        ) : (
          <div
            className={`mt-5 flex items-start gap-3 rounded-panel border px-4 py-3.5 ${
              isCorrect
                ? 'border-forest-100 bg-forest-50'
                : 'border-champagne-300 bg-champagne-50'
            }`}
            role="status"
          >
            {isCorrect ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
            ) : (
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
            )}
            <div>
              <p
                className={`text-[0.98rem] font-semibold ${
                  isCorrect ? 'text-forest-800' : 'text-champagne-800'
                }`}
              >
                {isCorrect ? '回答正确' : '这里需要留意'}
              </p>
              {!isCorrect && (
                <p className="mt-1.5 text-[0.92rem] leading-8 text-champagne-800">
                  {question.explanation}
                </p>
              )}
              <p className="mt-2 text-[0.85rem] leading-relaxed text-sage-700">
                您可以重新阅读上方的情景说明后再继续。本题的首次作答结果会被记录，
                用于检验情景说明是否清晰，不影响您继续填写。
              </p>
              {!isCorrect && (
                <Button variant="secondary" className="mt-3" onClick={handleRetry}>
                  重新作答本题
                </Button>
              )}
            </div>
          </div>
        )}
      </fieldset>
    </Card>
  )
}

export default function ScenarioStep({ onContinue }: { onContinue: () => void }) {
  const comprehension = useQuestionnaire((s) => s.draft.comprehension)
  const recordComprehension = useQuestionnaire((s) => s.recordComprehension)

  const allAnswered = COMPREHENSION_QUESTIONS.every((q) =>
    comprehension.some((c) => c.questionId === q.id),
  )

  return (
    <div className="space-y-7">
      {/* ── 研究情景 ─────────────────────────────────────── */}
      <Card>
        <h2 className="text-[1.2rem] font-semibold text-forest-800">研究情景</h2>
        <p className="mt-3 text-[1rem] leading-9 text-sage-700">{SCENARIO_STATEMENT}</p>

        <div className="mt-5 flex items-start gap-3 rounded-panel border border-forest-100 bg-forest-50 px-4 py-3.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-[0.95rem] leading-8 text-forest-800">
            {UNIFIED_PREMISES.sharedCapability}
          </p>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-panel border border-champagne-200 bg-champagne-50 px-4 py-3.5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
          <p className="text-[0.95rem] leading-8 text-champagne-800">
            {UNIFIED_PREMISES.items[2]}
            <br />
            <strong className="font-semibold">
              特别注意："仅摘要信息"不会降低系统识别异常的能力。
            </strong>
            它只限制接收者能看到多少细节。所有方案的基础异常识别与报警能力完全相同。
          </p>
        </div>
      </Card>

      {/* ── 三个实验属性 ─────────────────────────────────── */}
      <Card>
        <h2 className="text-[1.2rem] font-semibold text-forest-800">三个实验属性</h2>
        <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
          不同方案仅在以下三个方面不同，每个属性有两个水平。
        </p>

        <div className="mt-5 space-y-4">
          {ATTRIBUTE_DEFINITIONS.map((definition, index) => {
            const Icon = ATTRIBUTE_ICONS[index] ?? Eye
            return (
              <div key={definition.key} className="rounded-panel border border-sage-200 p-4">
                <h3 className="flex items-center gap-2.5 text-[1.02rem] font-semibold text-forest-800">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-panel bg-forest-50 text-forest-700"
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {definition.researchTitle}
                  <span className="text-[0.85rem] font-normal text-sage-600">
                    （{definition.title}）
                  </span>
                </h3>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {([0, 1] as const).map((level) => {
                    const value = definition.levels[level]
                    return (
                      <div key={level} className="rounded-panel bg-sage-50 px-3.5 py-3">
                        <p className="font-mono text-[0.72rem] uppercase tracking-wider text-sage-600">
                          水平 {level}
                        </p>
                        <p className="mt-1 text-[0.95rem] font-semibold text-forest-900">
                          {value.label}
                        </p>
                        <p className="mt-1 text-[0.85rem] leading-relaxed text-sage-700">
                          {value.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-5 rounded-panel bg-sage-50 px-4 py-3.5">
          <p className="text-[0.92rem] font-semibold text-forest-800">统一前提</p>
          <ul className="mt-2 space-y-1.5">
            {UNIFIED_PREMISES.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.9rem] leading-relaxed text-sage-700">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ── 理解检查 Q6 / Q7 ─────────────────────────────── */}
      <section aria-labelledby="comprehension-title" className="space-y-4">
        <div>
          <h2 id="comprehension-title" className="text-[1.2rem] font-semibold text-forest-800">
            理解检查
          </h2>
          <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
            在继续之前，请先确认您对两个关键概念的理解。这两道题没有惩罚，
            答错会显示解释，您可以重新阅读后继续作答。
          </p>
        </div>

        {COMPREHENSION_QUESTIONS.map((question) => (
          <ComprehensionCard
            key={question.id}
            questionId={question.id}
            onAnswered={recordComprehension}
          />
        ))}
      </section>

      {/* ── 继续 ─────────────────────────────────────────── */}
      <Card tone="sage">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {allAnswered ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-champagne-700" aria-hidden="true" />
            )}
            <p className="text-[0.95rem] leading-8 text-sage-700">
              {allAnswered
                ? '两道理解检查题均已完成，可以继续进入配置选择。'
                : '请先完成上方两道理解检查题，再继续。'}
            </p>
          </div>
          <Button size="lg" onClick={onContinue} disabled={!allAnswered} className="shrink-0">
            继续：配置选择
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
