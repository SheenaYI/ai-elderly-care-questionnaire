/**
 * 问卷数据校验规则（前后端共用）。
 *
 * 服务端提交接口 (`api/submit-survey.ts`) 直接 import 本文件，
 * 保证"客户端校验"与"服务端校验"完全一致，服务端不信任客户端结果。
 *
 * ⚠️ 本文件及其依赖链**刻意使用相对路径导入**，不使用 `@/` 别名。
 *    原因：前端构建（Vite）会解析 tsconfig 的 paths 别名，但
 *    serverless 平台的函数打包器通常不读取 tsconfig 的 paths，
 *    若此处使用 `@/` 别名，部署后接口会在运行时报模块解析失败。
 *    此处目录层级固定（src/lib/validation → ../../data），因此相对路径安全。
 */

import { z } from 'zod'
import { PROFILE_IDS } from '../../data/profiles'
import {
  ALL_TASK_IDS,
  BLOCK_TASK_IDS,
  TASKS_PER_BLOCK,
  PROFILES_PER_PARTICIPANT,
} from '../../data/dceTasks'
import { ALL_SCALE_ITEM_IDS, SCALE_ITEM_COUNT } from '../../data/scales'
import {
  COMPREHENSION_QUESTIONS,
  QUESTIONNAIRE_VERSION,
  correctOptionIndex,
} from '../../data/questionnaire'

// ─────────────────────────────────────────────────────────────
// 基础枚举
// ─────────────────────────────────────────────────────────────

export const attributeLevelSchema = z.union([z.literal(0), z.literal(1)])
export const profileIdSchema = z.enum(PROFILE_IDS as [string, ...string[]])
export const taskIdSchema = z.enum(ALL_TASK_IDS as [string, ...string[]])
export const blockIdSchema = z.enum(['A', 'B'])
export const likertValueSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
])
export const scaleItemIdSchema = z.enum(ALL_SCALE_ITEM_IDS as [string, ...string[]])

export const attributeProfileSchema = z.object({
  X1: attributeLevelSchema,
  X2: attributeLevelSchema,
  X3: attributeLevelSchema,
})

export const ageGroupSchema = z.enum(['18-29', '30-44', '45-59', '60-69', '70+'])
export const respondentRoleSchema = z.enum([
  'older_adult', 'current_caregiver', 'prospective_caregiver', 'other',
])
export const aiDeviceExperienceSchema = z.enum(['used', 'aware_not_used', 'unaware'])
export const caregivingExperienceSchema = z.enum(['often', 'sometimes', 'never'])
export const mainConcernSchema = z.enum([
  'insufficient_detection', 'privacy_exposure', 'limited_autonomy', 'complex_operation', 'other',
])

// ─────────────────────────────────────────────────────────────
// 身份信息
// ─────────────────────────────────────────────────────────────

export const identitySchema = z.object({
  ageGroup: ageGroupSchema,
  respondentRole: respondentRoleSchema,
  respondentRoleOther: z.string().max(200).default(''),
  aiDeviceExperience: aiDeviceExperienceSchema,
  caregivingExperience: caregivingExperienceSchema,
})

// ─────────────────────────────────────────────────────────────
// 理解检查
// ─────────────────────────────────────────────────────────────

export const comprehensionRecordSchema = z.object({
  questionId: z.enum(['Q6', 'Q7']),
  firstAnswerIndex: z.number().int().min(0).max(2),
  isCorrect: z.boolean(),
  retryCount: z.number().int().min(0).max(50),
})

/** 校验 isCorrect 是否与题目正确答案一致（防止客户端伪造）。 */
export function comprehensionRecordIsConsistent(record: {
  questionId: 'Q6' | 'Q7'
  firstAnswerIndex: number
  isCorrect: boolean
}): boolean {
  const correct = correctOptionIndex(record.questionId)
  return record.isCorrect === (record.firstAnswerIndex === correct)
}

/** 两道理解检查题都必须有记录。 */
export const comprehensionSchema = z
  .array(comprehensionRecordSchema)
  .length(COMPREHENSION_QUESTIONS.length, '理解检查题必须全部作答')
  .superRefine((records, ctx) => {
    const ids = records.map((r) => r.questionId)
    for (const q of COMPREHENSION_QUESTIONS) {
      if (!ids.includes(q.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `缺少理解检查题 ${q.id} 的记录` })
      }
    }
  })

// ─────────────────────────────────────────────────────────────
// DCE 选择
// ─────────────────────────────────────────────────────────────

