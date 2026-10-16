import { Outlet, useLocation } from 'react-router-dom'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

/**
 * 网站外壳。
 *
 * 桌面端（lg 及以上）：**左侧固定导航栏** + 右侧主要内容区。
 * 移动端：导航折叠为顶部一条窄品牌栏（含"菜单"按钮），主内容占满整宽。
 *
 * 说明：外层使用普通的 `flex`（不是 `flex-row-reverse`），导航作为第一个
 * 子元素自然落在左侧；移动端导航为 `static` 顶部栏，因此不会挤压内容宽度。
 */
export default function AppShell() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  // 管理后台使用独立布局，不与参与者导航混用
  if (isAdmin) {
    return (
      <div className="min-h-screen">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only-focusable absolute left-4 top-4 z-[60] inline-flex min-h-11 items-center rounded-panel bg-forest-700 px-4 text-[0.95rem] font-semibold text-white"
      >
        跳到主要内容
      </a>

      <div className="mx-auto flex w-full max-w-content flex-col lg:flex-row">
        {/* 左侧固定导航（桌面端）／顶部折叠菜单（移动端） */}
        <SiteNav />

        {/* 主内容区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main-content" className="flex-1" tabIndex={-1}>
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </div>
    </div>
  )
}
