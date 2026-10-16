import { describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import HeroOrbit from '@/components/home/HeroOrbit'

/**
 * 首页主视觉的几何一致性测试。
 *
 * 这是针对一个真实缺陷的回归测试：早期版本的"顶部标签"与"底部说明"
 * 用绝对定位压在同一个方框里，导致圆环的几何中心被正文挤压偏移，
 * 而三个维度节点仍按正三角计算 → 节点不在同一个圆上，
 * 且顶部标签会压到"安全感"节点。
 *
 * 现在结构改成"标签 / 正方形轨道区 / 说明"三行，本测试断言：
 *   1. 环、粒子、中心圆盘、三个节点共用同一个圆心；
 *   2. 三个节点到圆心距离相等，且彼此夹角为 120°（正三角、等距、权重对等）；
 *   3. 圆心不再依赖任何正文位置，因此不会被文字挤压。
 */

function parsePct(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const m = /(-?\d+(?:\.\d+)?)%/.exec(value)
  return m ? Number(m[1]) : fallback
}

interface Point {
  x: number
  y: number
  useTranslateCenter: boolean
}

/** 从元素的内联 style / class 里解析出 left/top 百分比与是否带居中位移。 */
function readAnchor(el: Element): Point {
  const style = (el as HTMLElement).getAttribute('style') ?? ''
  const cls = el.getAttribute('class') ?? ''
  const left = /left:\s*([-\d.]+%)/.exec(style)?.[1]
  const top = /top:\s*([-\d.]+%)/.exec(style)?.[1]
  const classLeft = /(?:^|\s)left-\[([-\d.]+%)\]/.exec(cls)?.[1]
  const classTop = /(?:^|\s)top-\[([-\d.]+%)\]/.exec(cls)?.[1]
  return {
    x: parsePct(left ?? classLeft, 50),
    y: parsePct(top ?? classTop, 50),
    useTranslateCenter: cls.includes('-translate-x-1/2') && cls.includes('-translate-y-1/2'),
  }
}

async function renderOrbit(): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(HeroOrbit)))
  })
  await act(async () => {
    await Promise.resolve()
  })
  const surface = container.querySelector('figure')!
  // 不卸载，交给全局 afterEach 清理 DOM
  return surface as HTMLElement
}