export const dceChoiceSchema = z.object({
  taskId: taskIdSchema,
  blockId: blockIdSchema,
  taskDisplayOrder: z.number().int().min(1).max(TASKS_PER_BLOCK),
  leftProfileId: profileIdSchema,
  rightProfileId: profileIdSchema,
  leftProfileAttributes: attributeProfileSchema,
  rightProfileAttributes: attributeProfileSchema,
  selectedSide: z.enum(['left', 'right']),
  selectedProfileId: profileIdSchema,
  responseDurationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
})

/**
 * 完整 DCE 数据校验。
 *
 * 检查项：
 *   - 恰好 6 道题
 *   - 题目均属于所分配的卷别，无重复、无缺失
 *   - selected_profile_id 与 selected_side 指向的配置一致（**关键**：
 *     不能只记录"选了方案A"，必须能还原真正选中的 C1–C8 配置）
 *   - 左右配置与该题的 V1.0 配对一致，且左右不同
 *   - 属性快照与配置编码一致
 */
export const dceChoicesSchema = z
  .array(dceChoiceSchema)
  .length(TASKS_PER_BLOCK, `必须完成全部 ${TASKS_PER_BLOCK} 道 DCE 题目`)

// ─────────────────────────────────────────────────────────────
// 配置评价
// ─────────────────────────────────────────────────────────────

const ratingScoresSchema = z.object(
  Object.fromEntries(ALL_SCALE_ITEM_IDS.map((id) => [id, likertValueSchema])) as Record<
    string,
    typeof likertValueSchema
  >,
)

export const profileRatingSchema = z.object({
  profileId: profileIdSchema,
  X1: attributeLevelSchema,
  X2: attributeLevelSchema,
  X3: attributeLevelSchema,
  ratingOrder: z.number().int().min(1).max(PROFILES_PER_PARTICIPANT),
  scores: ratingScoresSchema,
})

export const profileRatingsSchema = z
  .array(profileRatingSchema)
  .length(PROFILES_PER_PARTICIPANT, `必须完成 ${PROFILES_PER_PARTICIPANT} 个配置的评价`)

// ─────────────────────────────────────────────────────────────
// 总体评价
// ─────────────────────────────────────────────────────────────

export const overallSchema = z.object({
  q8: likertValueSchema,
  q9: mainConcernSchema,
  // Q10 可跳过
  q10: z.string().max(2000).default(''),
})

// ─────────────────────────────────────────────────────────────
// 模拟使用埋点
// ─────────────────────────────────────────────────────────────

export const simulationEventSchema = z.object({
  taskId: taskIdSchema.nullable(),
  profileId: profileIdSchema,
  eventType: z.enum(['open', 'close', 'complete', 'view_details', 'replay']),
  eventTimestampMs: z.number().int().min(0),
  durationMs: z.number().int().min(0).nullable(),
  source: z.enum(['dce', 'experience']),
})

// ─────────────────────────────────────────────────────────────
// 提交载荷
// ─────────────────────────────────────────────────────────────

export const submissionSchema = z.object({
  questionnaireVersion: z.literal(QUESTIONNAIRE_VERSION),
  participantId: z.string().min(8).max(128),
  assignedBlock: blockIdSchema,
  consentStatus: z.literal('agreed'),
  consentTimestamp: z.string().datetime(),
  identity: identitySchema,
  comprehension: comprehensionSchema,
  dceChoices: dceChoicesSchema,
  profileRatings: profileRatingsSchema,
  overall: overallSchema,
  priorExperience: z.boolean(),
  simulationEvents: z.array(simulationEventSchema).max(500),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  totalDurationMs: z.number().int().min(0),
})

export type SubmissionInput = z.infer<typeof submissionSchema>

// ─────────────────────────────────────────────────────────────
// 语义级校验（zod 结构校验之外的研究逻辑）
// ─────────────────────────────────────────────────────────────

export interface SemanticProblem {
  path: string
  message: string
}

/**
 * 服务端必须执行的研究语义校验。
 * 这些规则无法仅用 zod 结构表达。
 */
