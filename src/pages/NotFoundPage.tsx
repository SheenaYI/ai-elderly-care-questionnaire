import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import PageContainer from '@/components/layout/PageContainer'

/** 404 页面。不使用参与者导航之外的任何入口。 */
export default function NotFoundPage() {
  return (
    <PageContainer size="narrow">
      <p className="font-mono text-[0.8rem] uppercase tracking-[0.2em] text-sage-600">404</p>
      <h1 className="mt-3 text-[1.75rem] font-semibold text-forest-800">找不到这个页面</h1>
      <p className="mt-4 text-[1.05rem] leading-8 text-sage-700">
        您访问的地址可能已更改或不存在。您可以返回首页继续参与研究。
      </p>
      <Link
        to="/"
        className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-panel bg-forest-700 px-5 text-[1rem] font-semibold text-white transition hover:bg-forest-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        返回参与研究首页
      </Link>
    </PageContainer>
  )
}
