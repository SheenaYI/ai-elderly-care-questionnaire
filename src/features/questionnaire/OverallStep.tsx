import { ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useQuestionnaire } from '@/app/store'
import {
  Q8_LIKERT_OPTIONS,
  Q8_QUESTION,
  Q8_SCALE_PROMPT,
  Q9_CONCERNS,
  Q9_QUESTION,
  Q10_NOTE,
  Q10_QUESTION,
} from '@/data/questionnaire'
import type { LikertValue, MainConcern } from '@/types'

/**
 * 模块五｜总体评价
 *
 * Q8 总体采纳意愿（1–5）
 * Q9 最担心的问题（单选）
 * Q10 开放性建议（**可跳过**）
 */
export default function OverallStep({ onContinue }: { onContinue: () => void }) {
  const overall = useQuestionnaire((s) => s.draft.overall)
  const setQ8 = useQuestionnaire((s) => s.setQ8)
  const setQ9 = useQuestionnaire((s) => s.setQ9)
  const setQ10 = useQuestionnaire((s) => s.setQ10)

  const q8Answered = overall.q8 !== null
  const q9Answered = overall.q9 !== null
  const canContinue = q8Answered && q9Answered

  return (
    <div className="space-y-6">
      {/* ── Q8 总体采纳意愿 ─────────────────────────────── */}
      <Card>
        <fieldset>
          <legend className="text-[1.15rem] font-semibold leading-relaxed text-forest-800">
            Q8 {Q8_QUESTION}
          </legend>
          <p className="mt-1.5 text-[0.9rem] text-sage-700">{Q8_SCALE_PROMPT}<span className="ml-1.5 text-alert-700">*必答</span></p>

          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {Q8_LIKERT_OPTIONS.map((option) => {
              const checked = overall.q8 === option.value
              return (
                <label
                  key={option.value}
                  className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-panel border px-2 py-2.5 text-center transition-colors ${
                    checked
                      ? 'border-forest-700 bg-forest-700 text-white'
                      : 'border-sage-200 bg-sage-50 text-sage-700 hover:border-sage-500 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="q8"
                    className="sr-only"
                    checked={checked}
                    onChange={() => setQ8(option.value as LikertValue)}
                  />
                  <span className="font-mono text-[1.05rem] font-semibold" aria-hidden="true">
                    {option.value}
                  </span>
                  <span className="text-[0.8rem] leading-tight">
                    {option.label.replace(/^\d\s*/, '')}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* ── Q9 最担心的问题 ─────────────────────────────── */}
      <Card>
        <fieldset>
          <legend className="text-[1.15rem] font-semibold leading-relaxed text-forest-800">
            Q9 {Q9_QUESTION}
          </legend>
          <p className="mt-1.5 text-[0.9rem] text-sage-700">
            请选择最符合您想法的一项<span className="ml-1.5 text-alert-700">*必答</span>
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {Q9_CONCERNS.map((option) => {
              const checked = overall.q9 === option.value
              return (
                <label
                  key={option.value}
                  className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-panel border px-4 py-3 text-[0.98rem] transition-colors ${
                    checked
                      ? 'border-forest-700 bg-forest-50 font-semibold text-forest-900'
                      : 'border-sage-200 bg-white text-sage-700 hover:border-sage-500 hover:bg-sage-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="q9"
                    className="sr-only"
                    checked={checked}
                    onChange={() => setQ9(option.value as MainConcern)}
                  />
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      checked ? 'border-forest-700' : 'border-sage-500'
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />}
                  </span>
                  {option.label}
                </label>
              )
            })}
          </div>
        </fieldset>
      </Card>

      {/* ── Q10 开放性建议（可跳过） ─────────────────────── */}
      <Card>
        <label htmlFor="q10" className="text-[1.15rem] font-semibold leading-relaxed text-forest-800">
          Q10 {Q10_QUESTION}
        </label>
        <p className="mt-1.5 text-[0.9rem] text-sage-700">
          {Q10_NOTE}
          <span className="ml-1.5 rounded bg-sage-100 px-1.5 py-0.5 text-[0.8rem] text-sage-700">
            选填
          </span>
        </p>

        <textarea
          id="q10"
          rows={6}
          maxLength={2000}
          value={overall.q10}
          onChange={(event) => setQ10(event.target.value)}
          placeholder="您可以在这里写下任何想法（可留空）。请勿填写姓名、电话、住址等可识别个人身份的信息。"
          className="mt-3 w-full rounded-panel border border-sage-300 bg-white px-4 py-3 text-[1rem] leading-8 outline-none transition focus:border-forest-700"
        />
        <p className="mt-2 text-[0.82rem] text-sage-600">
          已填写 {overall.q10.length} / 2000 字
        </p>

        <div className="mt-3 flex items-start gap-3 rounded-panel border border-sage-200 bg-sage-50 px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
          <p className="text-[0.88rem] leading-relaxed text-sage-700">
            为了您的隐私，请不要在此填写任何可识别个人身份的信息。
          </p>
        </div>
      </Card>

      {/* ── 继续 ─────────────────────────────────────────── */}
      <Card tone="sage">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.95rem] leading-8 text-sage-700">
            {canContinue
              ? '总体评价已完成。下一步将显示提交前检查，确认所有必答题完整。'
              : '请先完成 Q8 与 Q9（Q10 可以跳过）。'}
          </p>
          <Button size="lg" onClick={onContinue} disabled={!canContinue} className="shrink-0">
            继续：提交前检查
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
