import { useState } from 'react'
import {
  ArrowRight,
  CircleHelp,
  Database,
  FileText,
  Info,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  TriangleAlert,
  UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import {
  OPENING_STATEMENT,
  Q1_CONSENT,
  Q2_AGE_GROUPS,
  Q2_QUESTION,
  Q3_QUESTION,
  Q3_ROLES,
  Q4_AI_EXPERIENCE,
  Q4_QUESTION,
  Q5_CAREGIVING,
  Q5_QUESTION,
  ROLE_INSTRUCTION,
} from '@/data/questionnaire'
import { useQuestionnaire } from '@/app/store'
import type { AgeGroup, AiDeviceExperience, CaregivingExperience, RespondentRole } from '@/types'

/**
 * 模块一｜知情同意与身份信息
 *
 * 关键行为：
 *   - 参与者必须**主动选择同意**才能继续；不同意则进入感谢页面，不再显示后续问卷。
 *   - Q2–Q5 全部为必答。
 *   - 选择"其他"身份时需要填写说明。
 *   - 研究联系人、保存期限等未确定信息使用占位字段，不编造。
 */

function ConsentSection({
  index,
  icon: Icon,
  title,
  children,
}: {
  index: string
  icon: typeof ShieldCheck
  title: string
  children?: React.ReactNode
}) {
  return (
    <section className="border-t border-sage-200 pt-5 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2.5 text-[1.05rem] font-semibold text-forest-800">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-panel bg-forest-50 text-forest-700"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-mono text-[0.78rem] text-sage-500">{index}</span>
        {title}
      </h3>
      <div className="mt-2.5 space-y-2.5 text-[0.95rem] leading-8 text-sage-700">{children}</div>
    </section>
  )
}

/** 单选组（大尺寸，适合中老年参与者与触屏）。 */
function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  required,
}: {
  legend: string
  name: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  required?: boolean
}) {
  return (
    <fieldset className="mt-2">
      <legend className="text-[1.02rem] font-semibold text-forest-800">
        {legend}
        {required && (
          <span className="ml-1.5 text-[0.85rem] font-medium text-alert-700" aria-hidden="true">
            *必答
          </span>
        )}
      </legend>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => {
          const checked = value === option.value
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
                name={name}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(option.value)}
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
  )
}

