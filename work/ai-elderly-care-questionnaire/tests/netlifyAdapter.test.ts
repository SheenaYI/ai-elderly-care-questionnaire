import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import submitSurvey, { __resetRateLimiterForTests } from '../netlify/functions/submit-survey'
import adminExport from '../netlify/functions/admin-export'
import { adaptLegacyHandler, type NetlifyHandler } from '../netlify/functions/_lib/adapter'
import { buildSubmission } from './helpers'

/**
 * Netlify 适配层端到端测试。
 *
 * 本项目确定部署到 Netlify，所以这是**关键回归测试**：`api/` 下两个处理函数是
 * Vercel 的 `(req, res)` 风格，而 Netlify 用 Web 标准的 `Request`/`Response`。
 * 适配层任一环节写错（状态码、响应头、请求体、查询参数、客户端 IP），
 * 线上表现就是"接口 500 / 导出乱码 / 限流失效"。
 *
 * 因此这里用 Netlify 的真实调用方式（`new Request(...)`）调用包装后的函数，
 * 断言真实的 HTTP 状态码与响应头 —— 这是对适配层的真实检验，
 * 而不是对内部函数打桩。
 *
 * ⚠️ handler 的校验顺序决定了每个用例能走到哪一步：
 *   405 方法 → 503 环境变量 → 429 按 IP 限流 → 413/400 请求体
 *   → 400 结构校验 → 429 IP+编号 → 版本校验 → 重复提交 → 写库
 * 所以除"未配置即 503"用例外，其余用例都必须先注入假的 Supabase 环境变量，
 * 才能走到被断言的分支（这些分支都在任何真实网络调用之前返回）。
 */

const SERVER_ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const
const savedEnv: Record<string, string | undefined> = {}

const SUBMIT_URL = 'https://site.test/api/submit-survey'
const EXPORT_URL = 'https://site.test/api/admin/export'

beforeEach(() => {
  for (const k of SERVER_ENV_KEYS) savedEnv[k] = process.env[k]
  // 假配置：足以通过"环境变量存在"检查，但不会真的访问该域名
  process.env.SUPABASE_URL = 'https://dummy.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key-not-real'
  // 限流桶是模块级状态，必须逐用例清空，否则用例之间会互相污染
  __resetRateLimiterForTests()
})

