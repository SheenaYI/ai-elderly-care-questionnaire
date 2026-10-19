import { getSupabaseClient } from '@/lib/supabase/client'
import { PROFILE_IDS } from '@/data/profiles'
import { ALL_TASK_IDS, TASKS_PER_BLOCK } from '@/data/dceTasks'
import { ALL_SCALE_ITEM_IDS } from '@/data/scales'
import type { BlockId, ProfileId, TaskId } from '@/types'

/**
 * 研究管理后台的统计计算。
 *
 * 数据来源：Supabase（受 RLS 保护，只有 research_admins 白名单内的
 * 已认证用户才能读取）。**不使用** service_role key。
 *
 * 注意：后台只读取汇总所需的字段，不进行任何写入。
 */

export interface ParticipantRow {
  participant_id: string
  questionnaire_version: string
  assigned_block: BlockId
  age_group: string
  respondent_role: string
  ai_device_experience: string
  caregiving_experience: string
  prior_experience: boolean
  submission_status: string
  started_at: string
  submitted_at: string | null
  total_duration_ms: number | null
  created_at: string
}

export interface DceChoiceRow {
  participant_id: string
  task_id: TaskId
  block_id: BlockId
  task_display_order: number
  left_profile_id: ProfileId
  right_profile_id: ProfileId
  selected_side: 'left' | 'right'
  selected_profile_id: ProfileId
  response_duration_ms: number
}

export interface ProfileRatingRow {
  participant_id: string
  profile_id: ProfileId
  x1: number
  x2: number
  x3: number
  rating_order: number
  s1: number; s2: number; s3: number
  p1: number; p2: number; p3: number
  a1: number; a2: number; a3: number
  i1: number; i2: number; i3: number
}

export interface ComprehensionRow {
  participant_id: string
  question_id: 'Q6' | 'Q7'
  first_answer_index: number
  is_correct: boolean
  retry_count: number
}

export interface SimulationEventRow {
  participant_id: string
  task_id: string | null
  profile_id: ProfileId
  event_type: string
  source: string
  duration_ms: number | null
}

export interface SurveyResponseRow {
  participant_id: string
  q8: number
  q9: string
  q10: string
}

/** 模块六：参与者自由设定的理想配置。 */
export interface CustomConfigRow {
  participant_id: string
  x1: number
  x2: number
  x3: number
  matched_profile_id: ProfileId | null
  response_duration_ms: number
}

export interface AdminDataset {
  participants: ParticipantRow[]
  dceChoices: DceChoiceRow[]
  profileRatings: ProfileRatingRow[]
  comprehension: ComprehensionRow[]
  simulationEvents: SimulationEventRow[]
  surveyResponses: SurveyResponseRow[]
  customConfigs: CustomConfigRow[]
}

export interface AdminStats {
  overview: {
    totalParticipants: number
    submittedCount: number
    draftCount: number
    blockA: number
    blockB: number
    completionRate: number
    averageDurationMs: number | null
    medianDurationMs: number | null
    versions: { version: string; count: number }[]
  }
  /** 每个 DCE 任务的选择分布（用于 Pilot 检查单边选择）。 */
  taskDistribution: {
    taskId: TaskId
    block: BlockId
    total: number
    leftCount: number
    rightCount: number
    leftShare: number
    /** 各配置被选中的次数。 */
    selectedProfileCounts: Partial<Record<ProfileId, number>>
    /** 该题两方案中，暴露水平更低的方案被选中的比例（同向变化题审查用）。 */
    lowerExposureShare: number | null
  }[]
  /** 各配置的评分完整性。 */
  ratingCoverage: {
    profileId: ProfileId
    ratedCount: number
    /** 12 题齐全的记录数。 */
    completeCount: number
  }[]
  comprehension: {
    questionId: 'Q6' | 'Q7'
    total: number
    firstTryCorrect: number
    correctnessRate: number
    averageRetries: number
  }[]
  simulation: {
    totalOpens: number
    participantsWhoOpened: number
    averageDurationMs: number | null
    byProfile: { profileId: ProfileId; opens: number }[]
  }
  /** 各量表的平均分（隐私担忧分数越高 = 担忧越强）。 */
  scaleMeans: {
    construct: string
    label: string
    direction: string
    mean: number | null
    n: number
  }[]
  /** 配置使用是否均衡（1 表示完全均衡）。 */
  ratingAllocationBalance: { profileId: ProfileId; count: number }[]
  /** 模块六：自由自选配置的分布与"理想 vs 实际选择"对比。 */
  customConfig: {
    /** 完成该部分的人数。 */
    total: number
    /** 各配置被自由选择的次数（C1–C8，缺省为 0）。 */
    profileCounts: { profileId: ProfileId; count: number }[]
    /** 单行用户占比（三个开关里"开"的数量）分布：0/1/2/3。 */
    exposureLevelCounts: { level: number; count: number }[]
    /** 平均作答耗时。 */
    averageDurationMs: number | null
  }
  quality: {
    /** 太快作答的 DCE 记录数（< 2 秒）。 */
    tooFastDce: number
    /** 位置效应：整体左侧选择比例。 */
    overallLeftShare: number | null
    /** 未通过理解检查首次作答的人数。 */
    comprehensionConcern: number
  }
}

