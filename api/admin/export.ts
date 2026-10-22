/**
 * GET /api/admin/export?dataset=<name> — 研究数据 CSV 导出接口
 *                    （Vercel Serverless / Node 运行时）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 鉴权（两道，缺一不可）：
 *   1. 身份验证：`Authorization: Bearer <Supabase Auth access_token>`，
 *      用 service_role 客户端调用 auth.getUser(token) 向 Supabase Auth
 *      验证令牌真伪 → 失败返回 401。
 *   2. 授权：验证后的邮箱必须存在于 research_admins 白名单
 *      （优先用 RPC is_research_admin_email，失败时回退查表比较）
 *      → 不在名单返回 403。
 *
 * 导出数据集（dataset 参数）：
 *   participants     参与者主表
 *   dce_choices      DCE 原始选择记录
 *   profile_ratings  4 个配置 × 12 量表题评分
 *   analysis_long    DCE 长表（每题 2 行，含 chosen），**别名 long_format**
 *   merged           每人一行的宽表：参与者信息 + Q8–Q10 +
 *                    四个构念的量表均值 + DCE 题数 + 已评配置数
 *
 * CSV 约定：
 *   * UTF-8 **带 BOM**（Excel 打开中文不乱码）；
 *   * RFC4180：所有字段用双引号包裹，内部双引号转义为 ""，行分隔 CRLF；
 *   * 空值输出为 ""（而不是 NULL）；
 *   * 以 = + - @ 开头的文本会被加上前置单引号，防止 Excel 公式注入。
 *   * 列顺序固定（见各 _COLUMNS 常量），便于用同一份分析脚本反复读取。
 *
 * 安全：
 *   * SUPABASE_SERVICE_ROLE_KEY 只从 process.env 读取，绝不写入响应或日志；
 *   * 本文件不打印任何研究数据，日志只记录事件名 + 错误码；
 *   * 导出结果属于原始研究数据，请存放在受控目录，不要提交进 Git。
 *
 * 说明：ApiRequest / ApiResponse 在此**再次自声明**（未安装 @vercel/node）。
 *       两个接口文件各自声明，是为了避免一个 Serverless 函数 import 另一个
 *       函数文件（那会把不相干的代码打进同一份产物）。
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// ───────────────────────────────────────────────────────────────────────────
// 0. Vercel 函数类型的最小自声明
// ───────────────────────────────────────────────────────────────────────────

export interface ApiRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  socket?: { remoteAddress?: string | undefined } | undefined
}

export interface ApiResponse {
  statusCode: number
  setHeader(name: string, value: string | number | readonly string[]): void
  end(chunk?: string): void
}

// ───────────────────────────────────────────────────────────────────────────
// 1. 常量
// ───────────────────────────────────────────────────────────────────────────

/** 单页读取行数（Supabase/PostgREST 默认 max-rows 为 1000）。 */
const PAGE_SIZE = 1000

/** 单次导出行数上限：超过则提示分批导出，避免函数内存/超时风险。 */
const MAX_EXPORT_ROWS = 200_000

const CSV_BOM = '\uFEFF'
const CSV_NEWLINE = '\r\n'

type DatasetName =
  | 'participants'
  | 'dce_choices'
  | 'profile_ratings'
  | 'custom_config'
  | 'analysis_long'
  | 'merged'

/**
 * dataset 参数 → 内部数据集名。
 * `long_format` 是前端后台已在使用的别名，指向 analysis_long，
 * 保留它可以让两种命名都能导出同一份长表数据。
 */
const DATASET_ALIASES: Record<string, DatasetName> = {
  participants: 'participants',
  dce_choices: 'dce_choices',
  profile_ratings: 'profile_ratings',
  custom_config: 'custom_config',
  analysis_long: 'analysis_long',
  long_format: 'analysis_long',
  merged: 'merged',
}

const DATASET_LIST =
  'participants | dce_choices | profile_ratings | custom_config | analysis_long | merged'

