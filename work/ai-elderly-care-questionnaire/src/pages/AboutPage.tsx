import {
  ArrowRight,
  BookOpen,
  Compass,
  Eye,
  GitCompareArrows,
  HeartHandshake,
  Layers,
  MonitorPlay,
  ShieldCheck,
} from 'lucide-react'
import PageContainer from '@/components/layout/PageContainer'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { ATTRIBUTE_DEFINITIONS, UNIFIED_PREMISES } from '@/data/profiles'
import { SCALE_ITEMS } from '@/data/scales'
import { CONSTRUCTS } from '@/data/scales'

/**
 * 页面三：研究介绍
 *
 * ⚠️ 严格约束：不得虚构研究结果；不得提前展示研究假设的预期方向，
 *    避免影响正式受访者的作答。因此本页只陈述"测量什么"与"如何测量"，
 *    不陈述"预期发现什么"。预设假设 H1–H3 仅存在于内部文档
 *    （docs/RESEARCH_NOTES.md），不出现在任何参与者可见页面。
 */

const RESEARCH_FLOW = [
  { icon: BookOpen, title: '了解研究', detail: '阅读研究目的与数据使用说明' },
  { icon: Compass, title: '阅读情景', detail: '理解统一情景与三个实验属性' },
  { icon: GitCompareArrows, title: '比较配置', detail: '在多个配置之间做出选择' },
  { icon: HeartHandshake, title: '评价感受', detail: '对不同配置评价安全感、隐私担忧、自主感与采纳意愿' },
  { icon: ShieldCheck, title: '完成问卷', detail: '确认必答题完整后提交' },
] as const

const METHOD_STEPS = [
  {
    icon: GitCompareArrows,
    title: '离散选择实验（DCE）',
    detail:
      '每次同时呈现两个系统配置，请参与者选择更愿意长期采用的一个。三个实验属性被系统地组合与配对，从选择行为中估计各属性对偏好的影响。',
  },
  {
    icon: Layers,
    title: '系统配置感知评价',
    detail:
      '随机呈现若干完整配置，请参与者就每个配置分别评价安全感、隐私担忧与自主感。',
  },
  {
    icon: HeartHandshake,
    title: '采纳意愿分析',
    detail:
      '测量参与者对 AI 养老监测系统的整体采纳意愿，以及最担心的问题与开放性建议。',
  },
] as const

