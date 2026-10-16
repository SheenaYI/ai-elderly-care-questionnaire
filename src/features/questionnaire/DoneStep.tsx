import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  CircleAlert,
  HeartHandshake,
  Info,
  RefreshCcw,
  TriangleAlert,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { SubmitOutcome } from '@/lib/submission'
import { ALL_CONFIGURABLE_FIELDS } from '@/data/placeholders'
import { STUDY_TITLE } from '@/data/questionnaire'

/**
 * 提交结果页。
 *
 * ⚠️ 核心要求：**不要错误地显示提交成功**。
 *   - 只有后台确认提交成功时，才显示"您的回答已成功提交。"
 *   - Demo 模式必须明确说明数据**未上传到云端**。
 *   - 提交失败时提示重试，并说明本地填写状态已保留（由 ReviewStep 处理）。
 */

export function DeclinedPage() {
  return (
    <Card>
      <div className="py-4 text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-panel bg-sage-100 text-forest-700"
          aria-hidden="true"
        >
          <HeartHandshake className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-[1.5rem] font-semibold text-forest-800">感谢您的关注</h1>
        <p className="mx-auto mt-3 max-w-xl text-[1rem] leading-8 text-sage-700">
          您已选择不参与本研究，问卷到此结束，不会记录您的任何回答。
          如果您改变主意，随时可以重新开始。
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center justify-center rounded-panel bg-forest-700 px-6 text-[1rem] font-semibold text-white transition hover:bg-forest-600"
          >
            返回首页
          </Link>
          <Link
            to="/questionnaire/consent"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-panel border border-forest-700 px-6 text-[1rem] font-semibold text-forest-800 transition hover:bg-forest-50"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            重新考虑参与
          </Link>
        </div>
      </div>
    </Card>
  )
}

export function DonePage({
  outcome,
  participantId,
}: {
  outcome: SubmitOutcome | null
  participantId: string
}) {
  const isRealSubmit = outcome?.ok === true && outcome.mode === 'supabase'
  const isDemo = outcome?.ok === true && outcome.mode === 'demo'

  return (
    <Card>
      <div className="py-2 text-center">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-panel ${
            isRealSubmit ? 'bg-forest-50 text-forest-700' : 'bg-champagne-50 text-champagne-800'
          }`}
          aria-hidden="true"
        >
          {isRealSubmit ? <CheckCircle2 className="h-7 w-7" /> : <CircleAlert className="h-7 w-7" />}
        </span>

        <h1 className="mt-5 text-[1.5rem] font-semibold text-forest-800">
          {isRealSubmit ? '感谢您参与本次研究' : '本次填写已完成'}
        </h1>

        {isRealSubmit ? (
          <p className="mx-auto mt-3 max-w-xl text-[1.1rem] leading-9 text-forest-800">
            您的回答已成功提交。
          </p>
        ) : (
          <p className="mx-auto mt-3 max-w-xl text-[1rem] leading-8 text-sage-700">
            {outcome?.message ??
              '感谢您完成本次填写。请注意：本次数据未上传到云端数据库。'}
          </p>
        )}

        {isDemo && (
          <div className="mx-auto mt-5 max-w-xl rounded-panel border border-champagne-300 bg-champagne-50 px-4 py-3.5 text-left">
            <p className="flex items-start gap-2.5 text-[0.92rem] leading-relaxed text-champagne-800">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold">当前为 Demo 模式。</strong>
                您刚才的填写没有写入云端数据库，仅保留在您本人的浏览器中，
                用于内部试填与演示。研究团队完成 Supabase 配置后，数据才会真正保存。
              </span>
            </p>
          </div>
        )}

        <div className="mx-auto mt-6 max-w-xl">
          <p className="text-[0.88rem] text-sage-600">
            匿名编号（如需撤回问卷，请向研究团队提供此编号）：
          </p>
          <p className="mt-1.5 rounded-panel bg-sage-50 px-4 py-2.5 font-mono text-[0.95rem] text-forest-800">
            {participantId}
          </p>
        </div>

        {isRealSubmit && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Badge tone="success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              已写入研究数据库
            </Badge>
            <Badge tone="neutral">仅用于学术研究</Badge>
          </div>
        )}
      </div>

      {ALL_CONFIGURABLE_FIELDS.some((f) => f.pending) && (
        <div className="mt-8 border-t border-sage-200 pt-5">
          <p className="flex items-start gap-2.5 text-[0.85rem] leading-relaxed text-sage-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              本问卷隐私告知中的部分信息（单位名称、研究负责人、研究联系人、
              伦理审批编号、数据保存期限、可访问数据的人员范围与退出方式）
              仍待研究团队补充确认，因此暂未展示、也未作编造。
              正式上线前将由研究团队完成补充。
            </span>
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 border-t border-sage-200 pt-6 sm:flex-row">
        <Link
          to="/"
          className="inline-flex min-h-12 items-center justify-center rounded-panel bg-forest-700 px-6 text-[1rem] font-semibold text-white transition hover:bg-forest-600"
        >
          返回首页
        </Link>
        <Link
          to="/about"
          className="inline-flex min-h-12 items-center justify-center rounded-panel border border-forest-700 px-6 text-[1rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          了解研究详情
        </Link>
      </div>

      <p className="mt-6 text-center text-[0.82rem] text-sage-600">{STUDY_TITLE}</p>
    </Card>
  )
}