// ───────────────────────────────────────────────────────────────────────────
// 2. 列定义（与 supabase/schema.sql 一一对应，顺序即 CSV 列顺序）
// ───────────────────────────────────────────────────────────────────────────

const PARTICIPANT_COLUMNS = [
  'id',
  'participant_id',
  'questionnaire_version',
  'consent_status',
  'age_group',
  'respondent_role',
  'respondent_role_other',
  'ai_device_experience',
  'caregiving_experience',
  'assigned_block',
  'prior_experience',
  'started_at',
  'submitted_at',
  'total_duration_ms',
  'submission_status',
  'created_at',
] as const

const DCE_CHOICE_COLUMNS = [
  'id',
  'participant_id',
  'task_id',
  'block_id',
  'task_display_order',
  'left_profile_id',
  'right_profile_id',
  'selected_side',
  'selected_profile_id',
  'left_x1',
  'left_x2',
  'left_x3',
  'right_x1',
  'right_x2',
  'right_x3',
  'response_duration_ms',
  'created_at',
] as const

const PROFILE_RATING_COLUMNS = [
  'id',
  'participant_id',
  'profile_id',
  'x1',
  'x2',
  'x3',
  'rating_order',
  's1',
  's2',
  's3',
  'p1',
  'p2',
  'p3',
  'a1',
  'a2',
  'a3',
  'i1',
  'i2',
  'i3',
  'created_at',
] as const

/** 模块六：参与者自由设定的理想配置（三个开关）。 */
const CUSTOM_CONFIG_COLUMNS = [
  'id',
  'participant_id',
  'x1',
  'x2',
  'x3',
  'matched_profile_id',
  'response_duration_ms',
  'created_at',
] as const

/** DCE 长表：条件 logit / 混合 logit 的直接输入。 */
const ANALYSIS_LONG_COLUMNS = [
  'participant_id',
  'questionnaire_version',
  'assigned_block',
  'task_id',
  'task_display_order',
  'alternative',
  'profile_id',
  'x1',
  'x2',
  'x3',
  'chosen',
  'response_duration_ms',
] as const

/** 四个构念的均值列（由 profile_ratings 聚合得到）。 */
const SCALE_GROUPS = [
  { construct: 'security', items: ['s1', 's2', 's3'], column: 'mean_security_s1_s3' },
  { construct: 'privacy', items: ['p1', 'p2', 'p3'], column: 'mean_privacy_p1_p3' },
  { construct: 'autonomy', items: ['a1', 'a2', 'a3'], column: 'mean_autonomy_a1_a3' },
  { construct: 'intention', items: ['i1', 'i2', 'i3'], column: 'mean_intention_i1_i3' },
] as const

const MERGED_COLUMNS = [
  ...PARTICIPANT_COLUMNS,
  'q8',
  'q9',
  'q10',
  'response_created_at',
  'n_dce_choices',
  'n_rated_profiles',
  // 模块六：自由自选配置（宽表里便于与 DCE 选择直接对比）
  'custom_x1',
  'custom_x2',
  'custom_x3',
  'custom_matched_profile_id',
  'custom_response_duration_ms',
  ...SCALE_GROUPS.map((group) => group.column),
] as const

// ───────────────────────────────────────────────────────────────────────────
// 3. 安全日志（不记录任何研究数据）
// ───────────────────────────────────────────────────────────────────────────

function logEvent(event: string, detail?: string): void {
  console.error(detail ? `[admin-export] ${event} ${detail}` : `[admin-export] ${event}`)
}

// ───────────────────────────────────────────────────────────────────────────
// 4. 请求工具
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

/** 读取查询参数：优先 req.query，其次从 req.url 解析。 */
function readQueryParam(req: ApiRequest, name: string): string | null {
  const fromQuery = req.query?.[name]
  if (Array.isArray(fromQuery)) {
    const first = fromQuery[0]
    if (typeof first === 'string' && first.trim().length > 0) return first
  } else if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    return fromQuery
  }
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost')
      const value = parsed.searchParams.get(name)
      if (value !== null && value.trim().length > 0) return value
    } catch {
      // URL 无法解析时忽略，按"缺少参数"处理
    }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// 5. 响应工具
