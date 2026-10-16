import {
  Activity,
  BellRing,
  CheckCircle2,
  Clock3,
  House,
  PlayCircle,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wifi,
} from 'lucide-react'
import type { ProfileId } from '@/types'
import { PROFILES, getAttributeLevel } from '@/data/profiles'
import {
  SIMULATION_EVENT,
  TIMELINE_STEPS,
  getMonitoringCopy,
  getRecipients,
  type SimulationStage,
} from './simulationScript'

/**
 * 模拟监测画面（深色）。
 *
 * 技术要点：
 *   - 画面内容由当前配置 (X1, X2, X3) 派生，不硬编码任何配置差异。
 *   - 时间线、事件类型、风险描述在所有配置下**完全一致**。
 *   - 状态永远由"图标 + 文字 + 颜色"三重表达，不依赖颜色单独传达。
 *   - 动画克制，并尊重 prefers-reduced-motion（由全局 CSS 处理）。
 */

function StatusPill({
  icon: Icon,
  label,
  tone = 'neutral',
}: {
  icon: typeof Wifi
  label: string
  tone?: 'neutral' | 'active' | 'alert'
}) {
  const tones = {
    neutral: 'bg-white/[0.07] text-emerald-50 ring-white/12',
    active: 'bg-emerald-300/12 text-emerald-100 ring-emerald-300/25',
    alert: 'bg-rose-300/12 text-rose-100 ring-rose-200/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium ring-1 ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

export default function MonitoringScreen({
  profileId,
  stage,
  onReplay,
  onTriggerEvent,
  onOpenDetails,
}: {
  profileId: ProfileId
  stage: SimulationStage
  onReplay: () => void
  onTriggerEvent: () => void
  onOpenDetails: () => void
}) {
  const profile = PROFILES[profileId]
  const copy = getMonitoringCopy(profileId)
  const recipients = getRecipients(profileId)

  const isAnomaly = stage === 'event' || stage === 'notification' || stage === 'details'
  const hasNotification = stage === 'notification' || stage === 'details'

  const primaryStatus = stage === 'event'
    ? '检测到疑似跌倒'
    : hasNotification
      ? '异常提醒已生成'
      : '基础异常识别运行中'

  /** 当前已推进到的时间线节点索引。 */
  const activeStepIndex = stage === 'normal' ? 0 : stage === 'event' ? 1 : 2

  return (
    <section
      className="overflow-hidden rounded-surface bg-forest-900 text-white shadow-modal"
      aria-label="AI养老监测运行模拟画面"
    >
      {/* ── 顶部状态栏 ─────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span
              className={`absolute inset-0 rounded-full ${
                isAnomaly ? 'bg-champagne-300' : 'animate-breathe bg-emerald-400'
              }`}
            />
          </span>
          <div>
            <p className="text-[0.72rem] text-emerald-100/75">居家照护 · 研究情景模拟</p>
            <p className="mt-0.5 text-[0.95rem] font-semibold sm:text-[1.05rem]">{primaryStatus}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill icon={Wifi} label="设备连接正常" />
          <StatusPill icon={ShieldCheck} label="预设模拟，非实时AI" />
        </div>
      </div>

      <div className="monitor-grid relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(15rem,0.85fr)]">
        {/* ── 居家场景示意 ─────────────────────────────────── */}
        <div className="relative min-h-[16rem] overflow-hidden rounded-panel border border-emerald-100/15 bg-forest-800/70 p-4 sm:min-h-[20rem]">
          <div className="scene-scanline absolute inset-x-0 top-0 h-12 animate-scan" aria-hidden="true" />

          <div className="relative flex items-center justify-between text-[0.72rem] text-emerald-50/80">
            <span className="inline-flex items-center gap-1.5">
              <House className="h-3.5 w-3.5" aria-hidden="true" />
              客厅活动区域
            </span>
            <span className="font-mono">CAM 01 · {SIMULATION_EVENT.normalTime}</span>
          </div>

          {/* 简化居家平面示意（纯 CSS，不连接任何摄像头） */}
          <div className="relative mx-auto mt-7 h-40 max-w-md rounded-panel border border-emerald-100/20 bg-forest-700/60 shadow-inner sm:mt-9 sm:h-48">
            <div className="absolute left-[9%] top-[12%] h-14 w-20 rounded-sm border border-emerald-100/25 bg-forest-600/60" aria-hidden="true" />
            <div className="absolute bottom-[10%] left-[7%] h-9 w-24 rounded-t-lg border border-emerald-100/15 bg-forest-600/50" aria-hidden="true" />
            <div className="absolute bottom-[10%] right-[9%] h-10 w-8 rounded-t-md border border-emerald-100/15 bg-forest-600/50" aria-hidden="true" />

            {/* 老人位置轮廓 */}
            <div
              className={`absolute bottom-[16%] left-[56%] flex -translate-x-1/2 flex-col items-center transition-transform duration-500 ${
                isAnomaly ? 'translate-y-4 rotate-90' : ''
              }`}
            >
              <span
                className={`rounded-full p-2 ${
                  isAnomaly ? 'bg-champagne-300/25 text-champagne-100' : 'bg-emerald-200/15 text-emerald-100'
                }`}
              >
                <UserRound className="h-8 w-8" aria-label="老人活动轮廓（示意图）" />
              </span>
              {!isAnomaly && (
                <span className="mt-1 text-[0.65rem] text-emerald-50/85">正常活动</span>
              )}
            </div>

            {isAnomaly && (
              <span
                className="absolute inset-0 rounded-panel bg-rose-500/10 ring-1 ring-inset ring-rose-200/30"
                aria-hidden="true"
              />
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-panel bg-forest-900/80 px-3 py-2 text-[0.72rem] text-emerald-50/85 backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              行为状态识别
            </span>
            <span>{isAnomaly ? '活动状态异常' : '正常'}</span>
          </div>
        </div>

        {/* ── 状态与时间线 ─────────────────────────────────── */}
        <div className="space-y-3">
          <div
            className={`rounded-panel border p-4 ${
              isAnomaly ? 'border-rose-200/30 bg-rose-400/10' : 'border-emerald-100/15 bg-white/[0.06]'
            }`}
          >
            <div className="flex items-start gap-3">
              {isAnomaly ? (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              )}
              <div>
                <p className="text-[0.92rem] font-semibold">
                  {isAnomaly ? `检测到${SIMULATION_EVENT.type}` : '未检测到异常'}
                </p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-emerald-50/80">
                  {stage === 'event'
                    ? SIMULATION_EVENT.description
                    : hasNotification
                      ? '已生成异常事件记录并发出提醒。'
                      : '系统正在持续进行基础异常识别。'}
                </p>
              </div>
            </div>
          </div>

          {/* X3 决定：平时是否持续详细监测 */}
          <div className="rounded-panel border border-emerald-100/15 bg-white/[0.06] p-4">
            <p className="text-[0.72rem] font-medium tracking-wide text-emerald-100/70">
              详细监测状态
            </p>
            <p className="mt-1.5 text-[0.92rem] font-semibold text-white">
              {isAnomaly ? copy.eventStatus : copy.normalStatus}
            </p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-emerald-50/80">
              {isAnomaly
                ? copy.eventDescription
                : copy.normalDescription}
            </p>
            <p className="mt-2 border-t border-emerald-100/12 pt-2 text-[0.72rem] leading-relaxed text-emerald-100/70">
              当前配置：{getAttributeLevel('X3', profile.X3).label}
            </p>
          </div>

          {/* X2 决定：通知发送给谁 */}
          <div className="rounded-panel border border-emerald-100/15 bg-white/[0.06] p-4">
            <p className="text-[0.72rem] font-medium tracking-wide text-emerald-100/70">
              通知发送对象
            </p>
            <ul className="mt-1.5 space-y-1">
              {recipients.map((r) => (
                <li key={r} className="text-[0.85rem] text-emerald-50">
                  · {r}
                </li>
              ))}
            </ul>
          </div>

          {/* 统一时间线（所有配置一致） */}
          <div className="rounded-panel border border-emerald-100/15 bg-white/[0.06] p-4">
            <p className="flex items-center gap-2 text-[0.72rem] font-medium tracking-wide text-emerald-100/70">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              模拟时间线
            </p>
            <ol className="mt-2.5 space-y-2.5 text-[0.78rem]">
              {TIMELINE_STEPS.map((step) => {
                const reached = step.index <= activeStepIndex
                return (
                  <li key={step.time} className="flex gap-3">
                    <time className="w-10 shrink-0 font-mono text-emerald-100/70">{step.time}</time>
                    <span className={reached ? 'text-emerald-50' : 'text-emerald-100/40'}>
                      {reached ? step.activeText : step.normalText}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      {/* ── 底部操作栏 ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-[0.75rem] leading-relaxed text-emerald-50/75">
          模拟事件：{SIMULATION_EVENT.type} · 所有配置使用相同的时间与风险描述
        </p>
        <div className="flex flex-wrap gap-2">
          {hasNotification && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex min-h-11 items-center gap-2 rounded-panel bg-emerald-100/12 px-3.5 text-[0.9rem] font-semibold text-emerald-50 transition hover:bg-emerald-100/20"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              查看通知详情
            </button>
          )}
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex min-h-11 items-center gap-2 rounded-panel bg-white px-3.5 text-[0.9rem] font-semibold text-forest-800 transition hover:bg-emerald-50"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            重新模拟
          </button>
          <button
            type="button"
            onClick={onTriggerEvent}
            disabled={stage !== 'normal'}
            className="inline-flex min-h-11 items-center rounded-panel border border-emerald-100/25 px-3.5 text-[0.9rem] font-semibold text-emerald-50 transition hover:bg-emerald-50/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            立即模拟异常事件
          </button>
        </div>
      </div>
    </section>
  )
}
