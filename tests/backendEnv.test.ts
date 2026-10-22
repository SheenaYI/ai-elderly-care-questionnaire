import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import submitSurvey from '../netlify/functions/submit-survey'
import adminExport from '../netlify/functions/admin-export'
import { buildSubmission } from './helpers'

/**
 * 服务端环境变量处理测试。
 *
 * 背景（实测中真实发生的配置错误）：
 *   1. SUPABASE_URL 末尾带了 `/rest/v1`（从 API 页面复制了 "RESTful endpoint"）。
 *      supabase-js 会在 base URL 后直接拼 `/auth/v1`、`/rest/v1`，
 *      于是请求变成 `/rest/v1/rest/v1/...` → 全部失败。
 *   2. 把 service_role 与 anon key 填反 / 填错行。
 *
 * 这里锁定两点：
 *   - 带路径后缀的 URL 会被归一化成 origin，不会把脏值发出去；
 *   - 非法 URL 被视为"未配置"，接口明确返回 503 而不是抛出异常。
 */

const KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k]
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.restoreAllMocks()
})

function callSubmit(ip: string) {
  return submitSurvey(
    new Request('https://site.test/api/submit-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSubmission()),
    }),
    { ip },
  )
}

describe('SUPABASE_URL 归一化', () => {
  it('带 /rest/v1 后缀时不报"未配置"，而是继续处理', async () => {
    // 归一化后 origin 有效 → 不会走 503 分支。
    // 因为假域名无法真正写库，最终会因网络失败返回 5xx；
    // 关键是：**不能**因为后缀而错误地判定为"未配置"。
    process.env.SUPABASE_URL = 'https://dummy.supabase.co/rest/v1'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key-not-real'

    const res = await callSubmit('198.51.100.61')
    expect(res.status).not.toBe(503)
  }, 20000)

  it('URL 完全非法时视为未配置，返回 503（而不是抛异常）', async () => {
    process.env.SUPABASE_URL = 'not-a-url'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key'

    const res = await callSubmit('198.51.100.62')
    expect(res.status).toBe(503)
    const body = (await res.json()) as { mode: string; message: string }
    expect(body.mode).toBe('demo')
    expect(body.message).toContain('未写入云端数据库')
  })

  it('只填空格时视为未配置', async () => {
    process.env.SUPABASE_URL = '   '
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key'

    const res = await callSubmit('198.51.100.63')
    expect(res.status).toBe(503)
  })

  it('导出接口同样：非法 URL 返回 503 而不是崩溃', async () => {
    process.env.SUPABASE_URL = 'not-a-url'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key'

    const res = await adminExport(
      new Request('https://site.test/api/admin/export?dataset=participants', {
        method: 'GET',
        headers: { Authorization: 'Bearer whatever' },
      }),
      { ip: '198.51.100.64' },
    )
    expect(res.status).toBe(503)
  })
})
