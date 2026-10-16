import { HeartHandshake, House, ListFilter, Lock, ShieldCheck } from 'lucide-react'

/**
 * 首页主视觉：居家养老与三个研究维度的关系示意图。
 *
 * 设计意图：
 *   中心是"居家养老"（研究的场景），外圈**等距**环绕安全感 / 隐私担忧 / 自主感
 *   三个研究维度。三者是参与者需要权衡的对象，因此权重完全对等
 *   ——不暗示任何一个维度更重要，也不暗示任何"正确"答案。
 *
 * 几何说明（之前版本的问题已在这里修正）：
 *   - 结构改成**垂直三行**：顶部标签 / 正方形轨道区 / 底部说明。
 *     这样"轨道区"是一个干净的方框，圆环与三个节点共享**同一个圆心**，
 *     不会再出现"节点不在一个圆上"的情况，顶部标签也不可能压到节点。
 *   - 三个节点按 90° / 210° / 330° 布置，在视觉上就是正三角、彼此等距。
 *   - **装饰层（环 / 粒子）必须铺满同一个正方形，不得内缩**：圆环按自身宽度
 *     百分比缩放，若把它放进一个 `inset-[x%]` 的内缩框，环的尺寸与半径基准就
 *     与圆盘、节点不同，会出现"圆环整体偏移 / 缩在节点里面"的错位。
 *     2026-10 曾因此出现过一次圆心偏移，已修正并由
 *     tests/heroOrbitGeometry.test.ts 锁定（断言装饰层铺满、且各环半径与
 *     节点半径同基准）。
 *   - 节点坐标由三角函数算出并写成静态 class（不拼字符串），
 *     因此 Tailwind 能正常提取，也不依赖运行时计算。
 *
 * 粒子环绕效果：
 *   3 个半径不同、转速与方向各异的虚线轨道环 + 一圈缓慢明灭的粒子。
 *   - 只有装饰层旋转，文字与节点保持静止（不会转出可视范围）。
 *   - 粒子位置由固定角度算出，**不使用随机数**，渲染稳定。
 *   - 全局 prefers-reduced-motion 规则会把动画压到 0.001ms、迭代 1 次，
 *     因此该效果在减弱动态偏好下自动静止。
 *   - 纯装饰：屏幕阅读器通过 figcaption 获得等价信息。
 */

const SIZE = 512
const CENTER = SIZE / 2

/** 粒子：半径比例（相对轨道区）/ 起始角度 / 尺寸(px) / 动画延迟(s)。位置固定。 */
const PARTICLES: readonly { r: number; a: number; s: number; d: number }[] = [
  // 内圈（贴近内环）
  { r: 0.14, a: 20, s: 3, d: 0.0 },
  { r: 0.14, a: 128, s: 2, d: 1.1 },
  { r: 0.14, a: 244, s: 2.5, d: 2.2 },
  // 中圈（贴近中环）
  { r: 0.23, a: 64, s: 2.5, d: 0.4 },
  { r: 0.23, a: 172, s: 2, d: 1.5 },
  { r: 0.23, a: 296, s: 3, d: 2.6 },
  // 外圈（外环内侧，避免与外环虚线重叠）
  { r: 0.30, a: 8, s: 2, d: 0.8 },
  { r: 0.30, a: 100, s: 3, d: 1.9 },
  { r: 0.30, a: 208, s: 2.5, d: 3.0 },
  { r: 0.30, a: 324, s: 2, d: 0.2 },
]

/** 轨道环（相对轨道区的直径百分比），转速与方向各不相同。 */
const ORBIT_RINGS = [
  { size: '34%', spin: 'animate-ring-spin-slow' },
  { size: '50%', spin: 'animate-ring-spin-slower' },
  { size: '66%', spin: 'animate-ring-spin-slowest' },
] as const