const MAX_ROWS = 20000

async function fetchAll<T>(table: string, columns: string, orderBy?: string): Promise<T[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []
  let query = supabase.from(table).select(columns).limit(MAX_ROWS)
  if (orderBy) query = query.order(orderBy, { ascending: true })
  const { data, error } = await query
  if (error) throw new Error(`读取 ${table} 失败：${error.message}`)
  return (data ?? []) as T[]
}

/** 拉取全部研究数据（受 RLS 限制，只有授权研究人员能取到）。 */
export async function loadAdminDataset(): Promise<AdminDataset> {
  const [
    participants,
    dceChoices,
    profileRatings,
    comprehension,
    simulationEvents,
    surveyResponses,
    customConfigs,
  ] =
    await Promise.all([
      fetchAll<ParticipantRow>(
        'participants',
        'participant_id,questionnaire_version,assigned_block,age_group,respondent_role,ai_device_experience,caregiving_experience,prior_experience,submission_status,started_at,submitted_at,total_duration_ms,created_at',
        'created_at',
      ),
      fetchAll<DceChoiceRow>(
        'dce_choices',
        'participant_id,task_id,block_id,task_display_order,left_profile_id,right_profile_id,selected_side,selected_profile_id,response_duration_ms',
      ),
      fetchAll<ProfileRatingRow>(
        'profile_ratings',
        'participant_id,profile_id,x1,x2,x3,rating_order,s1,s2,s3,p1,p2,p3,a1,a2,a3,i1,i2,i3',
      ),
      fetchAll<ComprehensionRow>(
        'comprehension_checks',
        'participant_id,question_id,first_answer_index,is_correct,retry_count',
      ),
      fetchAll<SimulationEventRow>(
        'simulation_events',
        'participant_id,task_id,profile_id,event_type,source,duration_ms',
      ),
      fetchAll<SurveyResponseRow>('survey_responses', 'participant_id,q8,q9,q10'),
      fetchAll<CustomConfigRow>(
        'custom_config_choices',
        'participant_id,x1,x2,x3,matched_profile_id,response_duration_ms',
      ),
    ])

  return {
    participants,
    dceChoices,
    profileRatings,
    comprehension,
    simulationEvents,
    surveyResponses,
    customConfigs,
  }
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * 各配置的"暴露水平总和"（X1+X2+X3，0–3）。
 * 由 src/data/profiles.ts 的 C1–C8 取值直接推导，与数据库中的属性列一致。
 */
const PROFILE_EXPOSURE: Record<ProfileId, number> = {
  C1: 0, C2: 1, C3: 2, C4: 1, C5: 2, C6: 1, C7: 2, C8: 3,
}

/** 由原始数据计算后台所需全部统计。 */
export function computeAdminStats(dataset: AdminDataset): AdminStats {
  const { participants, dceChoices, profileRatings, comprehension, simulationEvents } = dataset

  const submitted = participants.filter((p) => p.submission_status === 'submitted')
  const durations = participants
    .map((p) => p.total_duration_ms)
    .filter((v): v is number => typeof v === 'number' && v > 0)

  const versionCounts = new Map<string, number>()
  for (const p of participants) {
    versionCounts.set(p.questionnaire_version, (versionCounts.get(p.questionnaire_version) ?? 0) + 1)
  }

  // ── 逐题选择分布 ────────────────────────────────────────
  const taskDistribution: AdminStats['taskDistribution'] = []
  for (const taskId of ALL_TASK_IDS) {
    const rows = dceChoices.filter((c) => c.task_id === taskId)
    if (rows.length === 0) continue

    const leftCount = rows.filter((r) => r.selected_side === 'left').length
    const selectedProfileCounts: Partial<Record<ProfileId, number>> = {}
    for (const row of rows) {
      selectedProfileCounts[row.selected_profile_id] =
        (selectedProfileCounts[row.selected_profile_id] ?? 0) + 1
    }

    // 低暴露方案被选中的比例（同向变化题的 Pilot 审查指标）
    let lowerExposureHits = 0
    let lowerExposureTotal = 0
    for (const row of rows) {
      const leftExp = PROFILE_EXPOSURE[row.left_profile_id]
      const rightExp = PROFILE_EXPOSURE[row.right_profile_id]
      if (leftExp === rightExp) continue
      const lowerId = leftExp < rightExp ? row.left_profile_id : row.right_profile_id
      lowerExposureTotal += 1
      if (row.selected_profile_id === lowerId) lowerExposureHits += 1
    }

    taskDistribution.push({
      taskId,
      block: rows[0]!.block_id,
      total: rows.length,
      leftCount,
      rightCount: rows.length - leftCount,
      leftShare: leftCount / rows.length,
      selectedProfileCounts,
      lowerExposureShare:
        lowerExposureTotal > 0 ? lowerExposureHits / lowerExposureTotal : null,
    })
  }

  // ── 评分覆盖 ────────────────────────────────────────────
  const ratingCoverage = PROFILE_IDS.map((profileId) => {
    const rows = profileRatings.filter((r) => r.profile_id === profileId)
    const complete = rows.filter((r) =>
      ALL_SCALE_ITEM_IDS.every((id) => typeof (r as unknown as Record<string, number>)[id.toLowerCase()] === 'number'),
    )
    return { profileId, ratedCount: rows.length, completeCount: complete.length }
  })

  // ── 理解检查 ────────────────────────────────────────────
  const comprehensionStats: AdminStats['comprehension'] = (['Q6', 'Q7'] as const).map((qid) => {
    const rows = comprehension.filter((c) => c.question_id === qid)
    const correct = rows.filter((r) => r.is_correct).length
    return {
      questionId: qid,
      total: rows.length,
      firstTryCorrect: correct,
      correctnessRate: rows.length > 0 ? correct / rows.length : 0,
      averageRetries: mean(rows.map((r) => r.retry_count)) ?? 0,
    }
  })

  // ── 模拟使用 ────────────────────────────────────────────
  const openEvents = simulationEvents.filter((e) => e.event_type === 'open')
  const closeEvents = simulationEvents.filter(
    (e) => e.event_type === 'close' && typeof e.duration_ms === 'number',
  )
  const simulationByProfile = PROFILE_IDS.map((profileId) => ({
    profileId,
    opens: openEvents.filter((e) => e.profile_id === profileId).length,
  }))

  // ── 量表均值 ────────────────────────────────────────────
  const CONSTRUCT_ITEMS: { construct: string; label: string; direction: string; keys: (keyof ProfileRatingRow)[] }[] = [
    { construct: 'security', label: '安全感', direction: '分数越高表示安全感越强', keys: ['s1', 's2', 's3'] },
    { construct: 'privacy', label: '隐私担忧', direction: '分数越高表示隐私担忧越强', keys: ['p1', 'p2', 'p3'] },
    { construct: 'autonomy', label: '自主感', direction: '分数越高表示自主感越强', keys: ['a1', 'a2', 'a3'] },
    { construct: 'intention', label: '采纳意愿', direction: '分数越高表示采纳意愿越强', keys: ['i1', 'i2', 'i3'] },
  ]

  const scaleMeans = CONSTRUCT_ITEMS.map((entry) => {
    const values: number[] = []
    for (const row of profileRatings) {
      for (const key of entry.keys) {
        const value = row[key]
        if (typeof value === 'number') values.push(value)
      }
    }
    return {
      construct: entry.construct,
      label: entry.label,
      direction: entry.direction,
      mean: mean(values),
      n: values.length,
    }
  })

  // ── 质量指标 ────────────────────────────────────────────
  const tooFastDce = dceChoices.filter((c) => c.response_duration_ms < 2000).length
  const overallLeftShare =
    dceChoices.length > 0
      ? dceChoices.filter((c) => c.selected_side === 'left').length / dceChoices.length
      : null
  const comprehensionConcern = new Set(
    comprehension.filter((c) => !c.is_correct).map((c) => c.participant_id),
  ).size

  // ── 模块六统计 ──────────────────────────────────────────
  const customRows = dataset.customConfigs
  const customProfileCounts = PROFILE_IDS.map((profileId) => ({
    profileId,
    count: customRows.filter((r) => r.matched_profile_id === profileId).length,
  }))
  const exposureLevelCounts = [0, 1, 2, 3].map((level) => ({
    level,
    count: customRows.filter((r) => r.x1 + r.x2 + r.x3 === level).length,
  }))

  return {
    overview: {
      totalParticipants: participants.length,
      submittedCount: submitted.length,
      draftCount: participants.length - submitted.length,
      blockA: participants.filter((p) => p.assigned_block === 'A').length,
      blockB: participants.filter((p) => p.assigned_block === 'B').length,
      completionRate: participants.length > 0 ? submitted.length / participants.length : 0,
      averageDurationMs: mean(durations),
      medianDurationMs: median(durations),
      versions: [...versionCounts.entries()].map(([version, count]) => ({ version, count })),
    },
    taskDistribution,
    ratingCoverage,
    comprehension: comprehensionStats,
    simulation: {
      totalOpens: openEvents.length,
      participantsWhoOpened: new Set(openEvents.map((e) => e.participant_id)).size,
      averageDurationMs: mean(
        closeEvents.map((e) => e.duration_ms).filter((v): v is number => typeof v === 'number'),
      ),
      byProfile: simulationByProfile,
    },
    scaleMeans,
    ratingAllocationBalance: ratingCoverage.map((r) => ({
      profileId: r.profileId,
      count: r.ratedCount,
    })),
    quality: { tooFastDce, overallLeftShare, comprehensionConcern },
    customConfig: {
      total: customRows.length,
      profileCounts: customProfileCounts,
      exposureLevelCounts,
      averageDurationMs: mean(customRows.map((r) => r.response_duration_ms)),
    },
  }
}

/** 数据字典中需要的常量，供后台展示。 */
export const ADMIN_CONSTANTS = {
  tasksPerBlock: TASKS_PER_BLOCK,
  dceTaskIds: ALL_TASK_IDS,
} as const
