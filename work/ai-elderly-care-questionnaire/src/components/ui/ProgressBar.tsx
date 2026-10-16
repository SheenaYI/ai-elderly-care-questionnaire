import { cn } from '@/lib/cn'

/**
 * 问卷进度条。
 *
 * 同时提供数字（"第 3 步 / 共 6 步"）与图形进度，
 * 不以颜色或长度单独传达进度信息。
 */
export default function ProgressBar({
  current,
  total,
  label,
  className,
}: {
  current: number
  total: number
  label?: string
  className?: string
}) {
  const safeTotal = Math.max(total, 1)
  const clamped = Math.min(Math.max(current, 0), safeTotal)
  const percent = Math.round((clamped / safeTotal) * 100)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.88rem] font-medium text-forest-800">
          {label ?? `进度：第 ${clamped} 步 / 共 ${safeTotal} 步`}
        </p>
        <p className="font-mono text-[0.8rem] tabular-nums text-sage-700">{percent}%</p>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-sage-200"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={label ?? `问卷进度，已完成 ${clamped} 步，共 ${safeTotal} 步`}
      >
        <div
          className="h-full rounded-full bg-forest-700 transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
