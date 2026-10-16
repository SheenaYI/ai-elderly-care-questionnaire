import { describe, expect, it } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import HeroOrbit from '@/components/home/HeroOrbit'

/**
 * 首页主视觉的几何一致性测试。
 *
 * 这里锁定的是两次真实事故（2026-10）：
 *
 *   事故一：装饰层写成 `inset-[9%]`（内缩），圆环按内缩框缩放，而圆盘与节点按整个
 *          方框定位 → 两套基准，圆环整体偏移且缩在节点里面。
 *
 *   事故二：圆环与节点同时带"居中位移类"和"动画"。CSS 中**动画里的 transform 会覆盖
 *          元素自身的 transform**（动画层叠来源优先级更高），于是居中位移失效，
 *          元素被钉在容器中心、整体偏移自身一半尺寸 → "圆盘在中心、圆环与节点偏右下"。
 *          这个用静态类名计算是发现不了的，必须显式检查"位移 + 动画"的组合。
 *
 * 因此本文件同时校验"几何数值"与"定位方式"两个层面。
 */

const CENTERING_CLASSES = [
  '-translate-x-1/2',
  '-translate-y-1/2',
  'translate-x-1/2',
  'translate-y-1/2',
] as const

function classOf(el: Element): string {
  return el.getAttribute('class') ?? ''
}

function styleOf(el: Element): string {
  return (el as HTMLElement).getAttribute('style') ?? ''
}

/** 解析百分比数值（同时支持 class 的 left-[x%] 与 inline 的 left: x%）。 */
function readPct(el: Element, prop: 'left' | 'top' | 'width'): number | null {
  const style = styleOf(el)
  const fromStyle = new RegExp(`${prop}:\\s*([\\d.]+)%`).exec(style)?.[1]
  if (fromStyle) return Number(fromStyle)
  const fromClass = new RegExp(`(?:^|\\s)${prop}-\\[([\\d.]+)%\\]`).exec(classOf(el))?.[1]
  return fromClass ? Number(fromClass) : null
}

interface Anchor {
  x: number
  y: number
}

/** 读取元素的定位锚点（优先 inline left/top，其次 class）。 */
function readAnchor(el: Element): Anchor {
  return {
    x: readPct(el, 'left') ?? 50,
    y: readPct(el, 'top') ?? 50,
  }
}

function radiusFromCenter(a: Anchor): number {
  return Math.hypot(a.x - 50, a.y - 50)
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
  return container.querySelector('figure') as HTMLElement
}

/** 定位三个维度节点。 */
function findNodes(surface: HTMLElement): HTMLElement[] {
  return ['安全感', '隐私担忧', '自主感'].map((label) => {
    const el = [...surface.querySelectorAll('div')].find(
      (d) => classOf(d).includes('rounded-panel') && (d.textContent ?? '').trim() === label,
    )
    expect(el, `缺少节点：${label}`).toBeTruthy()
    return el as HTMLElement
  })
}

/** 定位中心圆盘。 */
function findDisk(surface: HTMLElement): HTMLElement {
  const el = [...surface.querySelectorAll('div')].find(
    (d) => (d.textContent ?? '').includes('居家养老') && classOf(d).includes('rounded-full'),
  )
  expect(el, '缺少中心圆盘').toBeTruthy()
  return el as HTMLElement
}

/**
 * 定位装饰层：特征为 aria-hidden 且铺满方框。
 * ⚠️ 不能只用 [aria-hidden="true"]——lucide 图标自身也带该属性。
 */
function findDecorativeLayer(surface: HTMLElement): HTMLElement {
  const el = [...surface.querySelectorAll('[aria-hidden="true"]')].find(
    (e) => classOf(e).includes('inset-0') && classOf(e).includes('absolute'),
  )
  expect(el, '未找到装饰层（应为 aria-hidden + absolute inset-0）').toBeTruthy()
  return el as HTMLElement
}

/** 定位三个轨道环的定位层（旋转在内层，定位在外层）。 */
function findRingWrappers(surface: HTMLElement): HTMLElement[] {
  return [...surface.querySelectorAll('[class*="ring-spin"]')].map((spinEl) => spinEl.parentElement as HTMLElement)
}

