import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from '@/features/admin/AdminPage'

/**
 * 研究后台登录的错误分类测试。
 *
 * 背景（真实事故）：登录失败时前端把所有错误都映射成"邮箱或密码不正确"，
 * 于是"邮箱未确认"、"限流"、"网络不通"、"未启用邮箱登录"都会被误报成密码错误，
 * 排查方向完全跑偏。这里锁定"不同错误码给出可操作的不同提示"，
 * 同时确保**凭据类错误仍是统一措辞**（避免账号枚举）。
 */

// 用可变状态模拟 supabase-js 返回
let nextSignInResult: { error: { code?: string; status?: number; message?: string } | null } = {
  error: null,
}

const mockSupabase = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => nextSignInResult),
    signOut: vi.fn(async () => ({})),
  },
  rpc: vi.fn(async () => ({ data: false, error: null })),
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase,
  hasSupabase: () => true,
}))

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderLogin() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(MemoryRouter, null, createElement(AdminPage)))
  })
  await act(async () => {
    await Promise.resolve()
  })
  return container
}

/** 填表单并提交。 */
async function submit(email: string, password: string) {
  const c = container!
  const emailInput = c.querySelector<HTMLInputElement>('#admin-email')!
  const passwordInput = c.querySelector<HTMLInputElement>('#admin-password')!
  const submitButton = [...c.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('登录'),
  )!

  await act(async () => {
    const setValue = (el: HTMLInputElement, v: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setValue(emailInput, email)
    setValue(passwordInput, password)
  })
  await act(async () => {
    submitButton.click()
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return c.textContent ?? ''
}

beforeEach(() => {
  nextSignInResult = { error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSupabase.auth.signInWithPassword.mockClear()
})

afterEach(() => {
  if (root) {
    act(() => root!.unmount())
    root = null
  }
  container?.remove()
  container = null
  vi.restoreAllMocks()
})

describe('登录错误分类', () => {
  it('邮箱未确认时给出可操作提示（而不是"密码错误"）', async () => {
    nextSignInResult = { error: { code: 'email_not_confirmed', status: 400 } }
    await renderLogin()
    const text = await submit('a@example.com', 'whatever')
    expect(text).toContain('邮箱尚未确认')
    expect(text).toContain('Auto Confirm User')
    expect(text).not.toContain('邮箱或密码不正确')
  })

  it('登录限流时提示等待，而不是密码错误', async () => {
    nextSignInResult = { error: { code: 'over_request_rate_limit', status: 429 } }
    await renderLogin()
    const text = await submit('a@example.com', 'whatever')
    expect(text).toContain('过于频繁')
    expect(text).not.toContain('邮箱或密码不正确')
  })

  it('未启用邮箱登录时提示去开启 Provider', async () => {
    nextSignInResult = { error: { code: 'email_provider_disabled', status: 400 } }
    await renderLogin()
    const text = await submit('a@example.com', 'whatever')
    expect(text).toContain('未启用邮箱密码登录')
  })

  it('账号被禁用时提示联系负责人', async () => {
    nextSignInResult = { error: { code: 'user_banned', status: 403 } }
    await renderLogin()
    const text = await submit('a@example.com', 'whatever')
    expect(text).toContain('已被禁用')
  })

  it('网络不通（无 code、无 status）时提示检查连接与 URL', async () => {
    nextSignInResult = { error: { status: 0 } }
    await renderLogin()
    const text = await submit('a@example.com', 'whatever')
    expect(text).toContain('无法连接到')
    expect(text).toContain('VITE_SUPABASE_URL')
  })

  it('凭据错误保持统一措辞（避免账号枚举）', async () => {
    // 不存在的账号
    nextSignInResult = { error: { code: 'user_not_found', status: 400 } }
    await renderLogin()
    const notFound = await submit('nobody@example.com', 'x')
    expect(notFound).toContain('邮箱或密码不正确')

    // 密码错误（Supabase 也可能返回无具体码的 400）
    nextSignInResult = { error: { status: 400 } }
    await renderLogin()
    const wrongPassword = await submit('real@example.com', 'x')
    expect(wrongPassword).toContain('邮箱或密码不正确')

    // 两者措辞必须一致，不能泄露账号是否存在
    const extract = (t: string) => /登录失败：[^。]+。/.exec(t)?.[0] ?? ''
    expect(extract(notFound)).toBe(extract(wrongPassword))
  })

  it('把错误码写进控制台（仅码与状态，不含邮箱/密码）', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    nextSignInResult = { error: { code: 'email_not_confirmed', status: 400 } }
    await renderLogin()
    await submit('secret@example.com', 'super-secret-password')

    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('email_not_confirmed')
    expect(logged).not.toContain('secret@example.com')
    expect(logged).not.toContain('super-secret-password')
  })
})
