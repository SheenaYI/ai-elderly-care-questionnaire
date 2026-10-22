/**
 * POST /api/submit-survey — 问卷提交服务端接口（Vercel Serverless / Node 运行时）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 链路：前端表单 →（本接口）→ 校验 → Supabase `public.submit_survey(payload)` 单事务写入
 *
 * 本接口的职责（服务端是唯一的权威校验点，绝不信任客户端结论）：
 *   1. 只接受 POST，其余方法一律 405；
 *   2. 读取 JSON 请求体并做体积守卫（> 256 KB 直接拒绝）；
 *   3. 内存令牌桶限流（IP + participant_id 两个维度）；
 *   4. 用 src/lib/validation/schemas.ts 的 submissionSchema 做结构校验，
 *      再用 validateSubmissionSemantics() 做研究语义校验（与前端同一份规则）；
 *   5. 校验问卷版本：既要比对代码中的 QUESTIONNAIRE_VERSION 常量，
 *      也要确认该版本已在 questionnaire_versions 登记且 is_active = true；
 *   6. 重复提交检查：同一 participant_id 若已 submitted，返回 409；
 *   7. 通过 service_role 调用 submit_survey() RPC —— 7 张表在一个事务内写入。
 *
 * 安全约定（务必遵守）：
 *   * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 只从 process.env 读取，
 *     **绝不**写入响应、日志、错误信息或前端代码。
 *   * 本文件不打印任何研究数据（请求体、答案、邮箱一律不进日志）。
 *     日志只允许出现"事件名 + 错误码"。
 *   * 环境变量缺失时返回 503 + mode: 'demo'，明确说明"未保存"，
 *     绝不伪装成功。
 *
 * 生产环境注意：
 *   * 内存限流只在单个实例内有效；多实例/冷启动会重置。正式收集数据时
 *     应换成durable 存储（如 Upstash Redis、Postgres 表或 Vercel KV）。
 *   * 同源部署（前端与 /api 同域）时浏览器不会发送 CORS 预检；
 *     若前后端跨域部署，需要另行处理 OPTIONS 与 CORS 头。
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { submissionSchema, validateSubmissionSemantics } from '../src/lib/validation/schemas'
import type { SemanticProblem, SubmissionInput } from '../src/lib/validation/schemas'
import { COMPREHENSION_QUESTION_BY_ID, QUESTIONNAIRE_VERSION } from '../src/data/questionnaire'

// ───────────────────────────────────────────────────────────────────────────
// 0. Vercel 函数类型的最小自声明
//    项目未安装 @vercel/node，因此不 import 任何缺失依赖，只声明实际用到的成员。
//    （若日后引入 @vercel/node，可替换为 VercelRequest / VercelResponse。）
// ───────────────────────────────────────────────────────────────────────────

export interface ApiRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  /** Vercel/Node 运行时通常已把 application/json 解析为对象；也可能是字符串或 Buffer。 */
  body?: unknown
  socket?: { remoteAddress?: string | undefined } | undefined
}

export interface ApiResponse {
  statusCode: number
  setHeader(name: string, value: string | number | readonly string[]): void
  end(chunk?: string): void
}

// ───────────────────────────────────────────────────────────────────────────
// 1. 常量与响应类型
// ───────────────────────────────────────────────────────────────────────────

/** 请求体体积上限：256 KB（一份完整问卷约 20–40 KB，留足余量）。 */
const MAX_BODY_BYTES = 256 * 1024

/** 限流：每桶容量 12 次，按 0.2 次/秒回填（≈ 12 次/分钟）。 */
const RATE_LIMIT_CAPACITY = 12
const RATE_LIMIT_REFILL_PER_SECOND = 0.2
/** 空闲超过 10 分钟的桶会被清理，避免限制被长期占用。 */
const RATE_LIMIT_IDLE_MS = 10 * 60 * 1000
/** 内存桶数量上限（防止被大量不同 IP 撑爆内存）。 */
const RATE_LIMIT_MAX_KEYS = 5000

/** 返回给客户端的字段级错误数量上限。 */
const MAX_FIELD_ERRORS = 40

export interface SubmitSuccessBody {
  ok: true
  mode: 'supabase'
  message: string
  participantId: string
}

export interface SubmitErrorBody {
  ok: false
  mode: 'demo' | 'supabase'
  message: string
  fieldErrors?: Record<string, string>
  problems?: SemanticProblem[]
}

