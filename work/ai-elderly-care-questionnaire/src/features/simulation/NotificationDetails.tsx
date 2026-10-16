import { ArrowLeft, BellRing, CheckCircle2, FileText, LockKeyhole, UsersRound } from 'lucide-react'
import type { ProfileId } from '@/types'
import VideoPreview from './VideoPreview'
import { SIMULATION_EVENT, getNotificationContent } from './simulationScript'

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-sage-100 py-3 last:border-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-[0.88rem] font-medium text-sage-700">{label}</dt>
      <dd className="text-[0.92rem] font-medium leading-relaxed text-forest-900">{value}</dd>
    </div>
  )
}

/**
 * 通知详情。
 *
 * 这是体现 X1（共享层级）差异的关键界面：
 *   X1 = 0（仅摘要） → 只显示异常事件摘要，并说明详细记录与视频不向接收者开放。
 *   X1 = 1（详细数据）→ 额外显示详细活动记录与视频片段。
 *
 * X2（共享对象）通过"通知对象"一行体现。
 * X3（详细监测方式）通过"详细监测状态"一行体现。
 */
export default function NotificationDetails({
  profileId,
  onBack,
}: {
  profileId: ProfileId
  onBack: () => void
}) {
  const notification = getNotificationContent(profileId)

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-surface bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <span className="h-fit rounded-panel bg-champagne-100 p-2.5 text-champagne-800" aria-hidden="true">
              <BellRing className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[0.85rem] font-medium text-champagne-800">异常事件通知详情</p>
              <h3 className="mt-1 text-[1.3rem] font-semibold text-forest-800">{notification.title}</h3>
              <p className="mt-2 text-[0.9rem] leading-relaxed text-sage-700">
                本页仅展示当前系统配置允许接收者查看的信息范围。
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-forest-50 px-3 py-1.5 text-[0.8rem] font-semibold text-forest-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            已发出提醒
          </span>
        </div>

        {/* 异常事件摘要：所有配置都会生成 */}
        <section className="mt-6" aria-labelledby="sim-summary-title">
          <h4 id="sim-summary-title" className="flex items-center gap-2 font-semibold text-forest-800">
            <FileText className="h-5 w-5" aria-hidden="true" />
            异常事件摘要
          </h4>
          <dl className="mt-3 rounded-panel bg-sage-50 px-4 sm:px-5">
            <DetailLine label="事件时间" value={SIMULATION_EVENT.time} />
            <DetailLine label="事件类型" value={SIMULATION_EVENT.type} />
            <DetailLine label="系统状态" value="已发出提醒" />
            <DetailLine label="通知对象" value={notification.recipientLabel} />
          </dl>
          <p className="mt-2.5 text-[0.82rem] leading-relaxed text-sage-700">
            无论配置如何，系统都会生成事件摘要并发出提醒；所有配置的基础异常识别与报警能力相同。
          </p>
        </section>

        {notification.hasDetailedAccess ? (
          <>
            <section className="mt-7" aria-labelledby="sim-activity-title">
              <h4 id="sim-activity-title" className="flex items-center gap-2 font-semibold text-forest-800">
                <UsersRound className="h-5 w-5" aria-hidden="true" />
                详细活动记录
              </h4>
              <ol className="mt-3 rounded-panel border border-sage-200 px-4 py-1 sm:px-5">
                {[
                  ['14:30', '正常活动'],
                  ['14:31', '活动状态变化'],
                  ['14:32', '检测到疑似跌倒'],
                ].map(([time, text], index) => (
                  <li key={time} className="flex items-center gap-3 border-b border-sage-100 py-3 last:border-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${index === 2 ? 'bg-champagne-500' : 'bg-forest-500'}`}
                      aria-hidden="true"
                    />
                    <time className="w-12 font-mono text-[0.85rem] font-medium text-sage-700">{time}</time>
                    <span className="text-[0.9rem] text-forest-900">{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-7" aria-labelledby="sim-video-title">
              <h4 id="sim-video-title" className="font-semibold text-forest-800">相关视频片段</h4>
              <VideoPreview />
            </section>
          </>
        ) : (
          <section className="mt-7 rounded-panel bg-champagne-50 p-4 sm:p-5" aria-labelledby="sim-privacy-title">
            <div className="flex items-start gap-3">
              <span className="rounded-control bg-champagne-100 p-2 text-champagne-800" aria-hidden="true">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div>
                <h4 id="sim-privacy-title" className="font-semibold text-champagne-800">
                  当前配置仅共享摘要信息
                </h4>
                <p className="mt-1.5 text-[0.88rem] leading-relaxed text-champagne-800">
                  详细活动记录和事件视频<strong className="font-semibold">不向接收者开放</strong>。
                  <br />
                  这不会降低系统识别异常的能力——所有配置的基础异常识别与报警能力相同，
                  差别只在于接收者能看到多少细节。
                </p>
              </div>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-panel border border-forest-700 px-4 text-[0.92rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回监测画面
        </button>
      </div>
    </div>
  )
}