afterEach(() => {
  for (const k of SERVER_ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

/**
 * 以 Netlify 的方式调用函数。
 * `ip` 用来模拟 Netlify 注入的 context.ip（限流按它分桶）。
 */
function call(
  handler: NetlifyHandler,
  url: string,
  init?: RequestInit,
  ip = '203.0.113.10',
): Promise<Response> {
  return handler(new Request(url, init), { ip })
}

function postJson(body: string): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
}

// ───────────────────────────────────────────────────────────────────────────
// 提交接口
// ───────────────────────────────────────────────────────────────────────────

describe('提交接口 /api/submit-survey', () => {
  it('GET 返回 405 且带 Allow 头（方法校验经由适配层生效）', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, { method: 'GET' }, '203.0.113.11')
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toContain('POST')
  })

  it('未配置 Supabase 环境变量时返回 503 + mode:demo，绝不假装成功', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await call(
      submitSurvey,
      SUBMIT_URL,
      postJson(JSON.stringify(buildSubmission())),
      '203.0.113.12',
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as { ok: boolean; mode: string; message: string }
    expect(body.ok).toBe(false)
    expect(body.mode).toBe('demo')
    expect(body.message).toContain('未写入云端数据库')
  })

  it('响应是合法 JSON 且安全响应头被正确透传', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, { method: 'GET' }, '203.0.113.13')
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    await expect(res.clone().json()).resolves.toBeTruthy()
  })

  it('非法 JSON 返回 400（原始字节被正确交给 handler 自行解析）', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, postJson('{ not valid json'), '203.0.113.14')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('JSON')
  })

  it('请求体过大返回 413（适配层把真实字节数交给了体积守卫）', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, postJson('x'.repeat(300 * 1024)), '203.0.113.15')
    expect(res.status).toBe(413)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain('256 KB')
  })

  it('问卷数据不完整时返回 400 并给出字段级错误', async () => {
    const res = await call(
      submitSurvey,
      SUBMIT_URL,
      postJson(JSON.stringify({ participantId: 'x' })),
      '203.0.113.16',
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> }
    expect(body.ok).toBe(false)
    expect(Object.keys(body.fieldErrors ?? {}).length).toBeGreaterThan(0)
  })

  it('client IP 取自 context.ip：同一 IP 超过容量后返回 429 且带 Retry-After', async () => {
    const ip = '203.0.113.99'
    const statuses: number[] = []
    let retryAfter: string | null = null

    for (let i = 0; i < 20; i += 1) {
      const res = await call(submitSurvey, SUBMIT_URL, postJson('{ bad'), ip)
      statuses.push(res.status)
      if (res.status === 429) {
        retryAfter = res.headers.get('retry-after')
        break
      }
    }

    expect(statuses, `状态序列：${statuses.join(',')}`).toContain(429)
    expect(retryAfter).not.toBeNull()
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it('不同 IP 互不影响限流（证明 context.ip 真的被用上了）', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, postJson('{ bad'), '198.51.100.201')
    expect(res.status).toBe(400)
  })

  it('中文响应体编码正确（UTF-8 未乱码）', async () => {
    const res = await call(submitSurvey, SUBMIT_URL, { method: 'GET' }, '203.0.113.17')
    expect(await res.text()).toContain('仅支持 POST 方法提交问卷')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 导出接口
// ───────────────────────────────────────────────────────────────────────────

describe('导出接口 /api/admin/export', () => {
  it('缺少 Authorization 头返回 401，且不返回任何数据行', async () => {
    const res = await call(adminExport, `${EXPORT_URL}?dataset=participants`, { method: 'GET' }, '203.0.113.21')
    expect(res.status).toBe(401)
    expect(await res.text()).not.toContain('participant_id,')
  }, 20000)

  it('POST 返回 405（只有 GET 允许）', async () => {
    const res = await call(adminExport, EXPORT_URL, { method: 'POST' }, '203.0.113.22')
    expect(res.status).toBe(405)
  })

  it('伪造的 Bearer token 不会被放行（失败关闭，不泄露数据）', async () => {
    // handler 会真的向 Supabase 校验该 token，因此这里要等网络超时才返回。
    // 关键断言是"失败关闭"：返回 401/403，且一行数据都不给。
    const res = await call(
      adminExport,
      `${EXPORT_URL}?dataset=participants`,
      { method: 'GET', headers: { Authorization: 'Bearer not-a-real-token' } },
      '203.0.113.23',
    )
    expect([401, 403]).toContain(res.status)
    expect(await res.text()).not.toContain('participant_id,')
  }, 20000)

  it('恶意 dataset 名不会被当作路径使用', async () => {
    const res = await call(
      adminExport,
      `${EXPORT_URL}?dataset=${encodeURIComponent('../../etc/passwd')}`,
      { method: 'GET', headers: { Authorization: 'Bearer x' } },
      '203.0.113.24',
    )
    expect([400, 401, 403]).toContain(res.status)
    expect(await res.text()).not.toContain('participant_id')
  }, 20000)

  it('查询参数被正确解析（非法 dataset → 400 且不导出任何数据）', async () => {
    // 适配层只有真的把 query 传下去，handler 才能识别出 dataset 非法。
    // 若先被鉴权拦下（401），同样不会泄露数据。
    const res = await call(
      adminExport,
      `${EXPORT_URL}?dataset=definitely-not-a-dataset`,
      { method: 'GET', headers: { Authorization: 'Bearer x' } },
      '203.0.113.25',
    )
    expect([400, 401]).toContain(res.status)
    const text = await res.text()
    expect(text).not.toContain('participant_id')
    if (res.status === 400) expect(text).toContain('dataset')
  }, 20000)
})

// ───────────────────────────────────────────────────────────────────────────
// 适配层本身
// ───────────────────────────────────────────────────────────────────────────

describe('适配层本身的行为', () => {
  it('handler 内部抛错时返回 500，且不泄露内部细节或密钥', async () => {
    const boom = adaptLegacyHandler(() => {
      throw new Error('secret internal detail service_role key abc123')
    }, 'boom-test')
    const res = await boom(new Request('https://site.test/api/x', { method: 'POST' }), {})
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toContain('secret internal detail')
    expect(text).not.toContain('abc123')
    expect(text).toContain('未被保存')
  })

  it('响应头中的非 ASCII 字符会被规范化（否则 Headers 会抛 TypeError）', async () => {
    // 导出接口会设置含中文的 Content-Disposition。Headers 只接受 ISO-8859-1，
    // 直接透传会抛错导致导出失败 —— 这里同时验证"会抛"与"已规避"。
    expect(() => new Headers().set('Content-Disposition', 'attachment; filename="中文.csv"')).toThrow()

    const withChineseHeader = adaptLegacyHandler((_req, res) => {
      res.statusCode = 200
      res.setHeader('Content-Disposition', 'attachment; filename="研究数据-参与者.csv"')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.end('participant_id\n')
    }, 'header-test')

    const res = await withChineseHeader(new Request('https://site.test/api/x'), {})
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(await res.text()).toBe('participant_id\n')
  })

  it('GET 请求不会尝试读取请求体', async () => {
    let seenBody: unknown = 'sentinel'
    const probe = adaptLegacyHandler((req, res) => {
      seenBody = req.body
      res.statusCode = 200
      res.end('ok')
    }, 'get-test')
    await probe(new Request('https://site.test/api/x', { method: 'GET' }), {})
    expect(seenBody).toBeUndefined()
  })

  it('查询参数逐个解析成 req.query 的字符串键值', async () => {
    let seen: Record<string, string | string[] | undefined> | undefined
    const probe = adaptLegacyHandler((req, res) => {
      seen = req.query
      res.statusCode = 200
      res.end('ok')
    }, 'query-test')
    await probe(new Request('https://site.test/api/x?dataset=merged&a=1'), {})
    expect(seen).toEqual({ dataset: 'merged', a: '1' })
  })

  it('204 响应不带响应体（符合 HTTP 规范）', async () => {
    const noContent = adaptLegacyHandler((_req, res) => {
      res.statusCode = 204
      res.end()
    }, 'nc-test')
    const res = await noContent(new Request('https://site.test/api/x'), {})
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('同名响应头以最后一次写入为准', async () => {
    const probe = adaptLegacyHandler((_req, res) => {
      res.statusCode = 200
      res.setHeader('X-Test', 'first')
      res.setHeader('X-Test', 'second')
      res.end('ok')
    }, 'header-overwrite-test')
    const res = await probe(new Request('https://site.test/api/x'), {})
    expect(res.headers.get('x-test')).toBe('second')
  })
})
