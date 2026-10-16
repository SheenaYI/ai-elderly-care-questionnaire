import { Link } from 'react-router-dom'
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
import PageContainer from '@/components/layout/PageContainer'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import PendingField from '@/components/ui/PendingField'
import { ButtonLink } from '@/components/ui/Button'
import type { ConfigurableField } from '@/data/placeholders'
import {
  DATA_ACCESS_SCOPE,
  DATA_RETENTION,
  ESTIMATED_DURATION,
  ETHICS_APPROVAL,
  RESEARCH_CONTACT,
  RESEARCH_CONTACT_EMAIL,
  RESEARCH_INSTITUTION,
  RESEARCH_LEAD,
  WITHDRAWAL_PROCEDURE,
  pendingFields,
} from '@/data/placeholders'
import { dataModeNotice } from '@/lib/config'

/**
 * 页面四：隐私与知情同意
 *
 * 这是正式的信息说明页面。未确定的信息一律使用占位字段，**不编造**。
 * 本页面与问卷模块一的知情同意使用同一份占位字段配置，保证口径一致。
 */

function Section({
  id,
  icon: Icon,
  index,
  title,
  children,
}: {
  id: string
  icon: typeof ShieldCheck
  index: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="flex items-center gap-3 text-[1.2rem] font-semibold text-forest-800">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel bg-forest-50 text-forest-700"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-mono text-[0.85rem] text-sage-500">{index}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 pl-0 text-[1rem] leading-8 text-sage-700 sm:pl-12">{children}</div>
    </section>
  )
}

/** 待填写信息的行内展示。 */
function Todo({ field }: { field: ConfigurableField }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1">
      <span className="font-medium text-forest-900">{field.label}：</span>
      <PendingField field={field} inline />
    </span>
  )
}

