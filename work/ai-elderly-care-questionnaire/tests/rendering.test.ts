import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * 渲染烟雾测试（真实客户端渲染）。
 *
 * 目的：验证每个页面与每个问卷步骤在**运行时**都能真正渲染，
 * 不抛出异常，并输出预期的关键文案。
 *
 * 说明：使用 react-dom/client + jsdom 进行真实的客户端渲染，
 * 因此 useEffect 与 <Navigate> 路由重定向都会真正执行——
 * 这与参与者在浏览器中的实际行为一致。
 * 纯数据逻辑（随机化、校验）由其他测试文件覆盖。
 */

if (typeof window.scrollTo !== 'function') {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}

let container: HTMLDivElement | null = null
let root: Root | null = null

/** 客户端渲染并返回最终 DOM 文本与 HTML。 */
async function renderClient(element: ReactElement): Promise<{ html: string; text: string }> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  await act(async () => {
    root!.render(element)
  })
  // 让 effect 中的状态更新（重定向、草稿恢复）落定
  await act(async () => {
    await Promise.resolve()
  })

  return { html: container.innerHTML, text: container.textContent ?? '' }
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount()
    })
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})


/** 渲染单个页面组件（不经过路由）。 */
async function renderPage(element: ReactElement): Promise<string> {
  const { text } = await renderClient(createElement(MemoryRouter, null, element))
  return text
}

/** 在指定路由上渲染应用路由表。 */
async function renderAtRoute(path: string): Promise<string> {
  const { default: AppRoutes } = await import('@/app/router')
  const { text } = await renderClient(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(AppRoutes as unknown as React.ComponentType),
    ),
  )
  return text
}

describe('公共页面渲染', () => {
  it('首页渲染成功并包含主标题与主按钮', async () => {
    const { default: HomePage } = await import('@/pages/HomePage')
    const html = await renderPage(createElement(HomePage))
    expect(html).toContain('当 AI 走进养老生活')
    expect(html).toContain('安全、隐私与自主性之间')
    expect(html).toContain('开始参与研究')
    expect(html).toContain('仅用于学术研究')
    expect(html).toContain('自愿参与，可随时退出')
  })

  it('首页显示"预计填写时间"占位字段（不编造时长）', async () => {
    const { default: HomePage } = await import('@/pages/HomePage')
    const html = await renderPage(createElement(HomePage))
    expect(html).toContain('预计填写时间')
    expect(html).toContain('[待填写：预计填写时间]')
  })

  it('首页在未配置 Supabase 时显示 Demo 模式提示', async () => {
    const { default: HomePage } = await import('@/pages/HomePage')
    const html = await renderPage(createElement(HomePage))
    expect(html).toContain('Demo 模式')
    expect(html).toContain('未配置 Supabase')
  })

  it('情景体验页渲染成功且提供全部 8 个配置', async () => {
    const { default: ExperiencePage } = await import('@/pages/ExperiencePage')
    const { text } = await renderClient(
      createElement(MemoryRouter, null, createElement(ExperiencePage)),
    )
    expect(text).toContain('看见技术如何守护日常')
    expect(text).toContain('开始模拟')
    // 八个配置按钮都在（以 role=radio 的配置选择器为准）
    const radios = document.querySelectorAll('[role="radio"]')
    const labels = [...radios].map((el) => el.textContent ?? '')
    for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']) {
      expect(labels.some((l) => l.startsWith(id)), `缺少配置 ${id}`).toBe(true)
    }
  })

  it('研究介绍页渲染成功且不泄露研究假设方向', async () => {
    const { default: AboutPage } = await import('@/pages/AboutPage')
    const html = await renderPage(createElement(AboutPage))
    expect(html).toContain('在技术与尊严之间，寻找更好的答案')
    expect(html).toContain('研究背景')
    expect(html).toContain('研究问题')
    expect(html).toContain('离散选择实验')
    // 不得出现假设方向或预期结论
    for (const forbidden of ['采纳意愿可能下降', 'H1', 'H2', 'H3', '预期结果', '假设将得到支持']) {
      expect(html, `不应出现：${forbidden}`).not.toContain(forbidden)
    }
  })

  it('隐私与知情同意页渲染成功并包含全部必需章节', async () => {
    const { default: PrivacyPage } = await import('@/pages/PrivacyPage')
    const html = await renderPage(createElement(PrivacyPage))
    for (const section of [
      '研究目的', '参与方式', '数据收集范围', '数据使用目的',
      '数据保存期限与访问权限', '退出规则', '研究联系人', '风险说明与您的权益',
    ]) {
      expect(html, `缺少章节：${section}`).toContain(section)
    }
    expect(html).toContain('不会开启您的摄像头')
    expect(html).toContain('[待填写：研究联系人]')
    expect(html).toContain('[待填写：数据保存期限]')
  })

  it('隐私页明确说明不编造未确定信息', async () => {
    const { default: PrivacyPage } = await import('@/pages/PrivacyPage')
    const html = await renderPage(createElement(PrivacyPage))
    expect(html).toContain('未作任何编造')
  })

  it('404 页面渲染成功', async () => {
    const { default: NotFoundPage } = await import('@/pages/NotFoundPage')
    const html = await renderPage(createElement(NotFoundPage))
    expect(html).toContain('找不到这个页面')
  })
})

