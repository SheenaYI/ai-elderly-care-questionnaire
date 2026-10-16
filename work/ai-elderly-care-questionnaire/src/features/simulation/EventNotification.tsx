import { BellRing, Check, ChevronRight, X } from 'lucide-react'
import type { ProfileId } from '@/types'
import { getNotificationContent } from './simulationScript'

/**
 * 异常通知卡片（浮层）。
 *
 * 通知对象由 X2 决定，可查看的信息范围由 X1 决定。
 * 事件类型、时间与风险描述在所有配置下一致。
 */
export default function EventNotification({
  profileId,
  onViewDetails,
  onDismiss,
}: {
  profileId: ProfileId
  onViewDetails: () => void
  onDismiss: () => void
}) {
  const notification = getNotificationContent(profileId)

  return (
    <aside
      className="absolute inset-x-3 bottom-3 z-10 rounded-panel border border-champagne-200 bg-champagne-50 p-4 text-forest-900 shadow-modal animate-slide-up sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[23rem]"
      aria-label="异常通知"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-control bg-champagne-100 p-2 text-champagne-800" aria-hidden="true">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-medium text-champagne-800">异常通知已生成</p>
          <p className="mt-0.5 text-[1rem] font-semibold">{notification.title}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 inline-flex h-9 w-9 items-center justify-center rounded-control text-sage-700 transition hover:bg-white/70"
          aria-label="收起通知"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 space-y-2 text-[0.88rem] leading-relaxed text-forest-900/85">
        <p>
          <span className="font-medium text-forest-900">通知对象：</span>
          {notification.recipientLabel}
        </p>
        <p>{notification.message}</p>
      </div>

      <div className="mt-3 rounded-control bg-white/70 px-3 py-2.5">
        <p className="text-[0.75rem] font-medium text-champagne-800">接收者可以查看</p>
        <ul className="mt-1.5 space-y-1">
          {notification.accessItems.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1.5 text-[0.8rem] leading-snug text-champagne-800"
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onViewDetails}
        className="mt-3.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-panel bg-forest-700 px-3 text-[0.9rem] font-semibold text-white transition hover:bg-forest-600"
      >
        查看通知详情
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
