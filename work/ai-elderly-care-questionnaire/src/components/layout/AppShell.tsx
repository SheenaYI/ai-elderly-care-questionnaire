import { Outlet, useLocation } from 'react-router-dom'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

/**
 * 网站外壳。
 *
 * 桌面端：左侧主要内容区 + 右侧固定导航栏。
 * 移动端：右侧导航折叠为顶部菜单，主内容占满整宽。
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

      <div className="mx-auto flex w-full max-w-content flex-row-reverse">
        {/* 右侧固定导航（桌面端） */}
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