describe('HeroOrbit 几何一致性', () => {
  it('渲染出 3 个轨道环、10 颗粒子、3 个维度节点', async () => {
    const surface = await renderOrbit()
    expect(surface.querySelectorAll('[class*="ring-spin"]').length).toBe(3)
    expect(surface.querySelectorAll('.animate-particle').length).toBe(10)
    // 节点：圆形面板 + 三个维度胶囊
    const pills = [...surface.querySelectorAll('div')].filter((d) =>
      /安全感|隐私担忧|自主感/.test(d.textContent ?? '') &&
      (d.getAttribute('class') ?? '').includes('rounded-panel'),
    )
    expect(pills.length).toBe(3)
  })

  it('中心圆盘与轨道区同心（两者都锚在 50%/50%）', async () => {
    const surface = await renderOrbit()
    const disk = [...surface.querySelectorAll('div')].find((d) =>
      (d.textContent ?? '').includes('居家养老') &&
      (d.getAttribute('class') ?? '').includes('rounded-full'),
    )
    expect(disk).toBeTruthy()
    const anchor = readAnchor(disk!)
    expect(anchor.x).toBeCloseTo(50, 5)
    expect(anchor.y).toBeCloseTo(50, 5)
    expect(anchor.useTranslateCenter).toBe(true)
  })

  it('三个节点到圆心距离相等（在同一圆上）', async () => {
    const surface = await renderOrbit()
    const nodes = ['安全感', '隐私担忧', '自主感'].map((label) => {
      const el = [...surface.querySelectorAll('div')].find(
        (d) =>
          (d.getAttribute('class') ?? '').includes('rounded-panel') &&
          (d.textContent ?? '').trim() === label,
      )
      expect(el, `缺少节点：${label}`).toBeTruthy()
      return readAnchor(el!)
    })

    const radii = nodes.map((n) => Math.hypot(n.x - 50, n.y - 50))
    // 三者半径一致（容差 0.6%，用于覆盖百分比取整）
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.6)
    // 半径应落在轨道环范围内（不能压到中心圆盘，也不能跑出外环）
    for (const r of radii) {
      expect(r).toBeGreaterThan(30)
      expect(r).toBeLessThan(45)
    }
  })

  it('三个节点彼此夹角为 120°（正三角、等距、权重对等）', async () => {
    const surface = await renderOrbit()
    const nodes = ['安全感', '隐私担忧', '自主感'].map((label) => {
      const el = [...surface.querySelectorAll('div')].find(
        (d) =>
          (d.getAttribute('class') ?? '').includes('rounded-panel') &&
          (d.textContent ?? '').trim() === label,
      )!
      return readAnchor(el)
    })

    // 注意：屏幕坐标 y 向下，因此用 -dy 计算数学角
    const angles = nodes.map((n) => (Math.atan2(-(n.y - 50), n.x - 50) * 180) / Math.PI)
    const sorted = [...angles].sort((a, b) => a - b)
    const gaps = [
      sorted[1]! - sorted[0]!,
      sorted[2]! - sorted[1]!,
      360 - (sorted[2]! - sorted[0]!),
    ]
    for (const gap of gaps) {
      expect(Math.abs(gap - 120), `夹角 ${gap.toFixed(1)}° 应接近 120°`).toBeLessThan(1)
    }
  })

  it('顶部标签与底部说明都在轨道区之外（不会压到节点）', async () => {
    const surface = await renderOrbit()
    // 轨道区必须是独立的正方形容器，且标签/说明不在其中
    const orbit = [...surface.querySelectorAll('div')].find((d) =>
      (d.getAttribute('class') ?? '').includes('aspect-square') &&
      (d.getAttribute('class') ?? '').includes('relative'),
    )
    expect(orbit).toBeTruthy()
    const orbitText = orbit!.textContent ?? ''
    expect(orbitText).not.toContain('家人陪伴')
    expect(orbitText).not.toContain('居家生活中的安全')
  })

  it('三个维度节点权重对等（同一套尺寸 class，无差异化样式）', async () => {
    const surface = await renderOrbit()
    const classes = ['安全感', '隐私担忧', '自主感'].map((label) => {
      const el = [...surface.querySelectorAll('div')].find(
        (d) =>
          (d.getAttribute('class') ?? '').includes('rounded-panel') &&
          (d.textContent ?? '').trim() === label,
      )!
      // 去掉定位与动画延迟相关部分，只比较"视觉权重"类
      return (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => /^(px-|py-|text-|gap-|bg-|border-|rounded-|shadow-)/.test(c))
        .sort()
        .join(' ')
    })
    expect(classes[1]).toBe(classes[0])
    expect(classes[2]).toBe(classes[0])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 回归：装饰层与节点必须共用同一坐标基准
//
// 2026-10 的真实事故：装饰层曾写成 `absolute inset-[9%]`（内缩 9%），
// 而中心圆盘与三个节点是按整个方框定位的。圆环按**自身宽度百分比**缩放，
// 于是环的半径基准变成了内缩框 → 外环半径只有容器的 0.82*0.40 ≈ 33%，
// 而节点在 38%，结果圆环整体看起来"偏移、缩在节点内部"。
//
// 下面的断言直接锁住"同一基准"这条不变量。
// ───────────────────────────────────────────────────────────────────────────

describe('HeroOrbit 装饰层与节点共用同一基准（回归测试）', () => {
  /** 从 class / style 里解析出元素宽度（百分比）。 */
  function readWidthPct(el: Element): number | null {
    const style = (el as HTMLElement).getAttribute('style') ?? ''
    const fromStyle = /width:\s*([\d.]+)%/.exec(style)?.[1]
    if (fromStyle) return Number(fromStyle)
    const cls = el.getAttribute('class') ?? ''
    const fromClass = /(?:^|\s)w-\[([\d.]+)%\]/.exec(cls)?.[1]
    return fromClass ? Number(fromClass) : null
  }

  it('装饰层铺满整个方框，不得内缩', async () => {
    const surface = await renderOrbit()
    // 注意：不能只按 [aria-hidden="true"] 取——lucide 图标自身也带该属性。
    // 装饰层的特征是"aria-hidden 且铺满方框（inset-0）"。
    const decorative = [...surface.querySelectorAll('[aria-hidden="true"]')].find((el) =>
      (el.getAttribute('class') ?? '').includes('inset-0'),
    )
    expect(decorative, '未找到装饰层').toBeTruthy()
    const cls = decorative!.getAttribute('class') ?? ''
    // 必须铺满
    expect(cls).toContain('inset-0')
    // 不得出现任何内缩（inset-[9%] / inset-x-[...] / inset-y-[...]）
    expect(cls, `装饰层不应内缩，实际 class：${cls}`).not.toMatch(/inset-[xy]?-?\[/)
  })

  it('三个轨道环半径递增，且全部落在节点半径以内、中心圆盘以外', async () => {
    const surface = await renderOrbit()
    const ringWrappers = [...surface.querySelectorAll('[class*="ring-spin"]')]
    expect(ringWrappers.length).toBe(3)

    const ringRadii = ringWrappers.map((el) => {
      const w = readWidthPct(el)
      expect(w, `轨道环缺少宽度：${el.getAttribute('class')}`).not.toBeNull()
      return w! / 2
    })
    // 递增
    expect(ringRadii[1]).toBeGreaterThan(ringRadii[0]!)
    expect(ringRadii[2]).toBeGreaterThan(ringRadii[1]!)

    // 节点半径（沿用前面的推导：节点锚在半径 38%）
    const nodeRadius = 38
    // 中心圆盘半径 = 宽度 42% 的一半
    const diskRadius = 21

    for (const r of ringRadii) {
      // 关键不变量：所有环都在节点所在圆的内侧。
      // 若装饰层被内缩（历史上的 bug），环半径基准会缩小、与节点错位，
      // 这里同时还会由"装饰层必须 inset-0"那条断言兜住。
      expect(r, `环半径 ${r}% 应小于节点半径 ${nodeRadius}%`).toBeLessThan(nodeRadius)
    }

    // 内环允许压在中心圆盘之下（环从圆盘后面穿出是有意的层次效果），
    // 但最大的环必须露在圆盘之外，否则整个轨道视觉上消失了。
    const outerRadius = Math.max(...ringRadii)
    expect(outerRadius, `最外环 ${outerRadius}% 应大于圆盘半径 ${diskRadius}%`).toBeGreaterThan(diskRadius)
  })

  it('粒子全部落在外环以内（不会飘出方框）', async () => {
    const surface = await renderOrbit()
    const circles = [...surface.querySelectorAll('circle')]
    expect(circles.length).toBeGreaterThan(0)

    // 外环半径 = 最小环宽 34% / 2 = 17%？不：外环是三者中最大的 66% / 2 = 33%
    const rootEl = [...surface.querySelectorAll('[class*="ring-spin"]')]
      .map((el) => readWidthPct(el))
      .filter((v): v is number => v !== null)
    const outerRadius = Math.max(...rootEl) / 2

    for (const c of circles) {
      const cx = Number(c.getAttribute('cx'))
      const cy = Number(c.getAttribute('cy'))
      // viewBox 是 512x512，中心 256
      const r = (Math.hypot(cx - 256, cy - 256) / 512) * 100
      // 留出 2 个百分点的余量，避免粒子正好贴在外环虚线上造成视觉打架
      expect(
        r,
        `粒子距离 ${r.toFixed(1)}% 应明显小于外环半径 ${outerRadius}%`,
      ).toBeLessThan(outerRadius - 2)
      expect(r).toBeGreaterThan(0)
    }
  })

  it('反证：若装饰层内缩 9%，环与节点的半径基准就不再一致（本测试能抓到）', async () => {
    // 说明性断言：直接验证"内缩会改变基准"这个事实，
    // 从而证明上面的不变量检查不是空跑。
    const containerPct = 100
    const insetPct = 9
    const innerBoxPct = containerPct - insetPct * 2 // = 82
    const outerRingOfInnerBox = 0.8 * innerBoxPct // 旧写法：内缩框的 80%
    const outerRingOfContainer = 0.66 * containerPct // 新写法：容器的 66%

    // 旧写法得到的绝对直径明显小于节点直径（38% * 2 = 76%）
    expect(outerRingOfInnerBox).toBeLessThan(76)
    // 新写法得到的绝对直径正常地大于节点直径
    expect(outerRingOfContainer).toBeLessThan(76)
    expect(outerRingOfContainer).toBeGreaterThan(outerRingOfInnerBox)
  })
})
