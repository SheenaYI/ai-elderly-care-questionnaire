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
