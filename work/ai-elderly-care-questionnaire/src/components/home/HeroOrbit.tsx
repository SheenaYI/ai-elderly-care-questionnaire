import { HeartHandshake, House, ListFilter, Lock, ShieldCheck } from 'lucide-react'

/**
 * 首页主视觉：居家养老与三个研究维度的关系示意图。
 *
 * 设计意图：
 *   中心是"居家养老"（研究的场景），外圈环绕 **安全感 / 隐私担忧 / 自主感**
 *   三个研究维度。三者是参与者需要权衡的对象，因此权重完全对等
 *   ——不暗示任何一个维度更重要，也不暗示任何"正确"答案。
 *
 * 粒子环绕效果：
 *   由 3 个半径不同、转速与方向各异的轨道环 + 一圈缓慢明灭的粒子构成。
 *   实现要点：
 *     - 旋转只作用于**装饰层**（`aria-hidden`），文字与内容层完全静止，
 *       因此不会影响阅读，也不会在窄屏上把文字转出可视区。
 *     - 粒子位置由固定的三角函数算得，**不使用随机数**，保证渲染稳定。
 *     - 全局 `prefers-reduced-motion` 规则会把所有动画时长压到
 *       0.001ms、迭代 1 次，因此该效果在减弱动态偏好下自动静止。
 *     - 纯装饰：屏幕阅读器可读到下方 `figcaption` 的等价文字说明，
 *       不依赖该图形传达任何信息。
 */

const SIZE = 512
const CENTER = SIZE / 2

/** 粒子层：半径比例 / 起始角度 / 尺寸(px) / 动画延迟(s)。位置固定，非随机。 */
const PARTICLES: readonly { r: number; a: number; s: number; d: number }[] = [
  { r: 0.19, a: 24, s: 3, d: 0.0 },
  { r: 0.19, a: 132, s: 2, d: 1.1 },
  { r: 0.19, a: 246, s: 2.5, d: 2.2 },
  { r: 0.30, a: 58, s: 2.5, d: 0.4 },
  { r: 0.30, a: 168, s: 2, d: 1.5 },
  { r: 0.30, a: 288, s: 3, d: 2.6 },
  { r: 0.42, a: 12, s: 2, d: 0.8 },
  { r: 0.42, a: 96, s: 3, d: 1.9 },
  { r: 0.42, a: 204, s: 2.5, d: 3.0 },
  { r: 0.42, a: 320, s: 2, d: 0.2 },
]

/** 轨道环（百分比直径），转速与方向各不相同以形成环绕感。 */
const ORBIT_RINGS = [
  { size: '38%', spin: 'animate-ring-spin-slow' },
  { size: '60%', spin: 'animate-ring-spin-slower' },
  { size: '84%', spin: 'animate-ring-spin-slowest' },
] as const

/** 三个研究维度节点（权重对等）。 */
const DIMENSIONS = [
  {
    key: 'security',
    label: '安全感',
    Icon: ShieldCheck,
    className: 'left-1/2 top-[7%] -translate-x-1/2',
  },
  { key: 'privacy', label: '隐私担忧', Icon: Lock, className: 'left-[3%] top-[64%]' },
  { key: 'autonomy', label: '自主感', Icon: ListFilter, className: 'right-[3%] top-[64%]' },
] as const

export default function HeroOrbit() {
  return (
    <figure className="m-0 w-full max-w-[26rem] shrink-0">
      <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-feature border border-sage-200 bg-gradient-to-b from-cream-100 via-cream-50 to-sage-50">
        {/* ── 装饰层：旋转轨道环与粒子（仅视觉，aria-hidden） ── */}
        <div className="absolute inset-0" aria-hidden="true">
          {ORBIT_RINGS.map((ring) => (
            <div
              key={ring.size}
              className={`absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 ${ring.spin}`}
              style={{ width: ring.size }}
            >
              <span className="absolute inset-0 rounded-full border border-dashed border-sage-300/70" />
              {/* 环上的小点：随环旋转，形成持续的环绕动势 */}
              <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-500/45" />
            </div>
          ))}

          {/* 粒子云：位置由固定角度算出，非随机 */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {PARTICLES.map((p) => {
              const rad = (p.a * Math.PI) / 180
              return (
                <circle
                  key={`${p.a}-${p.r}`}
                  cx={CENTER + Math.cos(rad) * p.r * SIZE}
                  cy={CENTER + Math.sin(rad) * p.r * SIZE}
                  r={p.s}
                  className="animate-particle fill-forest-500"
                  style={{ animationDelay: `${p.d}s` }}
                />
              )
            })}
          </svg>
        </div>

        {/* ── 顶部标签 ─────────────────────────────────────── */}
        <p className="absolute inset-x-0 top-[3.5%] flex items-center justify-center gap-2 text-[0.78rem] font-medium text-sage-700 sm:text-[0.82rem]">
          <HeartHandshake className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
          家人陪伴 · 授权照护
        </p>

        {/* ── 中心：居家养老 ───────────────────────────────── */}
        <div className="absolute left-1/2 top-[44%] flex aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-sage-200 bg-white/85 px-2 text-center shadow-card backdrop-blur-sm">
          <House className="h-6 w-6 text-forest-700 sm:h-8 sm:w-8" aria-hidden="true" />
          <p className="mt-1 text-[0.98rem] font-semibold leading-tight text-forest-800 sm:mt-1.5 sm:text-[1.2rem]">
            居家养老
          </p>
          <p className="mt-1 text-[0.62rem] leading-snug text-sage-600 sm:text-[0.72rem]">
            日常起居 · 家人 · 照护
          </p>
        </div>

        {/* ── 三个研究维度 ─────────────────────────────────── */}
        {DIMENSIONS.map(({ key, label, Icon, className }) => (
          <div
            key={key}
            className={`absolute flex items-center gap-1.5 rounded-panel border border-sage-200 bg-white/90 px-2 py-1.5 shadow-card backdrop-blur-sm sm:gap-2 sm:px-3.5 sm:py-2.5 ${className}`}
          >
            <Icon
              className="h-3.5 w-3.5 shrink-0 text-forest-700 sm:h-[1.15rem] sm:w-[1.15rem]"
              aria-hidden="true"
            />
            <span className="whitespace-nowrap text-[0.76rem] font-semibold text-forest-800 sm:text-[0.95rem]">
              {label}
            </span>
          </div>
        ))}

        {/* ── 底部说明 ─────────────────────────────────────── */}
        <p className="absolute inset-x-0 bottom-[5%] px-4 text-center text-[0.72rem] font-medium text-sage-700 sm:text-[0.8rem]">
          居家生活中的安全、隐私与自主
        </p>
      </div>

      {/* 等价文字说明：不依赖视觉也能获得同等信息 */}
      <figcaption className="mt-3 text-center text-[0.8rem] leading-relaxed text-sage-600">
        示意图：以"居家养老"为中心，安全感、隐私担忧与自主感是本研究考察的三个维度，
        三者权重相同。
      </figcaption>
    </figure>
  )
}
