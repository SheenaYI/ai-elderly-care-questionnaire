import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Layers,
  LoaderCircle,
  LogOut,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { getAccessToken, useAdminAuth } from './useAdminAuth'
import {
  computeAdminStats,
  loadAdminDataset,
  type AdminDataset,
  type AdminStats,
} from './adminStats'
import { ALL_CONFIGURABLE_FIELDS, pendingFields } from '@/data/placeholders'
import { checkDesignIntegrity } from '@/data/dceTasks'
import { config } from '@/lib/config'

/**
 * 研究管理后台 /admin
 *
 * 安全约束（重要）：
 *   - 必须经过**真正的身份认证与授权**才能访问；不是靠隐藏 URL。
 *   - 未配置 Supabase、未登录、或不在 research_admins 白名单内，
 *     一律不展示任何研究数据，也不提供导出接口。
 *   - **不使用**前端写死的管理员密码。
 *   - 前端只持有 anon 公钥；service_role key 只存在于服务端环境变量。
 */

type ExportDataset =
  | 'participants'
  | 'dce_choices'
  | 'profile_ratings'
  | 'custom_config'
  | 'long_format'
  | 'merged'

const EXPORT_OPTIONS: { key: ExportDataset; label: string; detail: string }[] = [
  { key: 'participants', label: 'participants.csv', detail: '参与者基本信息、卷别、提交状态、填写时长' },
  { key: 'dce_choices', label: 'dce_choices.csv', detail: 'DCE 选择题记录（含实际左右配置与所选配置）' },
  { key: 'profile_ratings', label: 'profile_ratings.csv', detail: '4 个配置 × 12 量表题的评分' },
  {
    key: 'custom_config',
    label: 'custom_config.csv',
    detail: '参与者自由设定的理想配置（三个开关 + 匹配编码 + 耗时）',
  },
  { key: 'long_format', label: 'analysis_long.csv', detail: '长格式数据，可直接用于条件 Logit 分析' },
  { key: 'merged', label: 'merged_analysis.csv', detail: '合并为每位参与者一行的宽格式分析数据' },
]

// ─────────────────────────────────────────────────────────────
// 登录界面
// ─────────────────────────────────────────────────────────────

