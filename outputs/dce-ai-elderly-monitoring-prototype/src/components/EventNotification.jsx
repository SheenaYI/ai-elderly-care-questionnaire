import { BellRing, Check, ChevronRight, X } from 'lucide-react'
import { getNotificationContent } from '../data/schemes'

function EventNotification({ scheme, onViewDetails, onDismiss }) {
  const notification = getNotificationContent(scheme)

  return (
    <aside className="absolute inset-x-3 bottom-3 z-10 animate-slide-up rounded-xl border border-amber-200/70 bg-[#fffdf7] p-4 text-slate-800 shadow-modal sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[22rem]" aria-label="异常通知">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700" aria-hidden="true">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-700">异常通知已生成</p>
          <h4 className="mt-0.5 text-base font-semibold">{notification.title}</h4>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100"
          aria-label="收起通知"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        <p><span className="font-medium text-slate-800">通知对象：</span>{notification.recipients}</p>
        <p>{notification.message}</p>
      </div>

      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5">
        <p className="text-xs font-medium text-amber-700">接收者可以查看</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-5 text-amber-700">
          {notification.accessItems.map((item) => (
            <li key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" aria-hidden="true" />{item}</li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onViewDetails}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-forest-800 px-3 text-sm font-semibold text-white transition hover:bg-forest-700"
      >
        查看通知详情
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}

export default EventNotification
