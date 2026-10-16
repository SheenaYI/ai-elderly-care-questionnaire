import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import VideoPreview from '@/features/simulation/VideoPreview'
import { SIMULATION_VIDEO_PATH } from '@/features/simulation/simulationScript'

/**
 * 模拟事件视频的降级行为测试。
 *
 * 要求（用户明确提出）：**缺少视频不会导致崩溃**。
 *
 * 这里特别覆盖一个容易出错的场景：单页应用的部署配置会把未命中的路径
 * 回退到 index.html，此时 HTTP 状态码仍是 200，但返回的是 HTML。
 * 组件必须识别出"这不是视频"，退回到占位界面。
 */

let container: HTMLDivElement | null = null
let root: Root | null = null

async function renderVideoPreview(): Promise<string> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(MemoryRouter, null, createElement(VideoPreview)))
  })
  // 等待 fetch 的 promise 链与状态更新完成
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return container.textContent ?? ''
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount())
    root = null
  }
  container?.remove()
  container = null
  vi.restoreAllMocks()
})

function mockHeadResponse(init: { ok: boolean; contentType?: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: init.ok,
      headers: {
        get: (key: string) =>
          key.toLowerCase() === 'content-type' ? (init.contentType ?? null) : null,
      },
    })),
  )
}

describe('VideoPreview 降级行为', () => {
  it('视频缺失（404）时显示占位界面，不崩溃', async () => {
    mockHeadResponse({ ok: false })
    const text = await renderVideoPreview()
    expect(text).toContain('模拟事件视频（占位）')
    expect(text).toContain('当前显示占位区域')
    // 不应渲染 video 元素
    expect(document.querySelector('video')).toBeNull()
  })

  it('路径返回 HTML（SPA 回退，200 + text/html）时同样显示占位界面', async () => {
    mockHeadResponse({ ok: true, contentType: 'text/html; charset=utf-8' })
    const text = await renderVideoPreview()
    expect(text).toContain('模拟事件视频（占位）')
    expect(document.querySelector('video')).toBeNull()
  })

  it('路径确实返回视频（200 + video/mp4）时渲染 video 元素', async () => {
    mockHeadResponse({ ok: true, contentType: 'video/mp4' })
    const text = await renderVideoPreview()
    expect(document.querySelector('video')).not.toBeNull()
    // 必须标注为研究情景模拟，避免被当作真实监控录像
    expect(text).toContain('研究情景模拟素材')
    expect(text).toContain('非真实监控录像')
  })

  it('请求失败（网络错误）时显示占位界面，不抛出异常', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))
    const text = await renderVideoPreview()
    expect(text).toContain('模拟事件视频（占位）')
  })

  it('视频路径常量指向本地静态文件（不加载任何外部媒体）', () => {
    expect(SIMULATION_VIDEO_PATH).toBe('/videos/fall-demo.mp4')
    expect(SIMULATION_VIDEO_PATH.startsWith('/')).toBe(true)
    expect(SIMULATION_VIDEO_PATH).not.toMatch(/^https?:/)
  })
})
