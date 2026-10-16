import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  BookOpen,
  ClipboardList,
  Menu,
  MonitorPlay,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { STUDY_TITLE } from '@/data/questionnaire'

/**
 * 网站导航。
 *
 * 布局策略：
 *   - **桌面端（lg 及以上）**：固定在**左侧**的纵向导航栏，常驻显示，
 *     页面内容在右侧。当前项高亮，带轻微 hover 动画。
 *   - **移动端（小于 lg）**：折叠为**顶部**一条窄品牌栏 + "菜单"按钮，
 *     点击后从左侧滑出抽屉。移动端不常驻显示导航，避免占用主要内容空间，
 *     也避免出现"菜单跑到页面中间"之类的排版问题。
 *
 * 可访问性：Esc 关闭抽屉、打开时焦点进入抽屉、Tab 焦点循环、
 * 关闭后焦点回到触发按钮、`aria-expanded` / `aria-controls` 齐备。
 */

export interface NavItem {
  to: string
  /** 两位编号，用于编辑式排版。 */
  index: string
  label: string
  description: string
  Icon: typeof ClipboardList
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/',
    index: '01',
    label: '参与研究',
    description: '了解研究并开始填写问卷',
    Icon: ClipboardList,
  },
  {
    to: '/experience',
    index: '02',
    label: '情景体验',
    description: '体验不同监测配置的运行方式',
    Icon: MonitorPlay,
  },
  {
    to: '/about',
    index: '03',
    label: '研究介绍',
    description: '研究背景、问题与方法',
    Icon: BookOpen,
  },
  {
    to: '/privacy',
    index: '04',
    label: '隐私与知情同意',
    description: '数据如何被收集与保护',
    Icon: ShieldCheck,
  },
] as const

function NavLinkItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { Icon } = item
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex min-h-[3.25rem] items-center gap-3 rounded-panel px-3 py-2.5 transition-colors duration-200',
          isActive ? 'bg-forest-700 text-white shadow-selected' : 'text-forest-800 hover:bg-forest-50',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-control transition-colors duration-200',
              isActive ? 'bg-white/15 text-white' : 'bg-sage-100 text-forest-700 group-hover:bg-white',
            )}
            aria-hidden="true"
          >
            <Icon className="h-[1.15rem] w-[1.15rem]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  'font-mono text-[0.7rem] tabular-nums tracking-wider',
                  isActive ? 'text-white/70' : 'text-sage-600',
                )}
                aria-hidden="true"
              >
                {item.index}
              </span>
              <span className="text-[1.0625rem] font-semibold leading-tight">{item.label}</span>
            </span>
            <span
              className={cn(
                'mt-0.5 block text-[0.8rem] leading-snug',
                isActive ? 'text-white/75' : 'text-sage-700',
              )}
            >
              {item.description}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )
}

/** 网站标识。 */
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-3 rounded-panel p-1 transition-colors hover:bg-forest-50"
      aria-label={`返回首页 — ${STUDY_TITLE}`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-forest-700 text-white"
        aria-hidden="true"
      >
        {/* 抽象标记：守护 / 连接 */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3.2 5 6.1v5.3c0 4.2 2.9 7.6 7 9.4 4.1-1.8 7-5.2 7-9.4V6.1z" strokeLinejoin="round" />
          <circle cx="12" cy="11.4" r="2.3" />
          <path d="M12 13.7v3.1" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sage-600">
            AIECQ · 科研问卷
          </span>
          <span className="mt-0.5 block text-[0.9rem] font-semibold leading-snug text-forest-800">
            智能养老AI监测
          </span>
        </span>
      )}
    </Link>
  )
}

export default function SiteNav() {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const drawerId = useId()
  const location = useLocation()

  // 路由变化时关闭移动端抽屉
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // 抽屉打开时：锁定滚动、焦点进入、Esc 关闭、焦点循环
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('[data-drawer-first]')?.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        toggleRef.current?.focus()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <>
      {/* ── 桌面端：左侧固定导航 ─────────────────────────────── */}
      <aside
        className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-sage-200 bg-cream-100/85 px-3.5 py-6 backdrop-blur lg:flex xl:w-[16rem]"
        aria-label="网站导航"
      >
        <BrandMark />

        <nav className="mt-6 flex flex-1 flex-col gap-1.5" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLinkItem key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-6 border-t border-sage-200 pt-5">
          <p className="text-[0.78rem] leading-relaxed text-sage-700">
            本研究仅用于学术研究。
            <br />
            自愿参与，可随时退出。
          </p>
          <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-widest text-sage-600">
            ｜凡参与研究前请阅读知情同意
          </p>
        </div>
      </aside>

      {/* ── 移动端：顶部窄品牌栏（lg 以下显示） ───────────────── */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-sage-200 bg-cream-100/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <BrandMark />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-controls={drawerId}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-panel border border-forest-700 px-3.5 text-[0.95rem] font-semibold text-forest-800 transition-colors hover:bg-forest-50"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          菜单
        </button>
      </div>

      {/* ── 移动端抽屉（自左侧滑出） ─────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-forest-900/55 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-cream-100 shadow-modal animate-slide-in-left"
            role="dialog"
            aria-modal="true"
            aria-label="网站导航"
          >
            <div className="flex items-center justify-between gap-3 border-b border-sage-200 px-4 py-3.5">
              <p className="text-[1.05rem] font-semibold text-forest-800">导航</p>
              <button
                data-drawer-first
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  toggleRef.current?.focus()
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-panel text-forest-800 transition-colors hover:bg-forest-50"
                aria-label="关闭导航菜单"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3" aria-label="主导航">
              {NAV_ITEMS.map((item) => (
                <NavLinkItem key={item.to} item={item} onNavigate={() => setIsOpen(false)} />
              ))}
            </nav>

            <div className="border-t border-sage-200 px-4 py-4">
              <p className="text-[0.82rem] leading-relaxed text-sage-700">
                本研究仅用于学术研究。自愿参与，可随时退出。
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