/**
 * 三个研究维度节点。
 *
 * 角度：安全感 90°（正上）、隐私担忧 210°（左下）、自主感 330°（右下）。
 * 半径 38% 由三角函数换算为相对定位百分比后写死，保证圆心一致：
 *   left = 50 + cos(θ)·38 , top = 50 − sin(θ)·38
 */
const DIMENSIONS = [
  {
    key: 'security',
    label: '安全感',
    Icon: ShieldCheck,
    className: 'left-1/2 top-[12%] -translate-x-1/2 -translate-y-1/2',
    delay: '0s',
  },
  {
    key: 'privacy',
    label: '隐私担忧',
    Icon: Lock,
    className: 'left-[17.1%] top-[69%] -translate-x-1/2 -translate-y-1/2',
    delay: '1.2s',
  },
  {
    key: 'autonomy',
    label: '自主感',
    Icon: ListFilter,
    className: 'left-[82.9%] top-[69%] -translate-x-1/2 -translate-y-1/2',
    delay: '2.4s',
  },
] as const

export default function HeroOrbit() {
  return (
    <figure className="m-0 w-full max-w-[27rem] shrink-0">
      <div className="rounded-feature border border-sage-200 bg-gradient-to-b from-cream-100 via-cream-50 to-sage-50 px-3 py-5 shadow-card sm:px-5 sm:py-6">
        {/* ── 第一行：顶部标签 ─────────────────────────────── */}
        <p className="flex items-center justify-center gap-2 text-[0.82rem] font-medium text-sage-700">
          <HeartHandshake className="h-4 w-4 shrink-0 text-forest-600" aria-hidden="true" />
          家人陪伴 · 授权照护
        </p>

        {/* ── 第二行：正方形轨道区（圆环与节点共用同一圆心） ── */}
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[22rem]">
          {/* 装饰层：旋转轨道环与粒子（仅视觉） */}
          <div className="absolute inset-0" aria-hidden="true">
            {ORBIT_RINGS.map((ring) => (
              <div
                key={ring.size}
                className={`absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 ${ring.spin}`}
                style={{ width: ring.size }}
              >
                <span className="absolute inset-0 rounded-full border border-dashed border-sage-300/75" />
                {/* 环上的小点：随环旋转，形成持续的环绕动势 */}
                <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-500/50" />
              </div>
            ))}

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
                    cy={CENTER - Math.sin(rad) * p.r * SIZE}
                    r={p.s}
                    className="animate-particle fill-forest-500"
                    style={{ animationDelay: `${p.d}s` }}
                  />
                )
              })}
            </svg>
          </div>

          {/* 中心：居家养老（与轨道区同心） */}
          <div className="absolute left-1/2 top-1/2 flex aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-sage-200 bg-white/90 px-2 text-center shadow-card backdrop-blur-sm">
            <House className="h-6 w-6 text-forest-700 sm:h-7 sm:w-7" aria-hidden="true" />
            <p className="mt-1 text-[0.95rem] font-semibold leading-tight text-forest-800 sm:text-[1.1rem]">
              居家养老
            </p>
            <p className="mt-0.5 text-[0.6rem] leading-snug text-sage-600 sm:text-[0.68rem]">
              日常起居 · 家人 · 照护
            </p>
          </div>

          {/* 三个研究维度：等距环绕，权重对等 */}
          {DIMENSIONS.map(({ key, label, Icon, className, delay }) => (
            <div
              key={key}
              className={`absolute flex animate-float-soft items-center gap-1.5 rounded-panel border border-sage-200 bg-white/95 px-2 py-1.5 shadow-card backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-2 ${className}`}
              style={{ animationDelay: delay }}
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-forest-700 sm:h-4 sm:w-4"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap text-[0.78rem] font-semibold text-forest-800 sm:text-[0.9rem]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── 第三行：底部说明 ─────────────────────────────── */}
        <p className="mt-3 text-center text-[0.78rem] font-medium text-sage-700 sm:text-[0.82rem]">
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