export default function PrivacyPage() {
  const modeNotice = dataModeNotice()
  const pending = pendingFields()

  return (
    <PageContainer size="default">
      <header className="border-b border-sage-200 pb-8">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-sage-600">
          04 隐私与知情同意
        </p>
        <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.3] text-forest-800 sm:text-[2.125rem]">
          隐私保护与知情同意说明
        </h1>
        <p className="mt-4 max-w-2xl text-[1.05rem] leading-8 text-sage-700">
          在您决定是否参与之前，请先阅读以下说明。参与本研究完全自愿，
          您可以随时退出，且不需要说明理由。
        </p>
      </header>

      {/* ── 上线前检查提示 ─────────────────────────────────── */}
      <Card tone="champagne" className="mt-7">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
          <div>
            <p className="text-[1rem] font-semibold text-champagne-800">
              本页仍有 {pending.length} 项信息待研究团队补充确认
            </p>
            <p className="mt-1.5 text-[0.92rem] leading-relaxed text-champagne-800">
              以下标注为
              <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-[0.85rem]">
                [待填写：…]
              </code>
              的内容尚未由研究团队确定，本站<strong className="font-semibold">未作任何编造</strong>。
              正式上线前必须由研究团队补充并确认完整隐私告知内容。
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-10 space-y-9">
        {/* 研究目的 */}
        <Section id="purpose" icon={FileText} index="01" title="研究目的">
          <p>
            本研究是一项大学生创新创业训练计划科研项目，旨在了解人们对 AI 养老监测系统不同
            信息共享与监测配置的偏好，以及对安全、隐私和老人自主性的感受。
          </p>
          <p>
            研究结果仅用于学术研究与学术报告，不用于任何商业用途，也不会用于评价任何个人或机构。
          </p>
          <div className="flex flex-col gap-3">
            <Todo field={RESEARCH_INSTITUTION} />
            <Todo field={RESEARCH_LEAD} />
          </div>
        </Section>

        {/* 参与方式 */}
        <Section id="participation" icon={UserCog} index="02" title="参与方式">
          <p>
            参与方式为在线填写问卷。问卷包括：知情同意与身份信息、统一情景与理解检查、
            配置选择、对不同配置的感受评价，以及总体评价。
          </p>
          <p>
            身份信息仅收集年龄段、答题身份、对 AI 养老监测设备的了解程度、照护老人经历。
            <strong className="font-semibold text-forest-800">
              不收集姓名、身份证号、联系方式、住址或任何可直接识别个人身份的信息。
            </strong>
          </p>
          <Todo field={ESTIMATED_DURATION} />
        </Section>

        {/* 数据收集范围 */}
        <Section id="data-scope" icon={Database} index="03" title="数据收集范围">
          <p>本研究收集的数据仅包括：</p>
          <ul className="space-y-2">
            {[
              '您对两种系统配置的选择结果，以及完成每道题所用的时间',
              '您对不同配置在安全感、隐私担忧、自主感和采纳意愿上的评分',
              '理解检查题的首次作答结果（用于检验情景说明是否清晰）',
              '您是否打开过研究情景模拟，以及停留时长（不记录任何影像）',
              '上述身份信息（年龄段、答题身份等）',
              '您对开放性问题的文字回答（可跳过）',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <Card tone="sage" className="mt-4">
            <p className="flex items-start gap-2.5 text-[0.95rem] leading-8 text-sage-700">
              <Info className="mt-1.5 h-5 w-5 shrink-0 text-forest-700" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-forest-800">
                  网站中的 AI 监测属于模拟，不会开启您的摄像头，不会进行真实养老监控。
                </strong>
                模拟素材为研究团队提供的预设内容，不涉及任何真实参与者或真实老人的影像与活动数据。
              </span>
            </p>
          </Card>
        </Section>

        {/* 数据使用目的 */}
        <Section id="data-use" icon={FileText} index="04" title="数据使用目的">
          <p>
            数据仅用于本研究的统计分析，包括估计三个系统属性对选择偏好的影响、
            检验属性与感受评分之间的关系，以及分析采纳意愿。
          </p>
          <p>
            所有结果以<strong className="font-semibold text-forest-800">汇总形式</strong>报告，
            不呈现任何可识别个人的信息。按答题身份分组报告时，也不会公开任何单个参与者的回答。
          </p>
        </Section>

        {/* 保存期限与访问权限 */}
        <Section id="retention" icon={LockKeyhole} index="05" title="数据保存期限与访问权限">
          <div className="flex flex-col gap-3">
            <Todo field={DATA_RETENTION} />
            <Todo field={DATA_ACCESS_SCOPE} />
          </div>
          <p className="pt-2">
            数据以匿名编号（participant_id）保存。
            <strong className="font-semibold text-forest-800">
              匿名的问卷参与者不能查看他人的任何回答。
            </strong>
            数据访问受权限控制，只有经研究团队明确授权的成员可以访问原始数据。
          </p>
        </Section>

        {/* 退出规则 */}
        <Section id="withdrawal" icon={LogOut} index="06" title="退出规则">
          <p>
            您可以在任何时候关闭页面退出，无需说明理由，也不会受到任何不利影响。
            未提交的填写内容仅保存在您自己的浏览器中，不会被上传。
          </p>
          <p>
            如需撤回已提交的问卷或申请删除数据，可通过以下方式联系研究团队。
            为保护匿名性，我们无法通过姓名定位您的问卷，请尽量提供提交时间等信息以便处理。
          </p>
          <Todo field={WITHDRAWAL_PROCEDURE} />
        </Section>

        {/* 研究联系人 */}
        <Section id="contact" icon={CircleHelp} index="07" title="研究联系人">
          <div className="flex flex-col gap-3">
            <Todo field={RESEARCH_CONTACT} />
            <Todo field={RESEARCH_CONTACT_EMAIL} />
            <Todo field={ETHICS_APPROVAL} />
          </div>
          <p className="pt-2">
            如对本研究有任何疑问，或希望了解研究结果，欢迎联系研究团队。
          </p>
        </Section>

        {/* 风险说明 */}
        <Section id="risks" icon={ShieldCheck} index="08" title="风险说明与您的权益">
          <p>本研究为问卷填写，预期风险极低，但仍请您注意：</p>
          <ul className="space-y-2">
            {[
              '问卷涉及隐私与照护话题，若引起不适，您可以随时跳过或退出。',
              '请勿在开放性问题中填写任何可识别个人身份的信息（如姓名、电话、住址）。',
              '本项目为大学生创新创业训练计划科研项目，尚未完成伦理审查前不应作为正式发放渠道。',
              '参与本研究不会获得报酬，也不会产生任何费用。',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* ── 数据模式提示 ───────────────────────────────────── */}
      <Card className="mt-10" tone={modeNotice.mode === 'demo' ? 'champagne' : 'sage'}>
        <h2 className="text-[1.05rem] font-semibold text-forest-800">当前数据保存模式</h2>
        <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
          <strong className="font-semibold text-forest-800">{modeNotice.title}</strong>
          <br />
          {modeNotice.detail}
        </p>
      </Card>

      {/* ── 行动 ───────────────────────────────────────────── */}
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/questionnaire/consent" size="lg">
          我已阅读，前往知情同意
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </ButtonLink>
        <Link
          to="/about"
          className="inline-flex min-h-13 items-center justify-center rounded-panel border border-forest-700 px-6 text-[1rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          返回研究介绍
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge tone="success">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          仅用于学术研究
        </Badge>
        <Badge tone="neutral">匿名编号保存</Badge>
        <Badge tone="neutral">可随时退出</Badge>
        <Badge tone="champagne">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          上线前须由研究团队补充并确认隐私告知内容
        </Badge>
      </div>
    </PageContainer>
  )
}
