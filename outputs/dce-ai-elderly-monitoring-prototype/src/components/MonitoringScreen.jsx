import {
  Activity,
  BellRing,
  CircleAlert,
  CircleCheck,
  Clock3,
  House,
  PlayCircle,
  ShieldCheck,
  UserRound,
  Wifi,
} from 'lucide-react'
import { getMonitoringCopy } from '../data/schemes'

function StatusPill({ icon: Icon, label, tone = 'success' }) {
  const tones = {
    success: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/25',
    alert: 'bg-rose-300/10 text-rose-100 ring-rose-200/30',
    neutral: 'bg-white/8 text-emerald-50 ring-white/15',
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function MonitoringScreen({
  scheme,
  stage,
  onReplay,
  onTriggerEvent,
  onOpenSavedNotification,
}) {
  const monitoringCopy = getMonitoringCopy(scheme)
  const isProcessingEvent = stage === 'event'
  const hasNotification = stage === 'notification'
  const isAnomaly = stage !== 'normal'
  const primaryStatus = isProcessingEvent
    ? '检测到疑似跌倒'
    : hasNotification
      ? '异常提醒已生成'
      : '基础异常识别运行中'

  return (
    <section className="overflow-hidden rounded-2xl bg-forest-900 text-white shadow-modal" aria-label="AI养老监测运行模拟">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <span className={`relative flex h-3 w-3 ${isProcessingEvent ? 'animate-alert' : ''}`} aria-hidden="true">
            <span className={`absolute inset-0 rounded-full ${isAnomaly ? 'bg-amber-300' : 'animate-breathe bg-emerald-400'}`} />
          </span>
          <div>
            <p className="text-xs text-emerald-100/70">居家照护 · 模拟监测画面</p>
            <h3 className="mt-0.5 text-sm font-semibold sm:text-base">{primaryStatus}</h3>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill icon={Wifi} label="设备连接正常" tone="neutral" />
          <StatusPill icon={ShieldCheck} label="预设模拟" tone="neutral" />
        </div>
      </div>

      <div className="monitor-grid relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.8fr)]">
        <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-emerald-100/15 bg-[#17463a] p-4 sm:min-h-[325px]">
          <div className="scene-scanline absolute inset-x-0 top-0 h-12 animate-scan" aria-hidden="true" />
          <div className="relative flex items-center justify-between text-xs text-emerald-50/75">
            <span className="inline-flex items-center gap-1.5"><House className="h-3.5 w-3.5" />客厅活动区域</span>
            <span>CAM 01 · 14:30</span>
          </div>

          <div className="relative mx-auto mt-7 h-44 max-w-md rounded-lg border border-emerald-100/20 bg-[#1e5547] shadow-inner sm:mt-10 sm:h-52">
            <div className="absolute left-[11%] top-[13%] h-16 w-20 rounded-sm border border-emerald-100/25 bg-[#315f50]">
              <div className="h-full w-1/2 border-r border-emerald-100/20" />
            </div>
            <div className="absolute bottom-[11%] left-[8%] h-10 w-28 rounded-t-xl border border-emerald-100/15 bg-[#2f6a59]" />
            <div className="absolute bottom-[11%] right-[10%] h-11 w-9 rounded-t-md border border-emerald-100/15 bg-[#346e5e]" />
            <div className="absolute bottom-[11%] left-[35%] h-1 w-[38%] bg-emerald-100/20" />

            <div
              className={`absolute bottom-[18%] left-[55%] flex -translate-x-1/2 flex-col items-center transition-all duration-500 ${
                isAnomaly ? 'translate-y-5 rotate-90' : ''
              }`}
            >
              <div className={`rounded-full p-2 ${isAnomaly ? 'bg-amber-300/20 text-amber-100' : 'bg-emerald-200/15 text-emerald-100'}`}>
                <UserRound className="h-8 w-8" aria-label="老人活动轮廓" />
              </div>
              {!isAnomaly && <span className="mt-1 text-[10px] text-emerald-50/80">正常活动</span>}
            </div>

            {isAnomaly && (
              <div className={`absolute inset-0 rounded-lg bg-rose-500/10 ring-1 ring-inset ring-rose-200/30 ${isProcessingEvent ? 'animate-alert' : ''}`} aria-hidden="true" />
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-lg bg-[#11372f]/75 px-3 py-2 text-xs text-emerald-50/75 backdrop-blur">
            <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />行为状态识别</span>
            <span>{isAnomaly ? '活动状态异常' : '正常'}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl border p-4 ${isAnomaly ? 'border-rose-200/30 bg-rose-400/10' : 'border-emerald-100/15 bg-white/[0.06]'}`}>
            <div className="flex items-start gap-3">
              {isAnomaly ? (
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" aria-hidden="true" />
              ) : (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-semibold">{isAnomaly ? '检测到疑似跌倒' : '未检测到异常'}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/70">
                  {isProcessingEvent
                    ? monitoringCopy.eventDescription
                    : hasNotification
                      ? '已生成异常事件记录并发出提醒。'
                      : '系统正在持续进行基础异常识别。'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100/15 bg-white/[0.06] p-4">
            <p className="text-xs font-medium tracking-wide text-emerald-100/65">详细监测状态</p>
            <p className="mt-2 text-sm font-semibold text-white">{isAnomaly ? monitoringCopy.eventStatus : monitoringCopy.normalStatus}</p>
            <p className="mt-1 text-xs leading-5 text-emerald-50/70">
              {isAnomaly ? '这是预设异常事件后的模拟系统状态。' : monitoringCopy.normalDescription}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100/15 bg-white/[0.06] p-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-emerald-100/65">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              模拟时间线
            </div>
            <ol className="mt-3 space-y-3 text-xs">
              <li className="flex gap-3"><time className="w-9 text-emerald-100/55">14:30</time><span className="text-emerald-50">系统运行正常</span></li>
              <li className={`flex gap-3 ${stage === 'normal' ? 'text-emerald-100/30' : 'text-emerald-50'}`}><time className="w-9 text-emerald-100/55">14:32</time><span>{stage === 'normal' ? '等待模拟异常事件' : '检测到疑似跌倒'}</span></li>
              <li className={`flex gap-3 ${hasNotification ? 'text-emerald-50' : 'text-emerald-100/30'}`}><time className="w-9 text-emerald-100/55">14:33</time><span>{hasNotification ? '异常通知已生成' : '等待发送异常通知'}</span></li>
            </ol>
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs leading-5 text-emerald-50/65">模拟事件：疑似跌倒 · 所有方案使用相同时间与风险描述</p>
        <div className="flex flex-wrap gap-2">
          {hasNotification && (
            <button
              type="button"
              onClick={onOpenSavedNotification}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-100/10 px-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-100/20"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              查看通知详情
            </button>
          )}
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-semibold text-forest-800 transition hover:bg-emerald-50"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            重新播放
          </button>
          <button
            type="button"
            onClick={onTriggerEvent}
            disabled={stage !== 'normal'}
            className="inline-flex min-h-10 items-center rounded-lg border border-emerald-100/25 px-3.5 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-50/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            立即模拟异常事件
          </button>
        </div>
      </footer>
    </section>
  )
}

export default MonitoringScreen
