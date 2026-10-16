import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Info, RotateCcw, X } from 'lucide-react'
import type { ProfileId, SimulationEventType, TaskId } from '@/types'
import EventNotification from './EventNotification'
import MonitoringScreen from './MonitoringScreen'
import NotificationDetails from './NotificationDetails'
import {
  SIMULATION_TIMING,
  type SimulationStage,
} from './simulationScript'

/**
 * 模拟监测弹窗。
 *
 * 这是 DCE 卡片与独立"情景体验"页面**共用**的组件（不重复实现两套逻辑）。
 *
 * 行为：
 *   - 打开即开始模拟：正常监测 → 检测到疑似跌倒 → 生成事件记录 → 发送通知
 *   - 也可手动"立即模拟异常事件"
 *   - 支持重播与查看通知详情
 *   - 键盘可达：Esc 关闭、初始聚焦、Tab 焦点循环
 *   - 记录埋点：open / close（含停留时长）/ view_details / replay / complete
 */

export default function SimulationModal({
  profileId,
  taskId,
  source,
  onClose,
  onEvent,
}: {
  profileId: ProfileId
  /** 若在 DCE 中打开，记录对应任务；独立体验页为 null。 */
  taskId: TaskId | null
  source: 'dce' | 'experience'
  onClose: () => void
  onEvent: (event: {
    taskId: TaskId | null
    profileId: ProfileId
    eventType: SimulationEventType
    durationMs?: number | null
    source: 'dce' | 'experience'
  }) => void
}) {
  const [stage, setStage] = useState<SimulationStage>('normal')
  const [view, setView] = useState<'monitoring' | 'details'>('monitoring')
  const [showNotification, setShowNotification] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const timerIds = useRef<number[]>([])
  const openedAtRef = useRef<number>(Date.now())
  /** 记录是否已经上报过 close，避免重复埋点。 */
  const closedRef = useRef(false)

  const clearTimers = useCallback(() => {
    timerIds.current.forEach((id) => window.clearTimeout(id))
    timerIds.current = []
  }, [])

  const scheduleNotification = useCallback(() => {
    const id = window.setTimeout(() => {
      setStage('notification')
      setShowNotification(true)
    }, SIMULATION_TIMING.notifyDelayMs)
    timerIds.current.push(id)
  }, [])

  const startSimulation = useCallback(() => {
    clearTimers()
    setStage('normal')
    setView('monitoring')
    setShowNotification(false)

    const id = window.setTimeout(() => {
      setStage('event')
      scheduleNotification()
    }, SIMULATION_TIMING.autoEventDelayMs)
    timerIds.current.push(id)
  }, [clearTimers, scheduleNotification])

  const triggerEvent = useCallback(() => {
    setStage((current) => {
      if (current !== 'normal') return current
      clearTimers()
      setShowNotification(false)
      scheduleNotification()
      return 'event'
    })
  }, [clearTimers, scheduleNotification])

  // 打开时上报 open，并开始模拟
  useEffect(() => {
    onEvent({ taskId, profileId, eventType: 'open', source })
    startSimulation()
    return clearTimers
    // 仅在挂载时执行一次：profileId/taskId/source 在弹窗生命周期内不变
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 关闭时上报 close 与停留时长
  const handleClose = useCallback(() => {
    if (!closedRef.current) {
      closedRef.current = true
      onEvent({
        taskId,
        profileId,
        eventType: 'close',
        durationMs: Date.now() - openedAtRef.current,
        source,
      })
    }
    onClose()
  }, [onClose, onEvent, profileId, source, taskId])

  // 锁定滚动 + 初始焦点 + Esc 关闭 + Tab 循环
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [handleClose])

  const isDetailView = view === 'details'

  function goToDetails() {
    setView('details')
    onEvent({ taskId, profileId, eventType: 'view_details', source })
  }

  function handleReplay() {
    onEvent({ taskId, profileId, eventType: 'replay', source })
    startSimulation()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/65 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-surface bg-cream-100 shadow-modal animate-slide-up sm:max-h-[90vh] sm:rounded-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-dialog-title"
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-sage-200 bg-cream-100/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.78rem] font-medium text-sage-700">研究情景模拟</p>
            <h2
              id="simulation-dialog-title"
              className="truncate text-[1rem] font-semibold text-forest-800 sm:text-[1.1rem]"
            >
              AI养老监测运行模拟｜{profileId}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isDetailView ? (
              <button
                type="button"
                onClick={() => {
                  setView('monitoring')
                  setShowNotification(false)
                }}
                className="hidden min-h-11 items-center gap-2 rounded-panel px-3 text-[0.9rem] font-semibold text-forest-800 transition hover:bg-forest-50 sm:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                返回监测画面
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReplay}
                className="hidden min-h-11 items-center gap-2 rounded-panel px-3 text-[0.9rem] font-semibold text-forest-800 transition hover:bg-forest-50 sm:inline-flex"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                重新模拟
              </button>
            )}
            <button
              type="button"
              data-autofocus
              onClick={handleClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-panel text-forest-800 transition hover:bg-forest-50"
              aria-label="退出模拟并返回问卷"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {isDetailView ? (
          <NotificationDetails profileId={profileId} onBack={() => setView('monitoring')} />
        ) : (
          <div className="p-4 sm:p-6">
            <div className="relative">
              <MonitoringScreen
                profileId={profileId}
                stage={stage}
                onReplay={handleReplay}
                onTriggerEvent={triggerEvent}
                onOpenDetails={goToDetails}
              />
              {showNotification && stage === 'notification' && (
                <EventNotification
                  profileId={profileId}
                  onViewDetails={goToDetails}
                  onDismiss={() => setShowNotification(false)}
                />
              )}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-panel border border-champagne-200 bg-champagne-50 px-4 py-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-champagne-800" aria-hidden="true" />
              <p className="text-[0.85rem] leading-relaxed text-champagne-800">
                此过程为研究用预设模拟，不代表真实AI识别、报警或视频记录结果。
                模拟情景不是实时AI检测，本页面不会开启摄像头，也不会收集您的影像。
                所有系统配置的基础异常识别与报警能力都相同。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
