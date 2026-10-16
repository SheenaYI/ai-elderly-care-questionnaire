import { ArrowLeft, BellRing, CheckCircle2, FileText, LockKeyhole, UsersRound } from 'lucide-react'
import VideoPreview from './VideoPreview'
import { getNotificationContent } from '../data/schemes'

function DetailLine({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-sage-100 py-3 last:border-0 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-sage-500">{label}</dt>
      <dd className="text-sm font-medium leading-6 text-slate-800">{value}</dd>
    </div>
  )
}

function NotificationDetails({ scheme, onBack }) {
  const notification = getNotificationContent(scheme)

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-2xl bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <div className="h-fit rounded-xl bg-amber-100 p-2.5 text-amber-700" aria-hidden="true">
              <BellRing className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">异常事件通知详情</p>
              <h3 className="mt-1 text-xl font-semibold text-forest-800">{notification.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">此页仅展示当前系统配置允许接收者查看的信息范围。</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            已发出提醒
          </span>
        </div>

        <section className="mt-6" aria-labelledby="summary-title">
          <div className="flex items-center gap-2 text-forest-800">
            <FileText className="h-5 w-5" aria-hidden="true" />
            <h4 id="summary-title" className="font-semibold">异常事件摘要</h4>
          </div>
          <dl className="mt-3 rounded-xl bg-sage-50 px-4 sm:px-5">
            <DetailLine label="事件时间" value="14:32" />
            <DetailLine label="事件类型" value="疑似跌倒" />
            <DetailLine label="系统状态" value="已发出提醒" />
            <DetailLine label="通知对象" value={notification.recipients} />
          </dl>
        </section>

        {notification.hasDetailedAccess ? (
          <>
            <section className="mt-7" aria-labelledby="activity-title">
              <div className="flex items-center gap-2 text-forest-800">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
                <h4 id="activity-title" className="font-semibold">详细活动记录</h4>
              </div>
              <ol className="mt-3 rounded-xl border border-sage-200 px-4 py-1 sm:px-5">
                {[
                  ['14:30', '正常活动'],
                  ['14:31', '活动状态变化'],
                  ['14:32', '检测到疑似跌倒'],
                ].map(([time, text], index) => (
                  <li key={time} className="flex items-center gap-3 border-b border-sage-100 py-3 last:border-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${index === 2 ? 'bg-amber-600' : 'bg-forest-500'}`} aria-hidden="true" />
                    <time className="w-12 text-sm font-medium text-sage-500">{time}</time>
                    <span className="text-sm text-slate-700">{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-7" aria-labelledby="video-title">
              <h4 id="video-title" className="font-semibold text-forest-800">相关视频片段</h4>
              <VideoPreview />
            </section>
          </>
        ) : (
          <section className="mt-7 rounded-xl bg-amber-50 p-4 sm:p-5" aria-labelledby="privacy-title">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2 text-amber-700" aria-hidden="true">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h4 id="privacy-title" className="font-semibold text-amber-700">当前配置仅共享摘要信息</h4>
                <p className="mt-1.5 text-sm leading-6 text-amber-700">
                  详细活动记录和事件视频不向接收者开放。
                </p>
              </div>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-forest-700 px-4 text-sm font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回监测画面
        </button>
      </div>
    </div>
  )
}

export default NotificationDetails