describe('HeroOrbit 结构', () => {
  it('渲染出 3 个轨道环、10 颗粒子、3 个维度节点', async () => {
    const surface = await renderOrbit()
    expect(surface.querySelectorAll('[class*="ring-spin"]').length).toBe(3)
    expect(surface.querySelectorAll('.animate-particle').length).toBe(10)
    expect(findNodes(surface).length).toBe(3)
  })
})

describe('HeroOrbit 几何一致性', () => {
  it('中心圆盘居中方框正中（左右/上下对称）', async () => {
    const surface = await renderOrbit()
    const disk = findDisk(surface)
    const left = readPct(disk, 'left')
    const top = readPct(disk, 'top')
    const width = readPct(disk, 'width')
    expect(left, '圆盘缺少 left').not.toBeNull()
    expect(top, '圆盘缺少 top').not.toBeNull()
    expect(width, '圆盘缺少 width').not.toBeNull()

    // 居中的数学判据：left = (100 − width) / 2
    expect(left).toBeCloseTo((100 - width!) / 2, 1)
    expect(top).toBeCloseTo((100 - width!) / 2, 1)
  })

  it('三个节点到圆心距离相等（在同一圆上）', async () => {
    const surface = await renderOrbit()
    const radii = findNodes(surface).map((n) => radiusFromCenter(readAnchor(n)))

    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.6)
    for (const r of radii) {
      expect(r).toBeGreaterThan(30)
      expect(r).toBeLessThan(45)
    }
  })

  it('三个节点彼此夹角为 120°（正三角、等距、权重对等）', async () => {
    const surface = await renderOrbit()
    const angles = findNodes(surface).map((n) => {
      const a = readAnchor(n)
      return (Math.atan2(-(a.y - 50), a.x - 50) * 180) / Math.PI
    })
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
    const orbit = [...surface.querySelectorAll('div')].find(
      (d) => classOf(d).includes('aspect-square') && classOf(d).includes('relative'),
    )
    expect(orbit).toBeTruthy()
    expect(orbit!.textContent ?? '').not.toContain('家人陪伴')
    expect(orbit!.textContent ?? '').not.toContain('居家生活中的安全')
  })

  it('三个维度节点权重对等（同一套视觉样式类）', async () => {
    const visualClasses = findNodes(await renderOrbit()).map((el) =>
      classOf(el)
        .split(/\s+/)
        .filter((c) => /^(px-|py-|text-|gap-|bg-|border-|rounded-|shadow-)/.test(c))
        .sort()
        .join(' '),
    )
    expect(visualClasses[1]).toBe(visualClasses[0])
    expect(visualClasses[2]).toBe(visualClasses[0])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 回归：装饰层与节点必须共用同一坐标基准（事故一）
// ───────────────────────────────────────────────────────────────────────────

describe('HeroOrbit 装饰层与节点共用同一基准（回归：事故一）', () => {
  it('装饰层铺满整个方框，不得内缩', async () => {
    const cls = classOf(findDecorativeLayer(await renderOrbit()))
    expect(cls).toContain('inset-0')
    // 不得出现任何内缩（inset-[9%] / inset-x-[...] / inset-y-[...]）
    expect(cls, `装饰层不应内缩，实际：${cls}`).not.toMatch(/inset-[xy]?-?\[/)
  })

  it('三个轨道环半径递增，且都在节点半径以内、最外环露在圆盘之外', async () => {
    const surface = await renderOrbit()
    const wrappers = findRingWrappers(surface)
    expect(wrappers.length).toBe(3)

    const ringRadii = wrappers.map((el) => {
      const w = readPct(el, 'width')
      expect(w, `轨道环定位层缺少 width，实际 style：${styleOf(el)}`).not.toBeNull()
      return w! / 2
    })

    expect(ringRadii[1]).toBeGreaterThan(ringRadii[0]!)
    expect(ringRadii[2]).toBeGreaterThan(ringRadii[1]!)

    const nodeRadius = 38
    for (const r of ringRadii) {
      expect(r, `环半径 ${r}% 应小于节点半径 ${nodeRadius}%`).toBeLessThan(nodeRadius)
    }

    // 内环允许压在圆盘之下（层次效果），但最外环必须露出来
    const diskRadius = (readPct(findDisk(surface), 'width') ?? 42) / 2
    expect(Math.max(...ringRadii)).toBeGreaterThan(diskRadius)
  })

  it('粒子全部落在外环以内（不会飘出方框，也不贴在外环虚线上）', async () => {
    const surface = await renderOrbit()
    const circles = [...surface.querySelectorAll('circle')]
    expect(circles.length).toBeGreaterThan(0)

    const outerRadius =
      Math.max(...findRingWrappers(surface).map((el) => readPct(el, 'width') ?? 0)) / 2

    for (const c of circles) {
      const r = (Math.hypot(Number(c.getAttribute('cx')) - 256, Number(c.getAttribute('cy')) - 256) / 512) * 100
      expect(r, `粒子距离 ${r.toFixed(1)}% 应明显小于外环半径 ${outerRadius}%`).toBeLessThan(
        outerRadius - 2,
      )
      expect(r).toBeGreaterThan(0)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 回归：动画不得覆盖居中（事故二）
// ───────────────────────────────────────────────────────────────────────────

describe('动画不得覆盖居中（回归：事故二）', () => {
  it('没有任何元素同时带"居中位移类"和"动画类"', async () => {
    const surface = await renderOrbit()
    const offenders: string[] = []

    for (const el of surface.querySelectorAll('*')) {
      const cls = classOf(el)
      const hasCentering = CENTERING_CLASSES.some((c) => cls.includes(c))
      const hasAnimation = /animate-/.test(cls)
      if (hasCentering && hasAnimation) {
        offenders.push(`<${el.tagName.toLowerCase()} class="${cls}">`)
      }
    }

    expect(
      offenders,
      '动画的 transform 会覆盖居中位移，导致元素整体偏移自身一半尺寸。' +
        '请把动画移到内层元素，或把居中改为 left/top 百分比。\n' +
        offenders.join('\n'),
    ).toEqual([])
  })

  it('轨道环的定位层用 left/top 百分比居中，且不带位移类', async () => {
    const surface = await renderOrbit()
    for (const wrapper of findRingWrappers(surface)) {
      const cls = classOf(wrapper)
      const style = styleOf(wrapper)

      for (const c of CENTERING_CLASSES) {
        expect(cls, `环的定位层不应带位移类 ${c}`).not.toContain(c)
      }
      // 居中由 left/top 百分比负责，且左右/上下对称
      const left = /left:\s*([\d.]+)%/.exec(style)?.[1]
      const top = /top:\s*([\d.]+)%/.exec(style)?.[1]
      const width = /width:\s*([\d.]+)%/.exec(style)?.[1]
      expect(left, `环定位层缺少 left：${style}`).toBeTruthy()
      expect(top, `环定位层缺少 top：${style}`).toBeTruthy()
      expect(width, `环定位层缺少 width：${style}`).toBeTruthy()
      expect(Number(left)).toBeCloseTo((100 - Number(width)) / 2, 1)
      expect(Number(top)).toBeCloseTo((100 - Number(width)) / 2, 1)
    }
  })

  it('中心圆盘与三个节点都不带动画（避免覆盖各自居中）', async () => {
    const surface = await renderOrbit()
    const centered = [findDisk(surface), ...findNodes(surface)]
    for (const el of centered) {
      expect(/animate-/.test(classOf(el)), `居中元素不应带动画：${classOf(el)}`).toBe(false)
    }
  })

  it('关键帧不使用 transform（应使用 rotate / scale / translate 独立属性）', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const config = fs.readFileSync(path.resolve(here, '..', 'tailwind.config.js'), 'utf8')

    const start = config.indexOf('keyframes:')
    const end = config.indexOf('animation:', start)
    expect(start).toBeGreaterThan(-1)
    const keyframes = config.slice(start, end)

    // 需要重点防回归的：与居中元素或变换相关的动画
    for (const name of ['ringSpin', 'particle', 'slideInLeft']) {
      const i = keyframes.indexOf(`${name}:`)
      if (i === -1) continue
      const block = keyframes.slice(i, keyframes.indexOf('},', i) + 2)
      expect(
        block,
        `${name} 不应使用 transform（会覆盖居中位移），请改用 rotate/scale/translate`,
      ).not.toMatch(/transform:/)
    }
  })
})