type SubmitResponseBody = SubmitSuccessBody | SubmitErrorBody

// ───────────────────────────────────────────────────────────────────────────
// 2. RPC 载荷类型（在 SurveySubmission 基础上补充两个服务端字段）
// ───────────────────────────────────────────────────────────────────────────

/** 服务端根据选项索引还原出的选项文字，便于 CSV 直接阅读。 */
type RpcComprehensionRecord = SubmissionInput['comprehension'][number] & { firstAnswer: string }

/**
 * 传给 public.submit_survey(jsonb) 的载荷。
 * 字段名与前端 SurveySubmission 完全一致（camelCase），由 RPC 内部负责落到 snake_case 列。
 */
type SubmitSurveyRpcPayload = Omit<SubmissionInput, 'comprehension'> & {
  comprehension: RpcComprehensionRecord[]
  /** 提交请求的 User-Agent（仅用于兼容性排查）。 */
  userAgent?: string
}

// ───────────────────────────────────────────────────────────────────────────
// 3. 安全日志（只记事件名与错误码，绝不记录研究数据或密钥）
// ───────────────────────────────────────────────────────────────────────────

function logEvent(event: string, code?: string): void {
  console.error(code ? `[submit-survey] ${event} code=${code}` : `[submit-survey] ${event}`)
}

// ───────────────────────────────────────────────────────────────────────────
// 4. 请求头 / IP 工具
// ───────────────────────────────────────────────────────────────────────────

function readHeader(req: ApiRequest, name: string): string | null {
  const headers = req.headers
  if (!headers) return null
  const raw = headers[name.toLowerCase()] ?? headers[name]
  if (Array.isArray(raw)) {
    const first = raw[0]
    return typeof first === 'string' && first.trim().length > 0 ? first.trim() : null
  }
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

/**
 * 取客户端 IP。Vercel 会覆盖 x-forwarded-for，因此该值在平台上是可信的；
 * 但限流本身仍是尽力而为（见文件头"生产环境注意"）。
 */
function readClientIp(req: ApiRequest): string {
  const forwarded = readHeader(req, 'x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = readHeader(req, 'x-real-ip')
  if (realIp) return realIp
  return req.socket?.remoteAddress ?? 'unknown'
}

// ───────────────────────────────────────────────────────────────────────────
// 5. 请求体读取 + 体积守卫
// ───────────────────────────────────────────────────────────────────────────

type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; message: string }

function tooLarge(): BodyResult {
  return {
    ok: false,
    status: 413,
    message: `请求体过大（上限 ${Math.floor(MAX_BODY_BYTES / 1024)} KB），已拒绝。请勿在问卷中附带文件或视频。`,
  }
}

function readJsonBody(req: ApiRequest): BodyResult {
  // 5.1 Content-Length 预检（能挡住绝大多数超大请求，避免白读一遍）
  const declared = readHeader(req, 'content-length')
  if (declared) {
    const bytes = Number.parseInt(declared, 10)
    if (Number.isFinite(bytes) && bytes > MAX_BODY_BYTES) return tooLarge()
  }

  const raw = req.body
  if (raw === undefined || raw === null) {
    return { ok: false, status: 400, message: '请求体为空，未收到问卷数据。' }
  }

  // 5.2 字符串：自行解析并复核真实字节数
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return tooLarge()
    try {
      return { ok: true, value: JSON.parse(raw) as unknown }
    } catch {
      return { ok: false, status: 400, message: '请求体不是合法的 JSON。' }
    }
  }

  // 5.3 Buffer：先看长度再解码
  if (Buffer.isBuffer(raw)) {
    if (raw.byteLength > MAX_BODY_BYTES) return tooLarge()
    try {
      return { ok: true, value: JSON.parse(raw.toString('utf8')) as unknown }
    } catch {
      return { ok: false, status: 400, message: '请求体不是合法的 JSON。' }
    }
  }

  // 5.4 运行时已解析为对象：仍按序列化后的字节数复核一次
  if (typeof raw === 'object') {
    let serialized: string
    try {
      serialized = JSON.stringify(raw)
    } catch {
      return { ok: false, status: 400, message: '无法序列化请求体。' }
    }
    if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) return tooLarge()
    return { ok: true, value: raw }
  }

  return { ok: false, status: 400, message: '无法解析请求体。' }
}

