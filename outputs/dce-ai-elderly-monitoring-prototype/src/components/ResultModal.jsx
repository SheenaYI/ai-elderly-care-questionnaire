import { useEffect, useRef } from 'react'
import { CheckCircle2, RotateCcw, X } from 'lucide-react'

function ResultModal({ scheme, onClose, onReselect, onComplete }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => dialogRef.current?.querySelector('[data-autofocus]')?.focus(), 0)

    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [onClose])

  function handleKeyDown(event) {
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = Array.from(
      dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-900/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal animate-slide-up sm:p-7" role="dialog" aria-modal="true" aria-labelledby="result-title" onKeyDown={handleKeyDown}>
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-xl bg-forest-50 p-2.5 text-forest-700" aria-hidden="true"><CheckCircle2 className="h-7 w-7" /></div>
          <button type="button" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-sage-500 transition hover:bg-sage-100" aria-label="关闭结果确认"><X className="h-5 w-5" /></button>
        </div>
        <h2 id="result-title" className="mt-5 text-2xl font-semibold tracking-tight text-forest-800">您已选择{scheme.label}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">感谢您的选择。本页面为交互原型，暂不提交真实问卷数据。</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onReselect} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-700 px-4 text-sm font-semibold text-forest-800 transition hover:bg-forest-50"><RotateCcw className="h-4 w-4" />重新选择</button>
          <button type="button" data-autofocus onClick={onComplete} className="min-h-11 rounded-xl bg-forest-800 px-4 text-sm font-semibold text-white transition hover:bg-forest-700">完成体验</button>
        </div>
      </section>
    </div>
  )
}

export default ResultModal
