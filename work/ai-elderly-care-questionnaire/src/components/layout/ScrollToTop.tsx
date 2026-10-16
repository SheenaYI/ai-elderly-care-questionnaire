import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** 路由变化时回到页面顶部，避免参与者停留在上一页的滚动位置。 */
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return null
}