export default function AboutPage() {
  return (
    <PageContainer size="wide">
      {/* ── 标题 ───────────────────────────────────────────── */}
      <header className="border-b border-sage-200 pb-9">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-sage-600">
          03 研究介绍
        </p>
        <h1 className="mt-4 max-w-3xl text-[1.85rem] font-semibold leading-[1.28] text-forest-800 sm:text-[2.4rem]">
          在技术与尊严之间，寻找更好的答案
        </h1>
        <p className="mt-5 max-w-2xl text-[1.08rem] leading-9 text-sage-700">
          本研究关注 AI 养老监测系统中的信息共享与监测方式选择，
          以及这些选择与安全感、隐私担忧、自主感和采纳意愿之间的关系。
        </p>
      </header>

      {/* ── 01 研究背景 ────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-bg-title">
        <h2 id="about-bg-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">01</span>{' '}
          研究背景
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="text-[1rem] leading-8 text-sage-700">
              人口老龄化背景下，AI 技术正在进入居家养老场景。智能监测有助于识别异常风险，
              例如疑似跌倒、长时间异常静止等，并在紧急情况下向授权人员发出提醒。
            </p>
          </Card>
          <Card>
            <p className="text-[1rem] leading-8 text-sage-700">
              但同时也可能带来隐私暴露、信息共享范围扩大和自主性受限等问题。
              如何在获得安全照护的同时保留个人边界，是技术落地时必须面对的问题。
            </p>
          </Card>
        </div>
      </section>

      {/* ── 02 研究问题 ────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-q-title">
        <h2 id="about-q-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">02</span>{' '}
          研究问题
        </h2>
        <Card tone="forest" className="mt-4">
          <p className="text-[1.15rem] font-semibold leading-9 sm:text-[1.3rem]">
            当安全保障与个人隐私发生权衡时，人们更倾向于怎样的系统配置？
          </p>
        </Card>
      </section>

      {/* ── 03 三个研究维度 ────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-dims-title">
        <h2 id="about-dims-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">03</span>{' '}
          三个研究维度
        </h2>
        <p className="mt-3 max-w-3xl text-[0.98rem] leading-8 text-sage-700">
          以下三个维度会请参与者针对每一个被评价的配置分别作答。
          <strong className="font-semibold text-forest-800">
            隐私担忧的得分越高，表示担忧越强
          </strong>
          ，不会转换为"隐私满意度"。
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {CONSTRUCTS.filter((c) => c.key !== 'intention').map((construct) => (
            <Card key={construct.key}>
              <p className="text-[1.1rem] font-semibold text-forest-800">{construct.title}</p>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-sage-600">
                {construct.direction}
              </p>
              <ul className="mt-3 space-y-2">
                {construct.items.map((itemId) => {
                  const item = SCALE_ITEMS.find((i) => i.id === itemId)
                  return (
                    <li key={itemId} className="text-[0.88rem] leading-relaxed text-sage-700">
                      <span className="font-mono text-[0.78rem] text-sage-500">{itemId}</span>{' '}
                      {item?.text}
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 04 三个系统属性 ────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-attrs-title">
        <h2 id="about-attrs-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">04</span>{' '}
          三个系统属性
        </h2>
        <p className="mt-3 max-w-3xl text-[0.98rem] leading-8 text-sage-700">
          研究中的方案只在以下三个属性上不同，每个属性有两个水平。所有方案的其他方面完全一致。
        </p>

        <div className="mt-5 space-y-4">
          {ATTRIBUTE_DEFINITIONS.map((definition, index) => (
            <Card key={definition.key}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2.5 text-[1.1rem] font-semibold text-forest-800">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-panel bg-forest-50 text-forest-700"
                    aria-hidden="true"
                  >
                    {[<Eye key="e" className="h-4 w-4" />, <ShieldCheck key="s" className="h-4 w-4" />, <MonitorPlay key="m" className="h-4 w-4" />][index]}
                  </span>
                  {definition.title}
                </h3>
                <Badge tone="neutral">{definition.researchTitle}</Badge>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {([0, 1] as const).map((level) => {
                  const value = definition.levels[level]
                  return (
                    <div key={level} className="rounded-panel bg-sage-50 px-4 py-3.5">
                      <p className="font-mono text-[0.75rem] uppercase tracking-wider text-sage-600">
                        水平 {level}
                      </p>
                      <p className="mt-1 text-[1rem] font-semibold text-forest-900">{value.label}</p>
                      <p className="mt-1.5 text-[0.88rem] leading-relaxed text-sage-700">
                        {value.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>

        <Card tone="champagne" className="mt-5">
          <h3 className="text-[1rem] font-semibold text-champagne-800">统一前提（务必理解）</h3>
          <p className="mt-2 text-[0.95rem] leading-8 text-champagne-800">
            {UNIFIED_PREMISES.sharedCapability}
          </p>
          <ul className="mt-3 space-y-2">
            {UNIFIED_PREMISES.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.9rem] leading-relaxed text-champagne-800">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-champagne-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ── 05 研究方法 ────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-method-title">
        <h2 id="about-method-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">05</span>{' '}
          研究方法
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {METHOD_STEPS.map((step) => (
            <Card key={step.title} className="flex flex-col">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-panel bg-sage-100 text-forest-700"
                aria-hidden="true"
              >
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3.5 text-[1.05rem] font-semibold text-forest-800">{step.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-sage-700">{step.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 06 研究流程 ────────────────────────────────────── */}
      <section className="mt-10" aria-labelledby="about-flow-title">
        <h2 id="about-flow-title" className="text-[1.45rem] font-semibold text-forest-800">
          <span className="font-mono text-[1rem] text-sage-500">06</span>{' '}
          研究流程
        </h2>
        <ol className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {RESEARCH_FLOW.map((step, index) => (
            <li key={step.title} className="flex flex-1 items-center gap-3 lg:flex-col lg:items-start">
              <div className="w-full rounded-surface border border-sage-200 bg-white p-4 shadow-card">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-panel bg-forest-50 text-forest-700" aria-hidden="true">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-[0.75rem] text-sage-500">0{index + 1}</span>
                </div>
                <p className="mt-2.5 text-[0.98rem] font-semibold text-forest-800">{step.title}</p>
                <p className="mt-1 text-[0.85rem] leading-relaxed text-sage-700">{step.detail}</p>
              </div>
              {index < RESEARCH_FLOW.length - 1 && (
                <ArrowRight
                  className="hidden h-4 w-4 shrink-0 text-sage-400 lg:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── 免责与行动 ─────────────────────────────────────── */}
      <Card tone="sage" className="mt-10">
        <h2 className="text-[1.05rem] font-semibold text-forest-800">关于本页的说明</h2>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-sage-700">
          本页仅介绍研究的目的、测量内容与方法，不展示任何研究结果，
          也不提示研究假设的预期方向——以避免影响参与者的真实作答。
          本网站中的 AI 监测为研究情景模拟，不会开启摄像头，不进行真实养老监控。
        </p>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/questionnaire/consent" size="lg">
          开始参与研究
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </ButtonLink>
        <ButtonLink to="/privacy" size="lg" variant="secondary">
          阅读隐私与知情同意
        </ButtonLink>
      </div>
    </PageContainer>
  )
}