// ─────────────────────────────────────────────────────────────
// 6. 内存令牌桶限流（进程内，尽力而为）
// ─────────────────────────────────────────────────────────────

interface TokenBucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, TokenBucket>()

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_IDLE_MS) buckets.delete(key)
  }
}

/**
 * 仅用于自动化测试：清空限流桶。
 *
 * 限流状态是模块级 Map，会在同一进程内的多个测试用例之间共享。
 * 没有这个导出，一个用例把某个 IP 打到 429 之后，后续用例就会受污染。
 * 生产代码不调用它。
 */
export function __resetRateLimiterForTests(): void {
  buckets.clear()
}

/** 取一个令牌；返回是否放行以及建议的重试等待秒数。 */
function consumeToken(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = buckets.get(key)
  const bucket: TokenBucket = existing ?? { tokens: RATE_LIMIT_CAPACITY, updatedAt: now }

  // 按经过的时间回填令牌
  const elapsedMs = Math.max(0, now - bucket.updatedAt)
  bucket.tokens = Math.min(
    RATE_LIMIT_CAPACITY,
    bucket.tokens + (elapsedMs / 1000) * RATE_LIMIT_REFILL_PER_SECOND,
  )
  bucket.updatedAt = now

  if (bucket.tokens < 1) {
    buckets.set(key, bucket)
    const deficit = 1 - bucket.tokens
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(deficit / RATE_LIMIT_REFILL_PER_SECOND)),
    }
  }

  bucket.tokens -= 1
  buckets.set(key, bucket)
  if (buckets.size > RATE_LIMIT_MAX_KEYS) pruneBuckets(now)
  return { allowed: true, retryAfterSeconds: 0 }
}

// ─────────────────────────────────────────────────────────────
// 7. 响应工具
// ─────────────────────────────────────────────────────────────

function sendJson(
  res: ApiResponse,
  status: number,
  body: SubmitResponseBody,
  extraHeaders?: Record<string, string>,
): void {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (extraHeaders) {
    for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value)
  }
  res.end(text)
}

/** 把 zod 的 issues 压平为 { 字段路径: 消息 }，并限制返回条数。 */
function flattenZodIssues(
  issues: readonly { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {}
  let count = 0
  for (const issue of issues) {
    if (count >= MAX_FIELD_ERRORS) break
    const key = issue.path.length > 0 ? issue.path.join('.') : '_'
    if (!(key in out)) {
      out[key] = issue.message
      count += 1
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// 8. 服务端环境变量（只读，绝不外泄）
// ─────────────────────────────────────────────────────────────

interface ServerEnv {
  url: string
  serviceRoleKey: string
}

/**
 * 读取服务端专用环境变量。
 * 任何缺失或格式非法都返回 null（调用方转为 503 / demo），
 * 且**不**把值写进日志或响应。
 */
/**
 * 归一化 SUPABASE_URL。
 *
 * 实测中真实出现过两种错误填法：
 *   1. 末尾带斜杠          https://x.supabase.co/
 *   2. 带了服务路径后缀    https://x.supabase.co/rest/v1
 *
 * 第 2 种是致命的：supabase-js 会在 base URL 后直接拼 `/auth/v1`、`/rest/v1`，
 * 于是请求变成 `/rest/v1/rest/v1/...` → 404，接口全部失败。
 * 这里主动剥掉多余的路径与斜杠，避免把配置错误变成难以定位的运行时故障。
 * 仍然只支持标准 Supabase 域名形态：https://<ref>.supabase.co
 */
function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    // 只保留 origin；丢弃任何路径（/rest/v1、/auth/v1 等）与末尾斜杠
    return parsed.origin
  } catch {
    // 不是合法 URL：交给后续逻辑按"未配置"处理，而不是带着脏值发请求
    return null
  }
}

function readServerEnv(): ServerEnv | null {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRoleKey) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  } catch {
    return null
  }
  return { url, serviceRoleKey }
}

let cachedClient: SupabaseClient | null = null

/** 复用热实例中的 service_role 客户端；密钥只在内存中传递，不落日志。 */
function getServiceClient(env: ServerEnv): SupabaseClient {
  if (cachedClient) return cachedClient
  cachedClient = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'ai-elderly-care-questionnaire-api' } },
  })
  return cachedClient
}

// ─────────────────────────────────────────────────────────────
// 9. 校验辅助
// ─────────────────────────────────────────────────────────────

interface QuestionnaireVersionRow {
  id: string
  is_active: boolean
}

