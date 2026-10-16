/**
 * Supabase 浏览器客户端。
 *
 * 安全说明：
 *   - 只使用 **anon 公钥**。该密钥本身是公开的，安全性由
 *     Row Level Security（RLS）策略保证，而不是靠隐藏密钥。
 *   - 本文件**不**读取、不引用、不打印 service_role key。
 *   - 匿名参与者无法读取他人的答案：见 supabase/migrations 中的 RLS 策略。
 *   - 未配置环境变量时返回 null，界面进入 Demo 模式，不崩溃。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

let cached: SupabaseClient | null = null

/**
 * 取得 Supabase 客户端；未配置公开环境变量时返回 null。
 * 调用方必须处理 null（进入 Demo 模式）。
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null
  if (cached) return cached

  cached = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // 管理后台使用邮箱密码登录；参与者端不涉及账号
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-application-name': 'ai-elderly-care-questionnaire' },
    },
  })
  return cached
}

/** 是否具备可用的 Supabase 客户端。 */
export function hasSupabase(): boolean {
  return getSupabaseClient() !== null
}