// ───────────────────────────────────────────────────────────────────────────

interface ExportErrorBody {
  ok: false
  message: string
}

function sendJson(
  res: ApiResponse,
  status: number,
  body: ExportErrorBody,
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

function sendCsv(res: ApiResponse, dataset: DatasetName, csv: string): void {
  // 文件名只用 ASCII（数据集名 + 时间戳），避免各类客户端对文件名编码处理不一致
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="ai-elderly-care-${dataset}-${stamp}.csv"`,
  )
  res.setHeader('Content-Length', String(Buffer.byteLength(csv, 'utf8')))
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(csv)
}

// ───────────────────────────────────────────────────────────────────────────
// 6. CSV 生成（RFC4180 + UTF-8 BOM）
// ───────────────────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'

  let text: string
  if (typeof value === 'boolean') text = value ? 'true' : 'false'
  else if (typeof value === 'number') text = Number.isFinite(value) ? String(value) : ''
  else if (value instanceof Date) text = value.toISOString()
  else text = String(value)

  // 防 CSV 公式注入（OWASP）：Excel 会执行以 = + - @ 或制表符开头的单元格。
  // 前置单引号在 Excel 中不显示，可安全保留原始文本的可读性。
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(columns: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines: string[] = [columns.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  return CSV_BOM + lines.join(CSV_NEWLINE) + CSV_NEWLINE
}

// ───────────────────────────────────────────────────────────────────────────
// 7. 值转换工具（PostgREST 返回的行按 Record<string, unknown> 处理）
// ───────────────────────────────────────────────────────────────────────────

type DataRow = Record<string, unknown>

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function dbCode(error: { code?: string | null }): string {
  return typeof error.code === 'string' && error.code.length > 0 ? error.code : 'unknown'
}

// ───────────────────────────────────────────────────────────────────────────
// 8. 环境变量与客户端（与 submit-survey 相同约定：只读、不外泄）
// ───────────────────────────────────────────────────────────────────────────

interface ServerEnv {
  url: string
  serviceRoleKey: string
}

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

function getServiceClient(env: ServerEnv): SupabaseClient {
  if (cachedClient) return cachedClient
  cachedClient = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'ai-elderly-care-questionnaire-admin' } },
  })
  return cachedClient
}

// ───────────────────────────────────────────────────────────────────────────
// 9. 鉴权与授权
// ───────────────────────────────────────────────────────────────────────────

function readBearerToken(req: ApiRequest): string | null {
  const header = readHeader(req, 'authorization')
  if (!header) return null
  const matched = /^Bearer\s+(.+)$/i.exec(header)
  const token = matched?.[1]?.trim()
  return token && token.length > 0 ? token : null
}

/**
 * 邮箱是否在 research_admins 白名单。
 * 主路径：RPC is_research_admin_email（大小写不敏感、由数据库判定）；
 * 回退路径：服务端直查白名单表（白名单通常只有几个人），
 *           兼容尚未执行最新 schema 的数据库。
 * 无论哪条路径都不会把白名单内容返回给客户端。
 */
async function isResearchAdmin(supabase: SupabaseClient, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (normalized.length === 0) return false

  const rpc = await supabase.rpc('is_research_admin_email', { p_email: normalized })
  if (!rpc.error && typeof rpc.data === 'boolean') return rpc.data

  const fallback = await supabase.from('research_admins').select('email').limit(500)
  if (fallback.error) {
    logEvent('admin_lookup_failed', dbCode(fallback.error))
    return false
  }
  const rows = (fallback.data ?? []) as unknown as { email?: unknown }[]
  return rows.some((row) => asText(row.email).trim().toLowerCase() === normalized)
}

type AuthResult = { ok: true; email: string } | { ok: false; status: 401 | 403; message: string }

async function authenticateAndAuthorize(
  supabase: SupabaseClient,
  req: ApiRequest,
): Promise<AuthResult> {
  const token = readBearerToken(req)
  if (!token) {
    return {
      ok: false,
      status: 401,
      message: '未通过身份验证：缺少 Authorization: Bearer <access_token> 请求头。',
    }
  }

  const { data, error } = await supabase.auth.getUser(token)
  const user = data?.user ?? null
  if (error || !user) {
    logEvent('token_invalid', error && typeof error.code === 'string' ? error.code : undefined)
    return { ok: false, status: 401, message: '未通过身份验证：访问令牌无效或已过期，请重新登录。' }
  }

  const email = typeof user.email === 'string' ? user.email.trim() : ''
  if (email.length === 0) {
    return { ok: false, status: 403, message: '该账号没有绑定邮箱，无法核对研究管理员身份。' }
  }

  if (!(await isResearchAdmin(supabase, email))) {
    logEvent('not_admin')
    return {
      ok: false,
      status: 403,
      message: '当前账号不在研究管理员白名单（research_admins）中，无权导出研究数据。',
    }
  }

  return { ok: true, email }
}

// ───────────────────────────────────────────────────────────────────────────
// 10. 分页读取（兼容 PostgREST max-rows 限制）
// ───────────────────────────────────────────────────────────────────────────

type RowsResult = { ok: true; rows: DataRow[] } | { ok: false; message: string }

async function fetchRows(
  supabase: SupabaseClient,
  table: string,
  columns: readonly string[],
  orderBy: readonly string[],
): Promise<RowsResult> {
  const rows: DataRow[] = []
  let from = 0

  for (;;) {
    let query = supabase.from(table).select(columns.join(','))
    for (const column of orderBy) query = query.order(column, { ascending: true })

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) {
      logEvent('query_failed', `${table}:${dbCode(error)}`)
      return { ok: false, message: `读取数据表 ${table} 失败（错误码 ${dbCode(error)}）。` }
    }

    const page = (data ?? []) as unknown as DataRow[]
    for (const row of page) rows.push(row)

    // 按"实际返回行数"推进偏移量：即使服务端 max-rows 小于 PAGE_SIZE 也不会漏行
    if (page.length === 0) break
    from += page.length

    if (rows.length >= MAX_EXPORT_ROWS) {
      return {
        ok: false,
        message: `单次导出上限为 ${MAX_EXPORT_ROWS} 行。请缩小范围（例如按问卷版本分批）或改用数据库直连导出。`,
      }
    }
  }

  return { ok: true, rows }
}

// ───────────────────────────────────────────────────────────────────────────
// 11. merged：每人一行的宽表
// ───────────────────────────────────────────────────────────────────────────

interface RatingAggregate {
  /** 四个构念各自的分数和与有效计数（与 SCALE_GROUPS 顺序一致）。 */
  sums: number[]
  counts: number[]
  ratedProfiles: number
}

/** merged 结果：行值数组已按 MERGED_COLUMNS 顺序排好。 */
type MergedResult = { ok: true; rows: unknown[][] } | { ok: false; message: string }

async function buildMergedRows(supabase: SupabaseClient): Promise<MergedResult> {
  const participants = await fetchRows(supabase, 'participants', PARTICIPANT_COLUMNS, ['id'])
  if (!participants.ok) return participants

  const responses = await fetchRows(
    supabase,
    'survey_responses',
    ['id', 'participant_id', 'q8', 'q9', 'q10', 'created_at'],
    ['id'],
  )
  if (!responses.ok) return responses

  const ratings = await fetchRows(
    supabase,
    'profile_ratings',
    ['id', 'participant_id', ...SCALE_GROUPS.flatMap((group) => [...group.items])],
    ['id'],
  )
  if (!ratings.ok) return ratings

  const choices = await fetchRows(supabase, 'dce_choices', ['id', 'participant_id'], ['id'])
  if (!choices.ok) return choices

  // 模块六：自由自选配置（每人最多 1 条）
  const customConfigs = await fetchRows(
    supabase,
    'custom_config_choices',
    ['participant_id', 'x1', 'x2', 'x3', 'matched_profile_id', 'response_duration_ms'],
    ['participant_id'],
  )
  if (!customConfigs.ok) return customConfigs

  // 11.1 聚合量表均值
  const aggregates = new Map<string, RatingAggregate>()
  for (const row of ratings.rows) {
    const pid = asText(row['participant_id'])
    if (pid.length === 0) continue
    const current: RatingAggregate =
      aggregates.get(pid) ?? { sums: [0, 0, 0, 0], counts: [0, 0, 0, 0], ratedProfiles: 0 }
    current.ratedProfiles += 1
    SCALE_GROUPS.forEach((group, index) => {
      for (const item of group.items) {
        const value = asNumber(row[item])
        if (value === null) continue
        current.sums[index] = (current.sums[index] ?? 0) + value
        current.counts[index] = (current.counts[index] ?? 0) + 1
      }
    })
    aggregates.set(pid, current)
  }

  // 11.2 统计每人 DCE 题数
  const dceCounts = new Map<string, number>()
  for (const row of choices.rows) {
    const pid = asText(row['participant_id'])
    if (pid.length === 0) continue
    dceCounts.set(pid, (dceCounts.get(pid) ?? 0) + 1)
  }

  // 11.2b 自由自选配置按参与者索引
  const customByParticipant = new Map<string, DataRow>()
  for (const row of customConfigs.rows) {
    const pid = asText(row['participant_id'])
    if (pid.length > 0) customByParticipant.set(pid, row)
  }

  // 11.3 总体评价按参与者索引
  const responseByParticipant = new Map<string, DataRow>()
  for (const row of responses.rows) {
    const pid = asText(row['participant_id'])
    if (pid.length > 0) responseByParticipant.set(pid, row)
  }

  // 11.4 组装宽表行（列顺序由 MERGED_COLUMNS 固定）
  const merged: unknown[][] = []
  for (const participant of participants.rows) {
    const pid = asText(participant['participant_id'])
    const response = responseByParticipant.get(pid)
    const aggregate = aggregates.get(pid)

    const values: Record<string, unknown> = { ...participant }
    values['q8'] = response?.['q8'] ?? null
    values['q9'] = response?.['q9'] ?? null
    values['q10'] = response?.['q10'] ?? null
    values['response_created_at'] = response?.['created_at'] ?? null
    values['n_dce_choices'] = dceCounts.get(pid) ?? 0
    values['n_rated_profiles'] = aggregate?.ratedProfiles ?? 0

    const custom = customByParticipant.get(pid)
    values['custom_x1'] = custom?.['x1'] ?? null
    values['custom_x2'] = custom?.['x2'] ?? null
    values['custom_x3'] = custom?.['x3'] ?? null
    values['custom_matched_profile_id'] = custom?.['matched_profile_id'] ?? null
    values['custom_response_duration_ms'] = custom?.['response_duration_ms'] ?? null

    SCALE_GROUPS.forEach((group, index) => {
      const sum = aggregate?.sums[index]
      const count = aggregate?.counts[index]
      values[group.column] =
        sum !== undefined && count !== undefined && count > 0 ? round4(sum / count) : null
    })

    merged.push(MERGED_COLUMNS.map((column) => values[column] ?? null))
  }

  return { ok: true, rows: merged }
}

// ───────────────────────────────────────────────────────────────────────────
// 12. 主处理函数
// ───────────────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'GET') {
    sendJson(res, 405, { ok: false, message: '导出接口仅支持 GET 方法。' }, { Allow: 'GET' })
    return
  }

  // 12.1 dataset 参数（未知名称一律 400）
  const requested = readQueryParam(req, 'dataset')
  const dataset = requested ? DATASET_ALIASES[requested.trim().toLowerCase()] : undefined
  if (!dataset) {
    sendJson(res, 400, {
      ok: false,
      message: `缺少或无法识别的 dataset 参数。可用值：${DATASET_LIST}（long_format 为 analysis_long 的别名）。`,
    })
    return
  }

  // 12.2 环境变量
  const env = readServerEnv()
  if (!env) {
    sendJson(res, 503, {
      ok: false,
      message:
        '服务器未配置数据库连接（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 缺失），无法导出数据。',
    })
    return
  }

  const supabase = getServiceClient(env)

  // 12.3 鉴权 + 授权
  const auth = await authenticateAndAuthorize(supabase, req)
  if (!auth.ok) {
    sendJson(
      res,
      auth.status,
      { ok: false, message: auth.message },
      auth.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
    )
    return
  }

  // 12.4 生成 CSV
  try {
    if (dataset === 'merged') {
      const merged = await buildMergedRows(supabase)
      if (!merged.ok) {
        sendJson(res, 500, { ok: false, message: merged.message })
        return
      }
      // buildMergedRows 已按 MERGED_COLUMNS 顺序返回行值
      sendCsv(res, dataset, toCsv(MERGED_COLUMNS, merged.rows))
      return
    }

    if (dataset === 'participants') {
      const result = await fetchRows(supabase, 'participants', PARTICIPANT_COLUMNS, ['id'])
      if (!result.ok) {
        sendJson(res, 500, { ok: false, message: result.message })
        return
      }
      sendCsv(res, dataset, toCsv(PARTICIPANT_COLUMNS, result.rows.map(rowValues(PARTICIPANT_COLUMNS))))
      return
    }

    if (dataset === 'custom_config') {
      const result = await fetchRows(supabase, 'custom_config_choices', CUSTOM_CONFIG_COLUMNS, ['id'])
      if (!result.ok) {
        sendJson(res, 500, { ok: false, message: result.message })
        return
      }
      sendCsv(
        res,
        dataset,
        toCsv(CUSTOM_CONFIG_COLUMNS, result.rows.map(rowValues(CUSTOM_CONFIG_COLUMNS))),
      )
      return
    }

    if (dataset === 'dce_choices') {
      const result = await fetchRows(supabase, 'dce_choices', DCE_CHOICE_COLUMNS, ['id'])
      if (!result.ok) {
        sendJson(res, 500, { ok: false, message: result.message })
        return
      }
      sendCsv(res, dataset, toCsv(DCE_CHOICE_COLUMNS, result.rows.map(rowValues(DCE_CHOICE_COLUMNS))))
      return
    }

    if (dataset === 'profile_ratings') {
      const result = await fetchRows(supabase, 'profile_ratings', PROFILE_RATING_COLUMNS, ['id'])
      if (!result.ok) {
        sendJson(res, 500, { ok: false, message: result.message })
        return
      }
      sendCsv(
        res,
        dataset,
        toCsv(PROFILE_RATING_COLUMNS, result.rows.map(rowValues(PROFILE_RATING_COLUMNS))),
      )
      return
    }

    // analysis_long：按 (participant_id, task_id, alternative) 排序，保证分页稳定
    const result = await fetchRows(
      supabase,
      'analysis_long',
      ANALYSIS_LONG_COLUMNS,
      ['participant_id', 'task_id', 'alternative'],
    )
    if (!result.ok) {
      sendJson(res, 500, { ok: false, message: result.message })
      return
    }
    sendCsv(
      res,
      dataset,
      toCsv(ANALYSIS_LONG_COLUMNS, result.rows.map(rowValues(ANALYSIS_LONG_COLUMNS))),
    )
  } catch (caught) {
    // 只记录错误类型，不记录可能包含研究数据的错误内容
    logEvent('export_failed', caught instanceof Error ? caught.name : 'unknown')
    sendJson(res, 500, { ok: false, message: '导出过程中发生服务器错误，未生成文件。' })
  }
}

/** 按固定列顺序把一行对象转为值数组（缺失列输出空值）。 */
function rowValues(columns: readonly string[]): (row: DataRow) => unknown[] {
  return (row: DataRow) => columns.map((column) => row[column] ?? null)
}
