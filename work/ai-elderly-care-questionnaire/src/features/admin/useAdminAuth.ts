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
    if (error) {
      // 不区分"账号不存在"与"密码错误"，避免账号枚举
      return { error: '登录失败：邮箱或密码不正确。' }
    }
    return { error: null }
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
