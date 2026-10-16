import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ScrollToTop from '@/components/layout/ScrollToTop'
import PageContainer from '@/components/layout/PageContainer'
import HomePage from '@/pages/HomePage'
import ExperiencePage from '@/pages/ExperiencePage'
import AboutPage from '@/pages/AboutPage'
import PrivacyPage from '@/pages/PrivacyPage'
import QuestionnairePage from '@/pages/QuestionnairePage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * 研究管理后台为懒加载，确保它**不会**被打进参与者端首屏包，
 * 也不出现在参与者导航中（SiteNav 中没有任何指向 /admin 的链接）。
 */
const AdminPage = lazy(() => import('@/features/admin/AdminPage'))

function RouteFallback() {
  return (
    <PageContainer size="narrow">
      <p role="status" className="text-[1rem] text-sage-700">
        正在加载…
      </p>
    </PageContainer>
  )
}

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          {/* 页面一：参与研究（首页） */}
          <Route path="/" element={<HomePage />} />
          {/* 页面二：情景体验 */}
          <Route path="/experience" element={<ExperiencePage />} />
          {/* 页面三：研究介绍 */}
          <Route path="/about" element={<AboutPage />} />
          {/* 页面四：隐私与知情同意 */}
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* 问卷流程（五个模块） */}
          <Route path="/questionnaire" element={<QuestionnairePage />} />
          <Route path="/questionnaire/:step" element={<QuestionnairePage />} />
          {/* 页面五：独立的研究管理后台 */}
          <Route
            path="/admin"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </>
  )
}
