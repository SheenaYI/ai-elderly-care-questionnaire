import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  Eye,
  HeartHandshake,
  Info,
  MonitorPlay,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import PageContainer from '@/components/layout/PageContainer'
import HeroOrbit from '@/components/home/HeroOrbit'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { STUDY_CODE, STUDY_TITLE } from '@/data/questionnaire'
import { ATTRIBUTE_DEFINITIONS, UNIFIED_PREMISES } from '@/data/profiles'
import { dataModeNotice } from '@/lib/config'
import { useQuestionnaire } from '@/app/store'

/**
 * 页面一：参与研究（网站首页）
 *
 * 这是最重要的页面：参与者在这里第一次理解研究目的，并决定是否开始。
 * 主按钮进入完整问卷流程。
 */

const FLOW_STEPS = [
  { icon: ScrollText, title: '阅读研究说明', detail: '了解研究目的与数据使用方式' },
  { icon: ClipboardCheck, title: '填写问卷', detail: '五个模块，可随时退出与返回' },
  { icon: MonitorPlay, title: '体验情景配置', detail: '可选，帮助理解不同配置的含义' },
  { icon: HeartHandshake, title: '提交与致谢', detail: '确认完成后提交，仅用于学术研究' },
] as const

export default function HomePage() {
  const hasDraft = useQuestionnaire((s) => s.hasRestoredDraft)
  const draft = useQuestionnaire((s) => s.draft)
  const modeNotice = dataModeNotice()

  const draftHasProgress =
    hasDraft &&
    (draft.consentStatus === 'agreed' ||
      draft.dceChoices.length > 0 ||
      draft.profileRatings.length > 0)

  return (
    <PageContainer size="wide">
      {/* ── 主视觉与主行动 ─────────────────────────────────── */}
      <section className="overflow-hidden rounded-feature border border-sage-200 bg-gradient-to-br from-cream-100 via-cream-50 to-sage-50 shadow-card">
        <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
          {/* 文案与主行动 */}
          <div className="min-w-0">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-sage-600">
              {STUDY_CODE}
            </p>

            <h1 className="mt-4 text-[2rem] font-semibold leading-[1.25] text-forest-800 sm:text-[2.5rem]">
              当 AI 走进养老生活
            </h1>

            <p className="mt-5 text-[1.15rem] leading-9 text-forest-700 sm:text-[1.3rem]">
              安全、隐私与自主性之间，
              <br className="hidden sm:block" />
              您会如何选择？
            </p>

            <div className="mt-7 space-y-3 text-[1rem] leading-8 text-sage-700">
              <p>本研究希望了解不同人群对 AI 养老监测系统信息共享与监测方式的偏好。</p>
              <p>通过模拟不同系统配置，探索人们在安全保障、个人隐私和自主生活之间的权衡。</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink to="/questionnaire/consent" size="lg" className="sm:min-w-56">
                开始参与研究
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ButtonLink>

              <Link
                to="/experience"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-panel border border-forest-700 bg-white/70 px-6 text-[1rem] font-semibold text-forest-800 transition hover:bg-white"
              >
                <MonitorPlay className="h-5 w-5" aria-hidden="true" />
                先看看情景体验
              </Link>
            </div>
          </div>

          {/* 主视觉：居家养老与三个研究维度 */}
          <div className="flex min-w-0 justify-center lg:justify-end">
            <HeroOrbit />
          </div>
        </div>

        {/* 参与原则摘要 */}
        <div className="grid gap-px border-t border-sage-200 bg-sage-200 sm:grid-cols-3">
          {[
            { icon: Clock3, label: '预计填写时间', value: '由研究团队试填后确认' },
            { icon: ShieldCheck, label: '研究用途', value: '仅用于学术研究' },
            { icon: RotateCcw, label: '参与原则', value: '自愿参与，可随时退出' },
          ].map((item) => (
            <div key={item.label} className="bg-cream-50 px-5 py-4">
              <p className="flex items-center gap-2 text-[0.8rem] font-medium text-sage-700">
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </p>
              <p className="mt-1.5 text-[0.95rem] font-semibold leading-relaxed text-forest-800">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 进度恢复提示 ───────────────────────────────────── */}
      {draftHasProgress && (
        <Card tone="champagne" className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
              <div>
                <p className="text-[1rem] font-semibold text-champagne-800">
                  检测到您有一份未完成的问卷
                </p>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-champagne-800/90">
                  已记录：DCE 选择题 {draft.dceChoices.length} / 6 道，配置评价{' '}
                  {draft.profileRatings.length} / 4 个。
                  继续填写将沿用您原来的题目顺序与方案位置，不会重新随机。
                </p>
              </div>
            </div>
            <ButtonLink to="/questionnaire/consent" className="shrink-0">
              继续填写
            </ButtonLink>
          </div>
        </Card>
      )}

      {/* ── 数据模式提示（Demo / 真实提交） ─────────────────── */}
      {modeNotice.mode === 'demo' && (
        <Card tone="white" className="mt-6 border-champagne-200">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-champagne-700" aria-hidden="true" />
            <div>
              <p className="text-[1rem] font-semibold text-forest-800">{modeNotice.title}</p>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-sage-700">{modeNotice.detail}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── 研究说明 ───────────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="home-about-title">
        <h2 id="home-about-title" className="text-[1.5rem] font-semibold text-forest-800">
          这个研究在做什么
        </h2>
        <p className="mt-3 max-w-3xl text-[1.05rem] leading-8 text-sage-700">
          我们会请您比较多种 AI 养老监测系统的配置方案。所有方案都具备
          <strong className="font-semibold text-forest-800">相同的基础异常识别与报警能力</strong>
          ，差别只在于三个方面。
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {ATTRIBUTE_DEFINITIONS.map((definition, index) => {
            const Icon = [Eye, ShieldCheck, MonitorPlay][index] ?? Eye
            return (
              <Card key={definition.key} className="flex flex-col">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-panel bg-forest-50 text-forest-700"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3.5 text-[1.08rem] font-semibold text-forest-800">
                  {definition.title}
                </h3>
                <p className="mt-1 text-[0.82rem] font-medium text-sage-600">
                  {definition.researchTitle}
                </p>
                <p className="mt-2.5 text-[0.92rem] leading-relaxed text-sage-700">
                  {definition.summary}
                </p>
              </Card>
            )
          })}
        </div>

        <Card tone="sage" className="mt-5">
          <h3 className="text-[1rem] font-semibold text-forest-800">统一前提</h3>
          <p className="mt-2 text-[0.95rem] leading-8 text-sage-700">
            {UNIFIED_PREMISES.sharedCapability}
          </p>
          <ul className="mt-3 space-y-2">
            {UNIFIED_PREMISES.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.92rem] leading-relaxed text-sage-700">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ── 参与流程 ───────────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="home-flow-title">
        <h2 id="home-flow-title" className="text-[1.5rem] font-semibold text-forest-800">
          参与流程
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-surface border border-sage-200 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-sage-100 text-forest-700" aria-hidden="true">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-[0.78rem] tabular-nums text-sage-500">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-3.5 text-[1rem] font-semibold text-forest-800">{step.title}</h3>
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-sage-700">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 研究与伦理声明 ─────────────────────────────────── */}
      <section className="mt-12" aria-labelledby="home-notice-title">
        <h2 id="home-notice-title" className="text-[1.5rem] font-semibold text-forest-800">
          重要声明
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Card tone="champagne">
            <h3 className="flex items-center gap-2 text-[1rem] font-semibold text-champagne-800">
              <Info className="h-5 w-5" aria-hidden="true" />
              本网站的模拟不是真实监测
            </h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-champagne-800">
              网站中的 AI 监测全部为研究情景模拟，不会开启您的摄像头，不会进行真实养老监控，
              也不会收集您的影像。模拟素材为预设内容，不代表真实 AI 识别、报警速度或准确率。
            </p>
          </Card>

          <Card>
            <h3 className="flex items-center gap-2 text-[1rem] font-semibold text-forest-800">
              <ShieldCheck className="h-5 w-5 text-forest-700" aria-hidden="true" />
              数据与隐私
            </h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-sage-700">
              问卷不收集姓名、身份证号、联系方式或真实监控视频。所有回答以匿名编号保存，
              仅用于本研究的统计分析。
            </p>
            <Link
              to="/privacy"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[0.92rem] font-semibold text-forest-700 underline decoration-sage-300 underline-offset-4 hover:decoration-forest-700"
            >
              阅读完整的隐私与知情同意说明
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone="success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            仅用于学术研究
          </Badge>
          <Badge tone="neutral">匿名填写</Badge>
          <Badge tone="neutral">可随时退出</Badge>
          <Badge tone="champagne">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            {STUDY_TITLE}
          </Badge>
        </div>
      </section>
    </PageContainer>
  )
}