export function validateSubmissionSemantics(input: SubmissionInput): SemanticProblem[] {
  const problems: SemanticProblem[] = []

  // 1. DCE 题目必须属于所分配的卷别，且恰好覆盖该卷 6 题
  const expectedTasks = BLOCK_TASK_IDS[input.assignedBlock]
  const gotTasks = input.dceChoices.map((c) => c.taskId)
  for (const taskId of expectedTasks) {
    if (!gotTasks.includes(taskId as never)) {
      problems.push({ path: 'dceChoices', message: `${input.assignedBlock} 卷缺少题目 ${taskId}` })
    }
  }
  for (const taskId of gotTasks) {
    if (!expectedTasks.includes(taskId as never)) {
      problems.push({
        path: 'dceChoices',
        message: `题目 ${taskId} 不属于 ${input.assignedBlock} 卷`,
      })
    }
  }
  if (new Set(gotTasks).size !== gotTasks.length) {
    problems.push({ path: 'dceChoices', message: 'DCE 题目存在重复记录' })
  }

  // 2. 每题：选中的配置必须与所选一侧一致
  for (const choice of input.dceChoices) {
    const sideProfile =
      choice.selectedSide === 'left' ? choice.leftProfileId : choice.rightProfileId
    if (sideProfile !== choice.selectedProfileId) {
      problems.push({
        path: `dceChoices.${choice.taskId}`,
        message: `所选位置（${choice.selectedSide}）对应的配置为 ${sideProfile}，与记录的 selected_profile_id（${choice.selectedProfileId}）不一致`,
      })
    }
    if (choice.blockId !== input.assignedBlock) {
      problems.push({
        path: `dceChoices.${choice.taskId}`,
        message: `记录的卷别（${choice.blockId}）与分配的卷别（${input.assignedBlock}）不一致`,
      })
    }
    if (choice.leftProfileId === choice.rightProfileId) {
      problems.push({
        path: `dceChoices.${choice.taskId}`,
        message: '左右方案为同一配置',
      })
    }
    // 属性快照必须与配置编码一致
    const leftAttrs = choice.leftProfileAttributes
    const rightAttrs = choice.rightProfileAttributes
    if (!attrsLookValid(choice.leftProfileId, leftAttrs) || !attrsLookValid(choice.rightProfileId, rightAttrs)) {
      problems.push({
        path: `dceChoices.${choice.taskId}`,
        message: '属性快照与配置编码不一致',
      })
    }
  }

  // 3. 展示顺序必须是 1..6 的排列
  const orders = input.dceChoices.map((c) => c.taskDisplayOrder).sort((a, b) => a - b)
  for (let i = 0; i < TASKS_PER_BLOCK; i += 1) {
    if (orders[i] !== i + 1) {
      problems.push({ path: 'dceChoices', message: 'DCE 展示顺序不是 1–6 的完整排列' })
      break
    }
  }

  // 4. 配置评价：4 个不同配置，顺序为 1..4，12 题齐全
  const ratedProfiles = input.profileRatings.map((r) => r.profileId)
  if (new Set(ratedProfiles).size !== ratedProfiles.length) {
    problems.push({ path: 'profileRatings', message: '被评价的配置存在重复' })
  }
  const ratingOrders = input.profileRatings.map((r) => r.ratingOrder).sort((a, b) => a - b)
  for (let i = 0; i < PROFILES_PER_PARTICIPANT; i += 1) {
    if (ratingOrders[i] !== i + 1) {
      problems.push({ path: 'profileRatings', message: '评价顺序不是 1–4 的完整排列' })
      break
    }
  }
  for (const rating of input.profileRatings) {
    const scoreKeys = Object.keys(rating.scores)
    if (scoreKeys.length !== SCALE_ITEM_COUNT) {
      problems.push({
        path: `profileRatings.${rating.profileId}`,
        message: `量表题数为 ${scoreKeys.length}，应为 ${SCALE_ITEM_COUNT}`,
      })
    }
    if (!attrsLookValid(rating.profileId, rating)) {
      problems.push({
        path: `profileRatings.${rating.profileId}`,
        message: '配置的属性水平与配置编码不一致',
      })
    }
  }

  // 5. 理解检查的一致性（防止伪造 isCorrect）
  for (const record of input.comprehension) {
    if (!comprehensionRecordIsConsistent(record as never)) {
      problems.push({
        path: `comprehension.${record.questionId}`,
        message: '理解检查的 is_correct 与首次作答不一致',
      })
    }
  }

  // 6. 时间合理性
  const started = Date.parse(input.startedAt)
  const submitted = Date.parse(input.submittedAt)
  if (Number.isFinite(started) && Number.isFinite(submitted) && submitted < started) {
    problems.push({ path: 'submittedAt', message: '提交时间早于开始时间' })
  }

  return problems
}