type CheckResult = { ok: true } | { ok: false; status: number; message: string }

/**
 * 问卷版本双重校验：
 *   a) 必须与代码常量 QUESTIONNAIRE_VERSION 一致（防止混入旧版/伪造版本）；
 *   b) 必须已在 questionnaire_versions 中登记且 is_active = true。
 */
async function checkQuestionnaireVersion(
  supabase: SupabaseClient,
  version: string,
): Promise<CheckResult> {
  if (version !== QUESTIONNAIRE_VERSION) {
    return {
      ok: false,
      status: 400,
      message: `问卷版本不匹配（提交 ${version}，当前版本 ${QUESTIONNAIRE_VERSION}）。请刷新页面后重新填写。`,
    }
  }

  const { data, error } = await supabase
    .from('questionnaire_versions')
    .select('id,is_active')
    .eq('id', version)
    .maybeSingle()

  if (error) {
    logEvent('version_lookup_failed', typeof error.code === 'string' ? error.code : undefined)
    return { ok: false, status: 500, message: '服务器暂时无法校验问卷版本，请稍后重试。' }
  }

  const row = (data ?? null) as QuestionnaireVersionRow | null
  if (!row) {
    return {
      ok: false,
      status: 400,
      message: `问卷版本 ${version} 未在数据库中登记，本次提交未被保存。请联系研究团队。`,
    }
  }
  if (row.is_active !== true) {
    return {
      ok: false,
      status: 400,
      message: `问卷版本 ${version} 已停止收集数据，本次提交未被保存。请联系研究团队。`,
    }
  }
  return { ok: true }
}

/**
 * 重复提交检查（提前给出友好的 409）。
 * 权威判定在 submit_survey() 内部（行锁 + 唯一约束），本函数只是快速路径。
 */
async function checkDuplicate(
  supabase: SupabaseClient,
  participantId: string,
): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('participants')
    .select('submission_status')
    .eq('participant_id', participantId)
    .maybeSingle()

  if (error) {
    logEvent('duplicate_check_failed', typeof error.code === 'string' ? error.code : undefined)
    return { ok: false, status: 500, message: '服务器暂时无法校验提交状态，请稍后重试。' }
  }

  const row = (data ?? null) as { submission_status?: string } | null
  if (row?.submission_status === 'submitted') {
    return {
      ok: false,
      status: 409,
      message: '该问卷已提交过，本次重复提交已被拒绝。若确需重新填写，请联系研究团队。',
    }
  }
  return { ok: true }
}

/** 把数据库错误码翻译为对客户端有意义的 HTTP 状态与提示（不回传原始错误文本）。 */
function mapRpcError(code: string): { status: number; message: string } {
  switch (code) {
    case '23505':
      return { status: 409, message: '该问卷已提交过，本次重复提交已被拒绝。' }
    case '22023':
      return { status: 400, message: '问卷数据不完整或格式不正确，未通过服务端校验。' }
    case '23514':
    case '23502':
    case '22P02':
    case '23503':
      return { status: 400, message: '问卷数据未通过数据库一致性校验，本次提交未被保存。' }
    case '42883':
    case 'PGRST202':
      return {
        status: 500,
        message: '服务器数据库尚未初始化（缺少 submit_survey 函数）。请联系研究团队执行 supabase/schema.sql。',
      }
    default:
      return { status: 500, message: '数据写入失败，本次问卷未被保存。请稍后重试或联系研究团队。' }
  }
}

/** 首次作答的选项文字（用于数据库 first_answer 列）。 */
function firstAnswerLabel(questionId: 'Q6' | 'Q7', index: number): string {
  const option = COMPREHENSION_QUESTION_BY_ID[questionId]?.options[index]
  return option ? option.label : `option_${index}`
}

/** 组装 RPC 载荷：补充 firstAnswer 与 userAgent，其余字段原样透传。 */
function buildRpcPayload(input: SubmissionInput, userAgent: string | null): SubmitSurveyRpcPayload {
  const payload: SubmitSurveyRpcPayload = {
    ...input,
    comprehension: input.comprehension.map((record) => ({
      ...record,
      firstAnswer: firstAnswerLabel(record.questionId, record.firstAnswerIndex),
    })),
  }
  if (userAgent) payload.userAgent = userAgent
  return payload
}