export default function ConsentStep({
  onAgreed,
  onDeclined,
}: {
  onAgreed: () => void
  onDeclined: () => void
}) {
  const draft = useQuestionnaire((s) => s.draft)
  const setConsent = useQuestionnaire((s) => s.setConsent)
  const setIdentity = useQuestionnaire((s) => s.setIdentity)

  const [showErrors, setShowErrors] = useState(false)

  const { identity } = draft
  const needsOtherText = identity.respondentRole === 'other'
  const identityComplete =
    identity.ageGroup !== null &&
    identity.respondentRole !== null &&
    identity.aiDeviceExperience !== null &&
    identity.caregivingExperience !== null &&
    (!needsOtherText || identity.respondentRoleOther.trim().length > 0)

  function handleAgree() {
    setConsent('agreed')
    if (!identityComplete) {
      setShowErrors(true)
      // 身份信息不完整时停留在本页，等待填写
      window.requestAnimationFrame(() => {
        document.getElementById('identity-section')?.scrollIntoView({ block: 'start' })
      })
      return
    }
    setShowErrors(false)
    onAgreed()
  }

  function handleDecline() {
    setConsent('declined')
    onDeclined()
  }

  return (
    <div className="space-y-7">
      {/* ── 研究说明 ─────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-panel bg-forest-50 p-2 text-forest-700" aria-hidden="true">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[1.2rem] font-semibold text-forest-800">研究说明</h2>
            <p className="mt-2 text-[0.98rem] leading-8 text-sage-700">{OPENING_STATEMENT}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <ConsentSection index="01" icon={FileText} title="研究目的">
            <p>
              了解人们对 AI 养老监测系统不同信息共享与监测配置的偏好，
              以及对安全、隐私和老人自主性的感受。
              本研究为大学生创新创业训练计划科研项目，结果仅用于学术研究。
              承担本研究的单位与负责人信息将在正式发放前补充。
            </p>
          </ConsentSection>

          <ConsentSection index="02" icon={UserCog} title="自愿参与与预计用时">
            <p>
              参与完全自愿。您可以在任何时候关闭页面退出，无需说明理由，
              也不会受到任何不利影响。未提交的内容只保存在您自己的浏览器中。
              预计填写时间将在研究团队完成内部试填后公示。
            </p>
          </ConsentSection>

          <ConsentSection index="03" icon={Database} title="数据使用说明">
            <p>
              问卷不收集姓名、身份证号、联系方式或真实监控视频。
              回答以匿名编号保存，仅用于本研究的统计分析，并以汇总形式报告。
            </p>
          </ConsentSection>

          <ConsentSection index="04" icon={LockKeyhole} title="隐私保护说明">
            <p>
              网站中的 AI 监测属于<strong className="font-semibold text-forest-800">模拟</strong>
              ，不会开启您的摄像头，不会进行真实养老监控，也不会收集您的影像。
              匿名参与者不能查看他人的任何回答。
              数据保存期限与可访问数据的人员范围将在正式发放前补充确认。
            </p>
          </ConsentSection>

          <ConsentSection index="05" icon={CircleHelp} title="研究联系人">
            <p>
              如对本研究有任何疑问，或希望了解研究结果、申请撤回已提交的问卷，
              可通过研究团队在正式发放前公布的联系方式与我们联系。
              由于问卷为匿名保存，我们无法通过姓名定位您的问卷。
            </p>
          </ConsentSection>

          <ConsentSection index="06" icon={LogOut} title="退出机制">
            <p>
              您可随时退出。若需撤回已提交的问卷或申请删除数据，可联系研究团队。
              具体的联系方式与申请方式将在正式发放前补充确认。
              由于问卷为匿名保存，我们无法通过姓名定位您的问卷。
            </p>
          </ConsentSection>
        </div>
      </Card>

      {/* ── Q1 知情同意 ──────────────────────────────────── */}
      <Card tone="champagne" as="section">
        <fieldset>
          <legend className="text-[1.08rem] font-semibold text-champagne-800">
            Q1 {Q1_CONSENT.text}
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleAgree}
              className="min-h-14 rounded-panel bg-forest-700 px-5 text-[1.05rem] font-semibold text-white shadow-card transition hover:bg-forest-600"
            >
              {Q1_CONSENT.options[0].label}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              className="min-h-14 rounded-panel border border-sage-300 bg-white px-5 text-[1.05rem] font-semibold text-sage-700 transition hover:bg-sage-50"
            >
              {Q1_CONSENT.options[1].label}
            </button>
          </div>
          <p className="mt-3 text-[0.88rem] leading-relaxed text-champagne-800">
            <Info className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
            选择"不同意"后，本问卷将结束，不再显示后续题目。
          </p>
        </fieldset>
      </Card>

      {/* ── Q2–Q5 身份信息 ───────────────────────────────── */}
      <Card id="identity-section" as="section">
        <h2 className="text-[1.2rem] font-semibold text-forest-800">身份信息</h2>
        <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
          {ROLE_INSTRUCTION.older_adult}
          {ROLE_INSTRUCTION.caregiver}
          <br />
          <span className="text-[0.88rem] text-sage-600">{ROLE_INSTRUCTION.analysis}</span>
        </p>

        <div className="mt-6 space-y-7">
          <RadioGroup<AgeGroup>
            legend={`Q2 ${Q2_QUESTION}`}
            name="q2-age"
            required
            options={Q2_AGE_GROUPS}
            value={identity.ageGroup}
            onChange={(value) => setIdentity({ ageGroup: value })}
          />

          <RadioGroup<RespondentRole>
            legend={`Q3 ${Q3_QUESTION}`}
            name="q3-role"
            required
            options={Q3_ROLES}
            value={identity.respondentRole}
            onChange={(value) => setIdentity({ respondentRole: value })}
          />

          {needsOtherText && (
            <div>
              <label
                htmlFor="role-other"
                className="block text-[0.95rem] font-medium text-forest-800"
              >
                请注明您的身份
                <span className="ml-1.5 text-[0.85rem] text-alert-700">*必答</span>
              </label>
              <input
                id="role-other"
                type="text"
                maxLength={200}
                value={identity.respondentRoleOther}
                onChange={(event) => setIdentity({ respondentRoleOther: event.target.value })}
                className="mt-2 min-h-13 w-full rounded-panel border border-sage-300 bg-white px-4 text-[1rem] outline-none transition focus:border-forest-700"
                placeholder="例如：社区养老工作人员"
              />
            </div>
          )}

          <RadioGroup<AiDeviceExperience>
            legend={`Q4 ${Q4_QUESTION}`}
            name="q4-ai"
            required
            options={Q4_AI_EXPERIENCE}
            value={identity.aiDeviceExperience}
            onChange={(value) => setIdentity({ aiDeviceExperience: value })}
          />

          <RadioGroup<CaregivingExperience>
            legend={`Q5 ${Q5_QUESTION}`}
            name="q5-care"
            required
            options={Q5_CAREGIVING}
            value={identity.caregivingExperience}
            onChange={(value) => setIdentity({ caregivingExperience: value })}
          />
        </div>

        {showErrors && !identityComplete && (
          <div
            className="mt-6 flex items-start gap-3 rounded-panel border border-alert-100 bg-alert-50 px-4 py-3"
            role="alert"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-alert-700" aria-hidden="true" />
            <p className="text-[0.92rem] leading-relaxed text-alert-700">
              请完成 Q2–Q5 的全部必答项
              {needsOtherText ? '（包括"其他"身份的说明文字）' : ''}，然后再继续。
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={handleAgree}>
            已完成，继续下一步
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