/** 内部：属性快照是否与配置编码一致。 */
function attrsLookValid(
  profileId: string,
  attrs: { X1: number; X2: number; X3: number },
): boolean {
  const expected = EXPECTED_PROFILE_ATTRS[profileId]
  if (!expected) return false
  return attrs.X1 === expected.X1 && attrs.X2 === expected.X2 && attrs.X3 === expected.X3
}

const EXPECTED_PROFILE_ATTRS: Record<string, { X1: number; X2: number; X3: number }> = {
  C1: { X1: 0, X2: 0, X3: 0 },
  C2: { X1: 0, X2: 0, X3: 1 },
  C3: { X1: 0, X2: 1, X3: 1 },
  C4: { X1: 1, X2: 0, X3: 0 },
  C5: { X1: 1, X2: 0, X3: 1 },
  C6: { X1: 0, X2: 1, X3: 0 },
  C7: { X1: 1, X2: 1, X3: 0 },
  C8: { X1: 1, X2: 1, X3: 1 },
}

// ─────────────────────────────────────────────────────────────
// 前端"提交前检查"用：问卷完成度
// ─────────────────────────────────────────────────────────────

export interface CompletionReport {
  consent: boolean
  identity: boolean
  comprehension: boolean
  dce: boolean
  ratings: boolean
  overall: boolean
  /** 缺失项的面向参与者说明。 */
  missing: { section: string; detail: string }[]
  /** 是否全部完成，可以提交。 */
  complete: boolean
}

export function checkCompletion(draft: {
  consentStatus: string
  identity: {
    ageGroup: unknown
    respondentRole: unknown
    aiDeviceExperience: unknown
    caregivingExperience: unknown
    respondentRoleOther?: string
  }
  comprehension: readonly { questionId: string }[]
  dceChoices: readonly unknown[]
  profileRatings: readonly { scores: Record<string, unknown> }[]
  overall: { q8: unknown; q9: unknown; q10?: unknown }
}): CompletionReport {
  const missing: { section: string; detail: string }[] = []

  const consent = draft.consentStatus === 'agreed'
  if (!consent) missing.push({ section: '知情同意', detail: '尚未选择同意参与本研究' })

  const identity =
    draft.identity.ageGroup !== null &&
    draft.identity.ageGroup !== undefined &&
    draft.identity.respondentRole !== null &&
    draft.identity.respondentRole !== undefined &&
    draft.identity.aiDeviceExperience !== null &&
    draft.identity.aiDeviceExperience !== undefined &&
    draft.identity.caregivingExperience !== null &&
    draft.identity.caregivingExperience !== undefined &&
    (draft.identity.respondentRole !== 'other' ||
      (draft.identity.respondentRoleOther ?? '').trim().length > 0)
  if (!identity) missing.push({ section: '身份信息', detail: 'Q2–Q5 尚未全部作答' })

  const answeredComprehension = draft.comprehension.filter((c) => c.questionId).length
  const comprehension = answeredComprehension >= COMPREHENSION_QUESTIONS.length
  if (!comprehension) {
    missing.push({
      section: '理解检查',
      detail: `已作答 ${answeredComprehension} / ${COMPREHENSION_QUESTIONS.length} 题`,
    })
  }

  const dce = draft.dceChoices.length === TASKS_PER_BLOCK
  if (!dce) {
    missing.push({
      section: 'DCE 配置选择',
      detail: `已完成 ${draft.dceChoices.length} / ${TASKS_PER_BLOCK} 题`,
    })
  }

  const fullyRated = draft.profileRatings.filter(
    (r) => Object.keys(r.scores ?? {}).length === SCALE_ITEM_COUNT,
  ).length
  const ratings = fullyRated === PROFILES_PER_PARTICIPANT
  if (!ratings) {
    missing.push({
      section: '配置感知评价',
      detail: `已完成 ${fullyRated} / ${PROFILES_PER_PARTICIPANT} 个配置（每个配置 ${SCALE_ITEM_COUNT} 题）`,
    })
  }

  const overall =
    draft.overall.q8 !== null && draft.overall.q8 !== undefined &&
    draft.overall.q9 !== null && draft.overall.q9 !== undefined
  if (!overall) missing.push({ section: '总体评价', detail: 'Q8、Q9 尚未作答（Q10 可跳过）' })

  return {
    consent, identity, comprehension, dce, ratings, overall,
    missing,
    complete: missing.length === 0,
  }
}
