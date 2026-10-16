import { useEffect, useState } from 'react'
import { AlertCircle, LoaderCircle, PlaySquare } from 'lucide-react'
import { SIMULATION_VIDEO_PATH } from './simulationScript'

/**
 * 模拟事件视频预览。
 *
 * - 视频为**本地静态文件**，不使用任何外部媒体源。
 * - 文件缺失时降级为占位界面，绝不报错或崩溃。
 * - 明确标注为"研究情景模拟"，避免被理解为真实监控录像。
 * - 不自动播放、不请求摄像头权限。
 */
export default function VideoPreview() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'missing'>('checking')

  useEffect(() => {
    let active = true
    fetch(SIMULATION_VIDEO_PATH, { method: 'HEAD' })
      .then((response) => {
        if (active) setStatus(response.ok ? 'ready' : 'missing')
      })
      .catch(() => {
        if (active) setStatus('missing')
      })
    return () => {
      active = false
    }
  }, [])

  if (status === 'ready') {
    return (
      <div className="mt-3">
        <div className="overflow-hidden rounded-panel bg-forest-900">
          <video
            controls
            preload="metadata"
            className="aspect-video w-full"
            onError={() => setStatus('missing')}
            aria-label="研究情景模拟视频，非真实监控录像"
          >
            <source src={SIMULATION_VIDEO_PATH} type="video/mp4" />
            当前浏览器不支持视频播放。
          </video>
        </div>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-sage-700">
          研究情景模拟素材，非真实监控录像，不包含任何真实参与者影像。
        </p>
      </div>
    )
  }

  if (status === 'checking') {
    return (
      <div className="mt-3 flex aspect-video items-center justify-center rounded-panel bg-sage-100 text-sage-700">
        <p className="flex items-center gap-2 text-[0.9rem]">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在检查演示素材
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 flex aspect-video flex-col items-center justify-center rounded-panel border border-dashed border-sage-300 bg-sage-50 px-5 text-center">
      <span className="rounded-panel bg-white p-3 text-forest-700 shadow-card" aria-hidden="true">
        <PlaySquare className="h-7 w-7" />
      </span>
      <p className="mt-3 text-[0.95rem] font-semibold text-forest-800">模拟事件视频（占位）</p>
      <p className="mt-1.5 max-w-sm text-[0.82rem] leading-relaxed text-sage-700">
        研究团队尚未提供演示视频素材。可将授权使用的 MP4 放入
        <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[0.78rem] text-forest-800">
          public{SIMULATION_VIDEO_PATH}
        </code>
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8rem] text-sage-700">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        当前显示占位区域，不影响问卷填写
      </p>
    </div>
  )
}
