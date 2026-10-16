/**
 * Netlify Functions ↔ Vercel 风格 handler 的适配层。
 *
 * 背景：`api/` 下的两个处理函数（`submit-survey.ts`、`admin/export.ts`）是按
 * Vercel 的 `(req, res)` 风格写的，而 Netlify Functions 用的是 Web 标准的
 * `Request` / `Response`。本项目确定部署到 Netlify，因此在**不修改业务逻辑**的
 * 前提下，用一个薄适配层把两种风格对接起来：
 *
 *     Netlify Request  →  Vercel 风格 req/res  →  Netlify Response
 *
 * 这样做的价值：提交与导出**只有一份实现**，Vercel / Netlify 共用。
 * 若以后改回 Vercel，删掉本目录与 netlify.toml 的 redirects 即可，业务代码零改动。
 *
 * 类型说明：项目未安装 @netlify/functions，因此这里自声明最小类型，
 * 避免为了类型而引入新依赖（与 `api/` 里自声明 Vercel 类型同理）。
 */

// ───────────────────────────────────────────────────────────────────────────
// 最小类型声明
// ───────────────────────────────────────────────────────────────────────────

/** 与 api/ 中自声明的 ApiRequest 结构一致（此处不 import，保持适配层独立）。 */
export interface LegacyRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string | undefined } | undefined
}

/** 与 api/ 中自声明的 ApiResponse 结构一致。 */
export interface LegacyResponse {
  statusCode: number
  setHeader(name: string, value: string | number | readonly string[]): void
  end(chunk?: string): void
}

/** 旧版风格处理函数。 */
export type LegacyHandler = (
  req: LegacyRequest,
  res: LegacyResponse,
) => void | Promise<void>

/** Netlify 函数的 context（只声明本适配层需要读取的字段）。 */
export interface NetlifyContext {
  requestId?: string
  ip?: string
  geo?: unknown
  [key: string]: unknown
}

/**
 * 适配后得到的 Netlify 函数签名。
 *
 * 注意：context 参数声明为 `unknown`，这样既能接收 Netlify 官方传入的
 * 完整 context 对象（其结构比本适配层需要的字段多得多），
 * 也允许测试传入简化对象。实际使用时在函数内部收窄。
 */
export type NetlifyHandler = (request: Request, context?: unknown) => Promise<Response>

// ───────────────────────────────────────────────────────────────────────────
// 头部归一化
// ───────────────────────────────────────────────────────────────────────────

/**
 * 把任意 header 值整理成**纯 ASCII** 字符串。
 *
 * 为什么必须做：`Headers` 只接受 ISO-8859-1 可表示的字符。导出接口会返回
 * `Content-Disposition: attachment; filename="…中文…"`，若直接透传，
 * 构造 Response 时会抛 `TypeError: Invalid header value`，导出直接挂掉。
 * 这里把非 ASCII 字符替换为 `_`，中文文件名由前端自行决定（见 admin 页）。
 */
function toAsciiHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x20-\x7E]/g, '_')
}

function normalizeHeaders(
  input: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!input) return out
  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined) continue
    out[key.toLowerCase()] = Array.isArray(raw) ? raw.join(', ') : raw
  }
  return out
}

/** 推断客户端 IP：优先 Netlify 注入的头，其次 X-Forwarded-For。 */
function resolveClientIp(request: Request, context?: NetlifyContext): string {
  if (context && typeof context.ip === 'string' && context.ip) return context.ip
  const nfIp = request.headers.get('x-nf-client-connection-ip')
  if (nfIp) return nfIp
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return 'unknown'
}

// ───────────────────────────────────────────────────────────────────────────
// 适配主体
// ───────────────────────────────────────────────────────────────────────────

/** 收集旧版 res 写入的状态、头与响应体。 */
function createResponseCollector() {
  let statusCode = 200
  let ended = false
  let body = ''
  const headers = new globalThis.Headers()

  const res: LegacyResponse = {
    get statusCode() {
      return statusCode
    },
    set statusCode(value: number) {
      statusCode = value
    },
    setHeader(name, value) {
      // 同名头以最后一次为准（与 Node http 的 setHeader 行为一致）
      headers.set(name, toAsciiHeaderValue(Array.isArray(value) ? value.join(', ') : String(value)))
    },
    end(chunk) {
      if (ended) return
      ended = true
      if (typeof chunk === 'string') body = chunk
      else if (chunk !== undefined) body = String(chunk)
    },
  }

  return {
    res,
    finish(): Response {
      // 204 / 304 不允许带响应体
      const headless = statusCode === 204 || statusCode === 304
      const bytes = headless ? null : new TextEncoder().encode(body)
      return new Response(bytes, { status: statusCode, headers })
    },
  }
}

/**
 * 把一个旧版风格 handler 包装成 Netlify 函数。
 *
 * @param handler api/ 下的处理函数
 * @param name    用于错误信息与日志标识（不输出任何研究数据）
 */
export function adaptLegacyHandler(handler: LegacyHandler, name: string): NetlifyHandler {
  return async function netlifyHandler(request: Request, rawContext?: unknown): Promise<Response> {
    const context = (rawContext ?? undefined) as NetlifyContext | undefined
    try {
      const url = new URL(request.url)
      const query: Record<string, string> = {}
      url.searchParams.forEach((value, key) => {
        query[key] = value
      })

      // 读取原始请求体：交给 handler 自己解析（它同时支持 string / Buffer / 已解析对象）
      let body: unknown
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const buffer = await request.arrayBuffer()
        body = buffer.byteLength > 0 ? Buffer.from(buffer) : undefined
      }

      const legacyReq: LegacyRequest = {
        method: request.method,
        url: url.pathname + url.search,
        headers: normalizeHeaders(
          Object.fromEntries(request.headers.entries()) as Record<string, string>,
        ),
        query,
        body,
        socket: { remoteAddress: resolveClientIp(request, context) },
      }

      const collector = createResponseCollector()
      await handler(legacyReq, collector.res)
      return collector.finish()
    } catch {
      // 只记录函数名，绝不输出请求体、密钥或任何研究数据
      console.error(`[netlify:${name}] unhandled error while processing request`)
      return new Response(
        JSON.stringify({
          ok: false,
          mode: 'supabase',
          message: '服务器处理请求时发生内部错误，本次数据未被保存。请稍后重试。',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
      )
    }
  }
}
