/**
 * 运行时环境配置。
 *
 * 安全约束（重要）：
 *   - 前端只允许使用 Supabase **公开** 客户端配置：
 *       VITE_SUPABASE_URL          （项目 URL，公开）
 *       VITE_SUPABASE_ANON_KEY     （anon 公钥，公开，受 RLS 约束）
 *   - 严禁在前端出现 service_role key、数据库密码、管理员密钥或任何 PAT。
 *     service_role key 只允许存在于服务端环境变量（Vercel/Netlify Secrets）。
 *   - 本文件不读取、不打印、不记录任何密钥值。
 */

interface RuntimeConfig {
  /** Supabase 项目 URL，未配置时为 null。 */
  supabaseUrl: string | null
  /** Supabase anon 公钥，未配置时为 null。 */
  supabaseAnonKey: string | null
  /** 是否已具备前端直连 Supabase 的公开配置。 */
  hasSupabaseClientConfig: boolean
  /** 提交接口路径。 */
  submitEndpoint: string
  /** 问卷版本号（与 src/data/questionnaire.ts 保持一致，供服务端校验）。 */
  questionnaireVersion: string
  /** 是否允许在未配置后端时以 Demo 模式运行。 */
  allowDemoMode: boolean
}

function readEnv(key: string): string | null {
  // import.meta.env 由 Vite 注入；类型定义见 src/vite-env.d.ts
  const value = (import.meta.env as Record<string, string | undefined>)[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const config: RuntimeConfig = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  get hasSupabaseClientConfig() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  },
  submitEndpoint: readEnv('VITE_SUBMIT_ENDPOINT') ?? '/api/submit-survey',
  questionnaireVersion: readEnv('VITE_QUESTIONNAIRE_VERSION') ?? 'V1.0',
  // Demo 模式默认仅在开发环境开放；生产环境必须配置后端。
  allowDemoMode:
    readEnv('VITE_ALLOW_DEMO_MODE') === 'true' ||
    // 开发环境默认允许 Demo 模式；生产环境必须显式开启
    Boolean(import.meta.env.DEV),
}

/**
 * 当前数据落库模式。
 *
 * ⚠️ Demo 模式表示数据**没有**写入云端数据库，必须向用户明确区分，
 *    绝不能表现为"提交成功并保存到服务器"。
 */
export type DataMode = 'demo' | 'supabase'

export function detectDataMode(): DataMode {
  return config.hasSupabaseClientConfig ? 'supabase' : 'demo'
}

/** 面向界面展示的模式说明。 */
export function dataModeNotice(): { mode: DataMode; title: string; detail: string } {
  const mode = detectDataMode()
  if (mode === 'supabase') {
    return {
      mode,
      title: '真实数据提交模式',
      detail: '已检测到 Supabase 配置，提交的数据将写入云端数据库。',
    }
  }
  return {
    mode,
    title: 'Demo 模式（数据不会保存到云端）',
    detail:
      '当前未配置 Supabase 后端连接，问卷可以完整填写，但提交后数据仅保留在您本人的浏览器中，用于内部试填与演示。请勿在此模式下收集真实研究数据。',
  }
}