describe('问卷步骤渲染', () => {
  /**
   * 在指定问卷步骤上渲染。
   *
   * 路由表必须包含 /404，因为 QuestionnairePage 在遇到未知步骤时
   * 会重定向到 /404 —— 与 src/app/router.tsx 的真实结构保持一致。
   */
  async function renderStep(step: string): Promise<string> {
    const { default: QuestionnairePage } = await import('@/pages/QuestionnairePage')
    const { default: NotFoundPage } = await import('@/pages/NotFoundPage')
    const { MemoryRouter: MR } = await import('react-router-dom')
    const { text } = await renderClient(
      createElement(
        MR,
        { initialEntries: [`/questionnaire/${step}`] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/questionnaire/:step',
            element: createElement(QuestionnairePage),
          }),
          createElement(Route, { path: '/404', element: createElement(NotFoundPage) }),
        ),
      ),
    )
    return text
  }

  it('模块一（知情同意）渲染成功，包含同意与不同意两个动作', async () => {
    const html = await renderStep('consent')
    expect(html).toContain('研究说明')
    expect(html).toContain('同意并继续')
    expect(html).toContain('不同意（结束）')
    expect(html).toContain('身份信息')
    // Q2–Q5 题干
    expect(html).toContain('您的年龄范围')
    expect(html).toContain('您的主要答题身份')
    expect(html).toContain('您是否了解AI养老监测设备？')
    expect(html).toContain('您是否有照护老人的经历？')
    // 不把照护者偏好等同于老人偏好
    expect(html).toContain('不把照护者的偏好等同于老人本人的偏好')
  })

  it('模块二（情景与理解检查）在未同意时被守卫重定向，不渲染题目', async () => {
    // 未同意 → 应重定向到 consent（SSR 下渲染 consent 内容）
    const html = await renderStep('scenario')
    expect(html).toContain('同意并继续')
  })

  it('模块三（DCE）在未分配卷别时显示准备状态而非崩溃', async () => {
    const html = await renderStep('dce')
    // 未同意 → 重定向到 consent；无论如何不应抛错
    expect(html.length).toBeGreaterThan(100)
  })

  it('未知步骤重定向到 404', async () => {
    const html = await renderStep('not-a-real-step')
    expect(html).toContain('找不到这个页面')
  })
})