// ─────────────────────────────────────────────────────────────
// 10. 主处理函数
// ─────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()

  // 10.1 只接受 POST。OPTIONS 故意不处理：前端与接口同源部署，不会触发 CORS 预检。
  if (method !== 'POST') {
    sendJson(
      res,
      405,
      { ok: false, mode: 'supabase', message: '仅支持 POST 方法提交问卷。' },
      { Allow: 'POST' },
    )
    return
  }

  // 10.2 环境变量缺失 → 明确告知"未保存"，绝不伪装成功
  const env = readServerEnv()
  if (!env) {
    sendJson(res, 503, {
      ok: false,
      mode: 'demo',
      message:
        '服务器未配置数据库连接（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失），本次提交未写入云端数据库。请联系研究团队完成配置后再收集数据。',
    })
    return
  }

  // 10.3 第一层限流：按 IP（此时还不知道 participant_id）
  const ip = readClientIp(req)
  const ipLimit = consumeToken(`ip:${ip}`)
  if (!ipLimit.allowed) {
    sendJson(
      res,
      429,
      { ok: false, mode: 'supabase', message: '提交过于频繁，请稍后再试。' },
      { 'Retry-After': String(ipLimit.retryAfterSeconds) },
    )
    return
  }

  // 10.4 读取请求体（含体积守卫）
  const body = readJsonBody(req)
  if (!body.ok) {
    sendJson(res, body.status, { ok: false, mode: 'supabase', message: body.message })
    return
  }

  // 10.5 结构校验（复用前端同一份 zod schema）
  const parsed = submissionSchema.safeParse(body.value)
  if (!parsed.success) {
    sendJson(res, 400, {
      ok: false,
      mode: 'supabase',
      message: '问卷数据未通过完整性校验，未提交到服务器。',
      fieldErrors: flattenZodIssues(parsed.error.issues),
    })
    return
  }

  const input: SubmissionInput = parsed.data

  // 10.6 第二层限流：IP + participant_id（防止同一设备反复提交不同编号）
  const combinedLimit = consumeToken(`ip+pid:${ip}|${input.participantId}`)
  if (!combinedLimit.allowed) {
    sendJson(
      res,
      429,
      { ok: false, mode: 'supabase', message: '提交过于频繁，请稍后再试。' },
      { 'Retry-After': String(combinedLimit.retryAfterSeconds) },
    )
    return
  }

  // 10.7 研究语义校验（题目覆盖、左右一致、顺序排列、理解检查一致性、时间合理性）
  const problems = validateSubmissionSemantics(input)
  if (problems.length > 0) {
    sendJson(res, 400, {
      ok: false,
      mode: 'supabase',
      message: '问卷数据未通过一致性校验，未提交到服务器。请返回检查未完成的题目。',
      problems: problems.slice(0, MAX_FIELD_ERRORS),
    })
    return
  }

  const supabase = getServiceClient(env)

  // 10.8 问卷版本校验（常量 + 数据库登记）
  const versionCheck = await checkQuestionnaireVersion(supabase, input.questionnaireVersion)
  if (!versionCheck.ok) {
    sendJson(res, versionCheck.status, {
      ok: false,
      mode: 'supabase',
      message: versionCheck.message,
    })
    return
  }

  // 10.9 重复提交快速检查
  const duplicateCheck = await checkDuplicate(supabase, input.participantId)
  if (!duplicateCheck.ok) {
    sendJson(res, duplicateCheck.status, {
      ok: false,
      mode: 'supabase',
      message: duplicateCheck.message,
    })
    return
  }

  // 10.10 原子写入：7 张表在一个事务内完成
  const rpcPayload = buildRpcPayload(input, readHeader(req, 'user-agent'))
  const { error: rpcError } = await supabase.rpc('submit_survey', { payload: rpcPayload })

  if (rpcError) {
    const code = typeof rpcError.code === 'string' ? rpcError.code : ''
    // 只记录错误码，不记录 message（可能包含参与者编号等数据）
    logEvent('rpc_failed', code || 'unknown')
    const mapped = mapRpcError(code)
    sendJson(res, mapped.status, {
      ok: false,
      mode: 'supabase',
      message: mapped.message,
    })
    return
  }

  // 10.11 成功回执（不含任何答案内容）
  sendJson(res, 200, {
    ok: true,
    mode: 'supabase',
    message: '提交成功，数据已保存到研究数据库。感谢您的参与！',
    participantId: input.participantId,
  })
}
