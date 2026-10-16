import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, RotateCcw, X } from 'lucide-react'
import EventNotification from './EventNotification'
import MonitoringScreen from './MonitoringScreen'
import NotificationDetails from './NotificationDetails'

function SimulationModal({ scheme, onClose }) {
  const [stage, setStage] = useState('normal')
  const [view, setView] = useState('monitoring')
  const [showNotification, setShowNotification] = useState(false)
  const dialogRef = useRef(null)
  const timerIds = useRef([])

  const clearSimulationTimers = useCallback(() => {
    timerIds.current.forEach((timerId) => window.clearTimeout(timerId))
    timerIds.current = []
  }, [])

  const scheduleNotification = useCallback(() => {
    const notificationTimer = window.setTimeout(() => {
      setStage('notification')
      setShowNotification(true)
    }, 1000)
    timerIds.current.push(notificationTimer)
  }, [])

  const startSimulation = useCallback(() => {
    clearSimulationTimers()
    setStage('normal')
    setView('monitoring')
    setShowNotification(false)

    const eventTimer = window.setTimeout(() => {
      setStage('event')
      scheduleNotification()
    }, 2000)
    timerIds.current.push(eventTimer)
  }, [clearSimulationTimers, scheduleNotification])

  const triggerEvent = useCallback(() => {
    if (stage !== 'normal') return
    clearSimulationTimers()
    setStage('event')
    setShowNotification(false)
    scheduleNotification()
  }, [clearSimulationTimers, scheduleNotification, stage])

  useEffect(() => {
    startSimulation()
    return clearSimulationTimers
  }, [clearSimulationTimers, startSimulation])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const activeElement = document.activeElement
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => {
      dialogRef.current?.querySelector('[data-autofocus]')?.focus()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
      activeElement?.focus?.()
    }
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onClose()
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusableElements = dialogRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const focusable = Array.from(focusableElements)
    if (!focusable.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const isDetailView = view === 'details'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-[#f7f7f2] shadow-modal animate-slide-up sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-title"
        onKeyDown={handleKeyDown}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-sage-200 bg-[#f7f7f2]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="min-w-0">
            <p className="text-sm font-medium text-sage-500">预设模拟情景</p>
            <h2 id="simulation-title" className="truncate text-base font-semibold text-forest-800 sm:text-lg">
              AI养老监测运行模拟｜{scheme.label}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isDetailView && (
              <button
                type="button"
                onClick={startSimulation}
                className="hidden min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-forest-800 transition hover:bg-forest-50 sm:inline-flex"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                重新播放
              </button>
            )}
            {isDetailView && (
              <button
                type="button"
                onClick={() => setView('monitoring')}
                className="hidden min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-forest-800 transition hover:bg-forest-50 sm:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                返回监测画面
              </button>
            )}
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sage-700 transition hover:bg-sage-100"
              aria-label="退出模拟并返回问卷"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {isDetailView ? (
          <NotificationDetails
            scheme={scheme}
            onBack={() => {
              setView('monitoring')
              setShowNotification(false)
            }}
          />
        ) : (
          <div className="p-4 sm:p-6">
            <div className="relative">
              <MonitoringScreen
                scheme={scheme}
                stage={stage}
                onReplay={startSimulation}
                onTriggerEvent={triggerEvent}
                onOpenSavedNotification={() => setView('details')}
              />
              {showNotification && stage === 'notification' && (
                <EventNotification
                  scheme={scheme}
                  onViewDetails={() => setView('details')}
                  onDismiss={() => setShowNotification(false)}
                />
              )}
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-sage-500">
              此过程为研究用预设模拟，不代表真实AI识别、报警或视频记录结果。
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default SimulationModal