function AdminLogin({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<{ error: string | null }>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await onSignIn(email.trim(), password)
    if (result.error) setError(result.error)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-panel bg-forest-700 text-white" aria-hidden="true">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-sage-600">
            AIECQ · Research Admin
          </p>
          <h1 className="text-[1.1rem] font-semibold text-forest-800">研究管理后台</h1>
        </div>
      </div>

      <Card className="mt-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-[0.95rem] font-medium text-forest-800">
              研究人员邮箱
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-13 w-full rounded-panel border border-sage-300 bg-white px-4 text-[1rem] outline-none transition focus:border-forest-700"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-[0.95rem] font-medium text-forest-800">
              密码
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-13 w-full rounded-panel border border-sage-300 bg-white px-4 text-[1rem] outline-none transition focus:border-forest-700"
            />
          </div>

          {error && (
            <p className="rounded-panel border border-alert-100 bg-alert-50 px-3.5 py-2.5 text-[0.9rem] text-alert-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-panel bg-forest-700 px-5 text-[1rem] font-semibold text-white transition hover:bg-forest-600 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            {busy ? '正在登录…' : '登录'}
          </button>
        </form>

        <div className="mt-5 rounded-panel border border-sage-200 bg-sage-50 px-3.5 py-3">
          <p className="text-[0.85rem] font-semibold text-forest-800">登录失败时依次排查</p>
          <ol className="mt-1.5 space-y-1 text-[0.82rem] leading-relaxed text-sage-700">
            <li>
              1. 账号是否已在 Supabase 的 Authentication → Users 中
              <strong className="font-semibold">确认邮箱</strong>（未确认的账号无法登录）
            </li>
            <li>2. 邮箱与密码是否与 Supabase 中创建的完全一致</li>
            <li>
              3. 若能登录但提示"无访问权限"，才是白名单问题
              （需在数据表 research_admins 中登记该邮箱）
            </li>
          </ol>
        </div>

        <p className="mt-5 border-t border-sage-200 pt-4 text-[0.85rem] leading-relaxed text-sage-700">
          <ShieldAlert className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
          本后台仅限经研究团队明确授权的研究人员访问。账号由研究团队在 Supabase Auth 中创建，
          并在数据库 <code className="rounded bg-sage-100 px-1 py-0.5 font-mono text-[0.8rem]">research_admins</code>{' '}
          白名单中登记。系统不使用任何前端写死的密码。
        </p>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 拒绝访问
// ─────────────────────────────────────────────────────────────

function AccessDenied({
  state,
  email = null,
}: {
  state: 'unconfigured' | 'signed-out' | 'unauthorized'
  email?: string | null
}) {
  const content: { title: string; detail: string } = {
    unconfigured: {
      title: '后台尚未配置',
      detail:
        '当前未配置 Supabase 连接，因此管理后台不开放。请在环境变量中配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，并在 Supabase 中执行数据库迁移与 RLS 策略后再使用。',
    },
    'signed-out': {
      title: '需要登录',
      detail: '请使用研究团队分配的账号登录。未经认证的访问一律被拒绝。',
    },
    unauthorized: {
      title: '无访问权限',
      detail:
        '您已登录，但该账号不在研究管理员白名单（research_admins）中，因此无法查看任何研究数据。如需权限，请联系研究团队负责人。',
    },
  }[state]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <Card>
        <span className="flex h-12 w-12 items-center justify-center rounded-panel bg-champagne-100 text-champagne-800" aria-hidden="true">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-[1.3rem] font-semibold text-forest-800">{content.title}</h1>
        <p className="mt-2.5 text-[0.95rem] leading-8 text-sage-700">{content.detail}</p>
        {email && (
          <p className="mt-3 rounded-panel bg-sage-50 px-3.5 py-2.5 font-mono text-[0.85rem] text-sage-800">
            当前账号：{email}
          </p>
        )}
        <a
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-panel border border-forest-700 px-5 text-[0.95rem] font-semibold text-forest-800 transition hover:bg-forest-50"
        >
          返回参与者首页
        </a>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 统计仪表盘
// ─────────────────────────────────────────────────────────────

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-surface border border-sage-200 bg-white p-4 shadow-card">
      <p className="text-[0.82rem] font-medium text-sage-700">{label}</p>
      <p className="mt-1.5 font-mono text-[1.6rem] font-semibold tabular-nums text-forest-800">{value}</p>
      {detail && <p className="mt-1 text-[0.8rem] text-sage-600">{detail}</p>}
    </div>
  )
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
}

function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export default function AdminPage() {
  const { state, signIn, signOut } = useAdminAuth()
  const [dataset, setDataset] = useState<AdminDataset | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportDataset | null>(null)

  const isAuthorized = state.status === 'authorized'

  const refresh = useCallback(async () => {
    if (!isAuthorized) return
    setLoading(true)
    setError(null)
    try {
      const data = await loadAdminDataset()
      setDataset(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取数据失败。')
    } finally {
      setLoading(false)
    }
  }, [isAuthorized])

  useEffect(() => {
    if (isAuthorized) void refresh()
  }, [isAuthorized, refresh])

  const stats: AdminStats | null = useMemo(
    () => (dataset ? computeAdminStats(dataset) : null),
    [dataset],
  )

  const designCheck = useMemo(() => checkDesignIntegrity(), [])
  const pending = pendingFields()

  /** 导出 CSV：经由服务端接口，携带 Auth token。 */
  async function handleExport(target: ExportDataset) {
    setExporting(target)
    setError(null)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError('未取得登录凭据，无法导出。请重新登录。')
        return
      }
      const endpoint = `/api/admin/export?dataset=${encodeURIComponent(target)}`
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const body = await response.text()
        setError(`导出失败（HTTP ${response.status}）：${body.slice(0, 200)}`)
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${target}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      setError('导出失败：网络或服务器错误。')
    } finally {
      setExporting(null)
    }
  }

  // ── 未授权状态 ──────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="flex items-center gap-2 text-[1rem] text-sage-700" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          正在验证访问权限…
        </p>
      </div>
    )
  }
  if (state.status === 'unconfigured') return <AccessDenied state="unconfigured" />
  if (state.status === 'signed-out') return <AdminLogin onSignIn={signIn} />
  if (state.status === 'unauthorized') {
    return <AccessDenied state="unauthorized" email={state.email} />
  }

  // ── 授权后的仪表盘 ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream-100">
      <header className="border-b border-sage-200 bg-white">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-sage-600">
              AIECQ · Research Admin
            </p>
            <h1 className="mt-0.5 text-[1.2rem] font-semibold text-forest-800">研究数据管理后台</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="success">{state.email}</Badge>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-forest-700 px-3.5 text-[0.9rem] font-semibold text-forest-800 transition hover:bg-forest-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              刷新
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-panel border border-sage-300 px-3.5 text-[0.9rem] font-semibold text-sage-700 transition hover:bg-sage-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-7 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-panel border border-alert-100 bg-alert-50 px-4 py-3" role="alert">
            <p className="text-[0.92rem] text-alert-700">
              <TriangleAlert className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
              {error}
            </p>
          </div>
        )}

        {/* ── 上线前配置检查 ───────────────────────────────── */}
        <Card className="mb-6" tone={pending.length > 0 ? 'champagne' : 'sage'}>
          <h2 className="text-[1.05rem] font-semibold text-forest-800">上线前配置检查</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[0.88rem] font-medium text-sage-700">
                待研究团队填写的字段：{pending.length} / {ALL_CONFIGURABLE_FIELDS.length}
              </p>
              {pending.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pending.map((f) => (
                    <li key={f.key} className="text-[0.85rem] text-champagne-800">
                      · {f.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[0.88rem] font-medium text-sage-700">
                DCE 设计完整性自查：
                <span className={designCheck.ok ? 'ml-1.5 text-forest-700' : 'ml-1.5 text-alert-700'}>
                  {designCheck.ok ? '通过' : `发现 ${designCheck.problems.length} 个问题`}
                </span>
              </p>
              {!designCheck.ok && (
                <ul className="mt-2 space-y-1">
                  {designCheck.problems.map((p) => (
                    <li key={p} className="text-[0.85rem] text-alert-700">· {p}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[0.82rem] text-sage-600">
                数据模式：{config.hasSupabaseClientConfig ? '已连接 Supabase' : 'Demo（未连接）'}
              </p>
              <p className="mt-1 text-[0.82rem] text-sage-600">
                问卷版本：{config.questionnaireVersion}
              </p>
            </div>
          </div>
        </Card>

        {loading && !stats && (
          <p className="flex items-center gap-2 text-[1rem] text-sage-700" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            正在读取研究数据…
          </p>
        )}

        {stats && (
          <div className="space-y-7">
            {/* ── 概览 ─────────────────────────────────────── */}
            <section aria-labelledby="admin-overview">
              <h2 id="admin-overview" className="flex items-center gap-2 text-[1.15rem] font-semibold text-forest-800">
                <BarChart3 className="h-5 w-5" aria-hidden="true" />
                概览
              </h2>
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="已提交问卷数" value={String(stats.overview.submittedCount)} detail={`共 ${stats.overview.totalParticipants} 条参与者记录`} />
                <StatTile label="A 卷人数" value={String(stats.overview.blockA)} />
                <StatTile label="B 卷人数" value={String(stats.overview.blockB)} />
                <StatTile
                  label="问卷完成率"
                  value={percent(stats.overview.completionRate)}
                  detail={`草稿 ${stats.overview.draftCount} 条`}
                />
                <StatTile label="平均填写时间" value={formatDuration(stats.overview.averageDurationMs)} />
                <StatTile label="中位填写时间" value={formatDuration(stats.overview.medianDurationMs)} />
                <StatTile
                  label="左侧选择比例"
                  value={percent(stats.quality.overallLeftShare)}
                  detail="用于检查位置效应"
                />
                <StatTile
                  label="过快作答记录"
                  value={String(stats.quality.tooFastDce)}
                  detail="DCE 作答时长 < 2 秒"
                />
              </div>

              {stats.overview.versions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.overview.versions.map((v) => (
                    <Badge key={v.version} tone="neutral">
                      版本 {v.version}：{v.count} 条
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            {/* ── 逐题选择分布 ─────────────────────────────── */}
            <section aria-labelledby="admin-dce">
              <h2 id="admin-dce" className="flex items-center gap-2 text-[1.15rem] font-semibold text-forest-800">
                <Table2 className="h-5 w-5" aria-hidden="true" />
                各 DCE 题目的选择分布
              </h2>
              <p className="mt-1.5 text-[0.88rem] text-sage-700">
                "低暴露方案选择率"用于 Pilot 检查"同向变化"题是否出现单边选择
                （见 docs/RESEARCH_NOTES.md B1）。若某项接近 100%，说明该题可能较少提供属性信息。
              </p>

              <div className="mt-3.5 overflow-x-auto rounded-surface border border-sage-200 bg-white">
                <table className="w-full min-w-[52rem] border-collapse text-[0.88rem]">
                  <caption className="sr-only">各 DCE 题目的选择分布统计</caption>
                  <thead>
                    <tr className="border-b border-sage-200 bg-sage-50 text-left">
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">任务</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">卷别</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">n</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">选左</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">选右</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">左侧比例</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">低暴露方案选择率</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">被选中的配置</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.taskDistribution.map((row) => (
                      <tr key={row.taskId} className="border-b border-sage-100 last:border-0">
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-forest-800">{row.taskId}</td>
                        <td className="px-3.5 py-2.5">{row.block}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{row.total}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{row.leftCount}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{row.rightCount}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{percent(row.leftShare)}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">
                          {percent(row.lowerExposureShare)}
                          {row.lowerExposureShare !== null && row.lowerExposureShare > 0.95 && (
                            <span className="ml-1.5 text-[0.78rem] text-champagne-800">需审查</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {Object.entries(row.selectedProfileCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([pid, count]) => `${pid}:${count}`)
                            .join('  ')}
                        </td>
                      </tr>
                    ))}
                    {stats.taskDistribution.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3.5 py-6 text-center text-sage-600">
                          暂无 DCE 数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 配置评分完整性 ───────────────────────────── */}
            <section aria-labelledby="admin-ratings">
              <h2 id="admin-ratings" className="flex items-center gap-2 text-[1.15rem] font-semibold text-forest-800">
                <Database className="h-5 w-5" aria-hidden="true" />
                配置评分数据完整性
              </h2>
              <div className="mt-3.5 overflow-x-auto rounded-surface border border-sage-200 bg-white">
                <table className="w-full min-w-[34rem] border-collapse text-[0.88rem]">
                  <caption className="sr-only">各配置的评分记录数与完整记录数</caption>
                  <thead>
                    <tr className="border-b border-sage-200 bg-sage-50 text-left">
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">配置</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">被评价次数</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">12 题齐全</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold text-forest-800">完整率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ratingCoverage.map((row) => (
                      <tr key={row.profileId} className="border-b border-sage-100 last:border-0">
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-forest-800">{row.profileId}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{row.ratedCount}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">{row.completeCount}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums">
                          {row.ratedCount > 0 ? percent(row.completeCount / row.ratedCount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 text-[0.85rem] text-sage-600">
                评分配置采用平衡分配机制（步长 2 循环），因此各配置的被评价次数应当接近相等。
              </p>
            </section>

            {/* ── 量表均值与理解检查 ───────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="admin-scales">
                <h2 id="admin-scales" className="text-[1.15rem] font-semibold text-forest-800">量表均值</h2>
                <div className="mt-3.5 space-y-2.5">
                  {stats.scaleMeans.map((row) => (
                    <div key={row.construct} className="rounded-panel border border-sage-200 bg-white px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[0.95rem] font-semibold text-forest-800">{row.label}</p>
                        <p className="font-mono text-[1.1rem] font-semibold tabular-nums text-forest-800">
                          {row.mean === null ? '—' : row.mean.toFixed(2)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[0.8rem] text-sage-600">
                        {row.direction} · n = {row.n}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 flex items-start gap-2 text-[0.82rem] leading-relaxed text-sage-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  隐私担忧分数越高表示担忧越强，未做反向计分。
                </p>
              </section>

              <section aria-labelledby="admin-quality">
                <h2 id="admin-quality" className="text-[1.15rem] font-semibold text-forest-800">
                  理解检查与模拟使用
                </h2>
                <div className="mt-3.5 space-y-2.5">
                  {stats.comprehension.map((row) => (
                    <div key={row.questionId} className="rounded-panel border border-sage-200 bg-white px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[0.95rem] font-semibold text-forest-800">
                          {row.questionId} 首次答对率
                        </p>
                        <p className="font-mono text-[1.1rem] font-semibold tabular-nums text-forest-800">
                          {percent(row.correctnessRate)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[0.8rem] text-sage-600">
                        n = {row.total} · 平均重试 {row.averageRetries.toFixed(2)} 次
                      </p>
                    </div>
                  ))}

                  <div className="rounded-panel border border-sage-200 bg-white px-4 py-3">
                    <p className="text-[0.95rem] font-semibold text-forest-800">情景模拟使用</p>
                    <p className="mt-1 text-[0.85rem] text-sage-700">
                      共打开 {stats.simulation.totalOpens} 次，涉及 {stats.simulation.participantsWhoOpened} 名参与者，
                      平均停留 {formatDuration(stats.simulation.averageDurationMs)}。
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {stats.simulation.byProfile
                        .filter((p) => p.opens > 0)
                        .map((p) => (
                          <Badge key={p.profileId} tone="neutral">
                            {p.profileId}: {p.opens}
                          </Badge>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-panel border border-sage-200 bg-white px-4 py-3">
                    <p className="text-[0.95rem] font-semibold text-forest-800">数据质量提示</p>
                    <p className="mt-1 text-[0.85rem] leading-relaxed text-sage-700">
                      理解检查首次答错的人数（任一题）：{stats.quality.comprehensionConcern}
                      <br />
                      DCE 作答时长不足 2 秒的记录：{stats.quality.tooFastDce}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* ── 模块六：理想配置分布 ─────────────────────── */}
            <section aria-labelledby="admin-custom">
              <h2 id="admin-custom" className="flex items-center gap-2 text-[1.15rem] font-semibold text-forest-800">
                <Layers className="h-5 w-5" aria-hidden="true" />
                理想配置自由设定（模块六）
              </h2>
              <p className="mt-1.5 text-[0.88rem] leading-relaxed text-sage-700">
                参与者最后自己拼出的配置分布。可与 DCE 的选择分布对照，
                看出"理想偏好"与"被迫权衡时的实际选择"之间的差距。
                完成该部分的人数：{stats.customConfig.total}
                {stats.customConfig.averageDurationMs !== null && (
                  <> · 平均耗时 {formatDuration(stats.customConfig.averageDurationMs)}</>
                )}
              </p>

              <div className="mt-3.5 grid gap-3 lg:grid-cols-2">
                <div className="rounded-surface border border-sage-200 bg-white p-4">
                  <p className="text-[0.9rem] font-semibold text-forest-800">各配置被自由选择次数</p>
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {stats.customConfig.profileCounts.map((row) => (
                      <li key={row.profileId} className="flex items-baseline justify-between gap-2 text-[0.88rem]">
                        <span className="font-mono font-semibold text-forest-800">{row.profileId}</span>
                        <span className="font-mono tabular-nums text-sage-700">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-surface border border-sage-200 bg-white p-4">
                  <p className="text-[0.9rem] font-semibold text-forest-800">
                    三个开关"开"的数量分布
                  </p>
                  <p className="mt-1 text-[0.8rem] text-sage-600">
                    0 = 全关（最低暴露）… 3 = 全开（最高暴露）
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {stats.customConfig.exposureLevelCounts.map((row) => {
                      const pct =
                        stats.customConfig.total > 0 ? row.count / stats.customConfig.total : 0
                      return (
                        <li key={row.level} className="text-[0.88rem]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sage-700">{row.level} 个开关开启</span>
                            <span className="font-mono tabular-nums text-forest-800">
                              {row.count}（{percent(pct)}）
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sage-100">
                            <div
                              className="h-full rounded-full bg-forest-500"
                              style={{ width: `${Math.round(pct * 100)}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </section>

            {/* ── CSV 导出 ─────────────────────────────────── */}
            <section aria-labelledby="admin-export">
              <h2 id="admin-export" className="flex items-center gap-2 text-[1.15rem] font-semibold text-forest-800">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                数据导出（CSV）
              </h2>
              <p className="mt-1.5 text-[0.88rem] text-sage-700">
                导出经由服务端接口完成，服务端会再次验证您的登录凭据与管理员权限。
                文件使用 UTF-8 BOM 编码，可直接用 Excel 打开中文。
              </p>

              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleExport(option.key)}
                    disabled={exporting !== null}
                    className="flex min-h-20 flex-col items-start gap-1 rounded-surface border border-sage-200 bg-white px-4 py-3.5 text-left shadow-card transition hover:border-forest-500 hover:bg-forest-50 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2 font-mono text-[0.9rem] font-semibold text-forest-800">
                      {exporting === option.key ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                      {option.label}
                    </span>
                    <span className="text-[0.82rem] leading-relaxed text-sage-700">{option.detail}</span>
                  </button>
                ))}
              </div>

              {!config.hasSupabaseClientConfig && (
                <p className="mt-3 flex items-start gap-2 text-[0.85rem] leading-relaxed text-champagne-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  当前未配置 Supabase，导出接口将返回错误。请先完成 Supabase 配置与数据库迁移。
                </p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
