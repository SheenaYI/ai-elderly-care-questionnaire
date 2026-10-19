import { useCallback, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

/**
 * 研究管理后台的身份认证。
 *
 * 安全模型：
 *   1. 使用 Supabase Auth（邮箱 + 密码）登录。
 *   2. **授权**由数据库侧的 `research_admins` 白名单 + RLS 策略决定，
 *      而不是由前端决定。前端调用 `is_research_admin()` 只是为了给出
 *      友好的界面反馈；即使前端被绕过，数据库仍会拒绝返回数据。
 *   3. 未经认证的访问一律被拒绝。**不存在**前端写死的管理员密码。
 *   4. 隐藏 URL 不构成保护。
 */

export type AdminAuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'unauthorized'; email: string | null }
  | { status: 'authorized'; email: string | null; userId: string }

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({ status: 'loading' })

  const evaluate = useCallback(async (session: Session | null) => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setState({ status: 'unconfigured' })
      return
    }
    if (!session?.user) {
      setState({ status: 'signed-out' })
      return
    }

    // 用数据库侧的 SECURITY DEFINER 函数判定是否为授权研究人员
    const { data, error } = await supabase.rpc('is_research_admin')
    if (error) {
      // RPC 不存在或权限不足：保守地视为未授权，不开放任何管理数据
      setState({ status: 'unauthorized', email: session.user.email ?? null })
      return
    }
    if (data === true) {
      setState({
        status: 'authorized',
        email: session.user.email ?? null,
        userId: session.user.id,
      })
    } else {
      setState({ status: 'unauthorized', email: session.user.email ?? null })
    }
  }, [])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setState({ status: 'unconfigured' })
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) void evaluate(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void evaluate(session)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [evaluate])

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient()
    if (!supabase) return { error: '未配置 Supabase，无法登录。' }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }

    // 把 Supabase 的错误分类后给参与者/研究者可操作的提示。
    //
    // 安全考量：只在**不泄露账号是否存在**的前提下细化提示。
    //   - 凭据错误（Supabase 返回 user_not_found 或 400 无具体码）
    //     → 统一为"邮箱或密码不正确"，
    //     避免他人用它探测哪些邮箱已被注册。
    //   - email_not_confirmed / rate limit / 网络错误 → 与账号是否存在无关，
    //     可以明确告知，否则排查会被"密码错误"误导（曾发生）。
    //
    // 另外把错误码写进控制台（仅错误码，不含邮箱、密码或 token），
    // 方便开发者不打开 Network 面板也能定位。
    // AuthError 已声明 code / status（见 @supabase/auth-js 的 errors.d.ts），无需断言
    const code = error.code ?? ''
    const status = error.status ?? 0
    // eslint-disable-next-line no-console
    console.error('[admin-signin] code=%s status=%s', code || 'unknown', status)

    if (code === 'email_not_confirmed') {
      return {
        error:
          '该邮箱尚未确认，因此无法登录。请在 Supabase 控制台的 Authentication → Users 中确认该用户（或删除后重建并勾选 Auto Confirm User）。',
      }
    }
    // 登录限流的真实错误码是 over_request_rate_limit；
    // over_email_send_rate_limit 只用于"发送邮件"场景（如重置密码），这里一并兜住。
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || status === 429) {
      return { error: '操作过于频繁，已被暂时限制，请等待约一分钟后再试。' }
    }
    if (code === 'user_banned') {
      return { error: '该账号已被禁用，请联系研究团队负责人。' }
    }
    if (code === 'signup_disabled' || code === 'email_provider_disabled') {
      return {
        error:
          '该项目未启用邮箱密码登录。请在 Supabase 控制台的 Authentication → Sign In / Providers 中启用 Email。',
      }
    }
    // 网络/DNS/CORS 等：没有 code 且不是凭据错误
    if (!code && status === 0) {
      return {
        error:
          '无法连接到 Authentication 服务。请检查网络连接，并确认 VITE_SUPABASE_URL 是否填写正确。',
      }
    }
    // 其余（含 invalid_credentials / user_not_found）统一措辞，避免账号枚举
    return { error: '登录失败：邮箱或密码不正确。如刚创建账号，请确认已在 Supabase 中完成邮箱确认。' }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return
    await supabase.auth.signOut()
    setState({ status: 'signed-out' })
  }, [])

  return { state, signIn, signOut }
}

/** 供导出接口使用：读取当前 access token 作为 Bearer 凭据。 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export type { User }
