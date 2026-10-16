import { useEffect, useState } from 'react'
import { AlertCircle, LoaderCircle, PlaySquare, Video } from 'lucide-react'

function VideoPreview() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let isActive = true
    fetch('/videos/fall-demo.mp4', { method: 'HEAD' })
      .then((response) => {
        if (isActive) setStatus(response.ok ? 'ready' : 'missing')
      })
      .catch(() => {
        if (isActive) setStatus('missing')
      })

    return () => {
      isActive = false
    }
  }, [])

  if (status === 'ready') {
    return (
      <div className="mt-3 overflow-hidden rounded-xl bg-slate-950">
        <video
          controls
          preload="metadata"
          className="aspect-video w-full"
          onError={() => setStatus('missing')}
          aria-label="模拟事件视频"
        >
          <source src="/videos/fall-demo.mp4" type="video/mp4" />
          当前浏览器不支持视频播放。
        </video>
      </div>
    )
  }

  if (status === 'checking') {
    return (
      <div className="mt-3 flex aspect-video items-center justify-center rounded-xl bg-sage-100 text-sage-500">
        <div className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />正在检查演示素材</div>
      </div>
    )
  }

  return (
    <div className="mt-3 flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-sage-300 bg-sage-50 px-5 text-center">
      <div className="rounded-xl bg-white p-3 text-forest-700 shadow-card" aria-hidden="true">
        <PlaySquare className="h-7 w-7" />
      </div>
      <p className="mt-3 text-sm font-semibold text-forest-800">模拟事件视频</p>
      <p className="mt-1.5 max-w-sm text-xs leading-5 text-sage-500">
        请将演示视频放入 <code className="rounded bg-white px-1 py-0.5 text-forest-800">public/videos/fall-demo.mp4</code>
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-sage-500"><AlertCircle className="h-3.5 w-3.5" />当前显示视频占位区域</span>
    </div>
  )
}

export default VideoPreview