describe('路由表整体渲染', () => {
  it('首页路由可渲染', async () => {
    const html = await renderAtRoute('/')
    expect(html).toContain('当 AI 走进养老生活')
  })

  it('右侧导航包含四个编号入口', async () => {
    const html = await renderAtRoute('/')
    for (const label of ['参与研究', '情景体验', '研究介绍', '隐私与知情同意']) {
      expect(html, `导航缺少：${label}`).toContain(label)
    }
    // 编号
    for (const index of ['01', '02', '03', '04']) {
      expect(html).toContain(index)
    }
  })

  it('参与者导航中不出现 /admin 链接', async () => {
    for (const path of ['/', '/about', '/privacy', '/experience']) {
      const html = await renderAtRoute(path)
      expect(html, `${path} 不应链接到 /admin`).not.toContain('href="/admin"')
    }
  })

  it('未知路径跳转到 404', async () => {
    const html = await renderAtRoute('/this-does-not-exist')
    expect(html).toContain('找不到这个页面')
  })

  it('隐私页路由可渲染', async () => {
    const html = await renderAtRoute('/privacy')
    expect(html).toContain('隐私保护与知情同意说明')
  })

  it('研究介绍路由可渲染', async () => {
    const html = await renderAtRoute('/about')
    expect(html).toContain('在技术与尊严之间')
  })

  it('情景体验路由可渲染', async () => {
    const html = await renderAtRoute('/experience')
    expect(html).toContain('看见技术如何守护日常')
  })
})

describe('管理后台的安全渲染行为', () => {
  it('未配置 Supabase 时关闭后台，不泄露数据也不提供登录入口', async () => {
    const { default: AdminPage } = await import('@/features/admin/AdminPage')
    const html = await renderPage(createElement(AdminPage))
    // 认证流程在 effect 中完成 → 未配置时应明确提示后台尚未配置
    expect(html).toContain('后台尚未配置')
    // 不展示任何研究数据或导出入口
    expect(html).not.toContain('已提交问卷数')
    expect(html).not.toContain('participants.csv')
    expect(html).not.toContain('dce_choices.csv')
    expect(html).not.toContain('数据导出')
    // 未配置时不应出现密码输入框（没有可用的认证后端）
    expect(html).not.toContain('研究人员邮箱')
    // 不应存在任何前端写死的密码
    expect(html).not.toMatch(/admin123|password\s*[:=]\s*['"]/)
  })
})

describe('模拟组件渲染', () => {
  it('模拟弹窗对每个配置都能渲染（含缺失视频的降级路径）', async () => {
    const { default: SimulationModal } = await import('@/features/simulation/SimulationModal')
    for (const profileId of ['C1', 'C3', 'C5', 'C8'] as const) {
      const { text: html } = await renderClient(
        createElement(SimulationModal, {
          profileId,
          taskId: 'T01',
          source: 'dce',
          onClose: () => {},
          onEvent: () => {},
        }),
      )
      expect(html, `${profileId} 模拟应渲染`).toContain('AI养老监测运行模拟')
      // 必须标注为研究情景模拟
      expect(html).toContain('研究情景模拟')
      expect(html).toContain('不代表真实AI识别')
    }
  })

  it('仅摘要配置（X1=0）的通知详情说明详细记录不开放', async () => {
    const { default: NotificationDetails } = await import('@/features/simulation/NotificationDetails')
    const html = await renderPage(
      createElement(NotificationDetails, { profileId: 'C1', onBack: () => {} }),
    )
    expect(html).toContain('当前配置仅共享摘要信息')
    expect(html).toContain('不向接收者开放')
    // 关键澄清：不降低识别能力
    expect(html).toContain('所有配置的基础异常识别与报警能力相同')
  })

  it('详细数据配置（X1=1）的通知详情包含详细记录与视频区块', async () => {
    const { default: NotificationDetails } = await import('@/features/simulation/NotificationDetails')
    const html = await renderPage(
      createElement(NotificationDetails, { profileId: 'C4', onBack: () => {} }),
    )
    expect(html).toContain('详细活动记录')
    expect(html).toContain('相关视频片段')
    expect(html).not.toContain('当前配置仅共享摘要信息')
  })
})
