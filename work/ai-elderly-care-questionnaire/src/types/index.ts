/**
 * 全局领域类型定义
 *
 * 命名约定与 V1.0 文件保持一致：
 *   X1 共享层级 / X2 共享对象 / X3 详细监测方式（文件另称"监测时长"）
 *
 * 重要：属性水平一律以 0 / 1 存储，与 V1.0 配置表 (C1–C8) 完全一致。
 * 任何中文标签都只用于展示，不参与统计计算。
 */

// ─────────────────────────────────────────────────────────────
// 实验属性
// ─────────────────────────────────────────────────────────────

/** 实验属性编码。固定为三个，顺序即展示顺序。 */
export const ATTRIBUTE_KEYS = ['X1', 'X2', 'X3'] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]

/** 属性水平。0 = V1.0 表中的"水平0"，1 = "水平1"。 */
export type AttributeLevel = 0 | 1

/** 三个属性的水平组合。 */
export interface AttributeProfile {
  X1: AttributeLevel
  X2: AttributeLevel
  X3: AttributeLevel
}

/** 系统配置编码 C1–C8。 */
export type ProfileId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8'

/** 一条完整配置（研究操纵的载体）。 */
export interface Profile extends AttributeProfile {
  id: ProfileId
}

// ─────────────────────────────────────────────────────────────
// DCE
// ─────────────────────────────────────────────────────────────

/** A/B 卷别。 */
export type BlockId = 'A' | 'B'

/** 任务编号 T01–T12。 */
export type TaskId =
  | 'T01' | 'T02' | 'T03' | 'T04' | 'T05' | 'T06'
  | 'T07' | 'T08' | 'T09' | 'T10' | 'T11' | 'T12'

/** V1.0 表 3 中的"结构类型"。 */
export type StructureType = '同向变化' | '替代权衡'

/**
 * 一道 DCE 任务。
 *
 * `profileA` / `profileB` 是 V1.0 任务表中写明的**文本位置**（方案A / 方案B）。
 * 实际展示时左右会随机交换，交换结果记录在 `task_display_order` 与
 * `left_profile_id` / `right_profile_id` 中，本对象**不被修改**。
 */
export interface DceTask {
  id: TaskId
  block: BlockId
  /** V1.0 表中"方案A"对应的配置。 */
  profileA: ProfileId
  /** V1.0 表中"方案B"对应的配置。 */
  profileB: ProfileId
  /** 本题发生变化的属性（由编码计算得出，用于内部审计，不向参与者展示）。 */
  changedAttributes: AttributeKey[]
  /** V1.0 表 3 的结构类型（内部备注，不向参与者展示）。 */
  structureType: StructureType
}

/** 参与者对一道 DCE 任务的作答记录。 */
export interface DceChoiceRecord {
  taskId: TaskId
  blockId: BlockId
  /** 该题在本卷中的展示次序，从 1 开始。 */
  taskDisplayOrder: number
  leftProfileId: ProfileId
  rightProfileId: ProfileId
  leftProfileAttributes: AttributeProfile
  rightProfileAttributes: AttributeProfile
  selectedSide: 'left' | 'right'
  selectedProfileId: ProfileId
  responseDurationMs: number
}

// ─────────────────────────────────────────────────────────────
// 量表
// ─────────────────────────────────────────────────────────────

/** 四个构念。 */
export type ConstructKey = 'security' | 'privacy' | 'autonomy' | 'intention'

/** 量表题号 S1–S3 / P1–P3 / A1–A3 / I1–I3。 */
export type ScaleItemId =
  | 'S1' | 'S2' | 'S3'
  | 'P1' | 'P2' | 'P3'
  | 'A1' | 'A2' | 'A3'
  | 'I1' | 'I2' | 'I3'

/** 5 点 Likert 取值。 */
export type LikertValue = 1 | 2 | 3 | 4 | 5

export interface ScaleItem {
  id: ScaleItemId
  construct: ConstructKey
  /** V1.0 原文题目，一字未改。 */
  text: string
}

/** 单个配置的 12 题评分。 */
export type ProfileRatingScores = Record<ScaleItemId, LikertValue>

/** 参与者对一个配置的完整评价记录。 */
export interface ProfileRatingRecord extends AttributeProfile {
  profileId: ProfileId
  /** 该配置在本次问卷中的评价次序，从 1 开始。 */
  ratingOrder: number
  scores: ProfileRatingScores
}

// ─────────────────────────────────────────────────────────────
// 身份信息与总体评价
// ─────────────────────────────────────────────────────────────

export type AgeGroup = '18-29' | '30-44' | '45-59' | '60-69' | '70+'
export type RespondentRole = 'older_adult' | 'current_caregiver' | 'prospective_caregiver' | 'other'
export type AiDeviceExperience = 'used' | 'aware_not_used' | 'unaware'
export type CaregivingExperience = 'often' | 'sometimes' | 'never'

export interface IdentityInfo {
  ageGroup: AgeGroup | null
  respondentRole: RespondentRole | null
  /** 当 respondentRole 为 other 时的说明文字。 */
  respondentRoleOther: string
  aiDeviceExperience: AiDeviceExperience | null
  caregivingExperience: CaregivingExperience | null
}

/** Q9 最担心的问题（选项）。 */
export type MainConcern = 'insufficient_detection' | 'privacy_exposure' | 'limited_autonomy' | 'complex_operation' | 'other'

export interface OverallEvaluation {
  /** Q8 总体采纳意愿 1–5。 */
  q8: LikertValue | null
  /** Q9 最担心的问题。 */
  q9: MainConcern | null
  /** Q10 开放性建议，可跳过。 */
  q10: string
}

// ─────────────────────────────────────────────────────────────
// 理解检查
// ─────────────────────────────────────────────────────────────

export type ComprehensionQuestionId = 'Q6' | 'Q7'

export interface ComprehensionRecord {
  questionId: ComprehensionQuestionId
  /** 首次作答所选选项索引。 */
  firstAnswerIndex: number
  isCorrect: boolean
  /** 首次答错后重新作答的次数。 */
  retryCount: number
}

// ─────────────────────────────────────────────────────────────
// 模拟使用埋点
// ─────────────────────────────────────────────────────────────

export type SimulationEventType = 'open' | 'close' | 'complete' | 'view_details' | 'replay'

export interface SimulationEventRecord {
  /** 若在 DCE 中打开，记录对应任务；独立体验页为 null。 */
  taskId: TaskId | null
  profileId: ProfileId
  eventType: SimulationEventType
  /** 相对问卷开始的毫秒时间戳。 */
  eventTimestampMs: number
  /** 停留时长（close 事件记录）。 */
  durationMs: number | null
  /** 来源：正式问卷内，或独立情景体验页。 */
  source: 'dce' | 'experience'
}

// ─────────────────────────────────────────────────────────────
// 会话与提交
// ─────────────────────────────────────────────────────────────

export type SubmissionStatus = 'draft' | 'submitted' | 'failed'

/** 完整问卷草稿。这是本地持久化与提交的单一数据形态。 */
export interface QuestionnaireDraft {
  /** 问卷版本号，用于 Pilot 与正式版数据分离。 */
  questionnaireVersion: string
  /** 匿名参与者标识（本地生成，不含任何个人身份信息）。 */
  participantId: string
  /** 随机分配的卷别；一旦生成，在同一问卷会话中不再改变。 */
  assignedBlock: BlockId | null

  consentStatus: 'pending' | 'agreed' | 'declined'
  consentTimestamp: string | null

  identity: IdentityInfo
  comprehension: ComprehensionRecord[]

  /** 本卷 6 道任务的随机化结果（展示顺序 + 左右交换）。 */
  dceTaskOrder: DceTaskDisplayPlan[]
  dceChoices: DceChoiceRecord[]

  /** 本次抽中的 4 个待评价配置（含顺序）。 */
  ratingPlan: ProfileId[]
  profileRatings: ProfileRatingRecord[]

  overall: OverallEvaluation

  /** 是否在本问卷之前使用过独立"情景体验"页面。 */
  priorExperience: boolean
  simulationEvents: SimulationEventRecord[]

  /** 会话开始时间（ISO）。 */
  startedAt: string
  /** 最后更新时间（ISO）。 */
  updatedAt: string
}

/**
 * 一道 DCE 任务的随机化展示方案。
 *
 * 这是"随机化结果"的唯一载体：一旦写入草稿，就不再重新生成，
 * 以保证返回上一题时左右位置不变。
 */
export interface DceTaskDisplayPlan {
  taskId: TaskId
  /** 该题在本卷中的展示次序，从 1 开始。 */
  displayOrder: number
  leftProfileId: ProfileId
  rightProfileId: ProfileId
}

/** 提交到服务端的完整载荷。 */
export interface SurveySubmission {
  questionnaireVersion: string
  participantId: string
  assignedBlock: BlockId
  consentStatus: 'agreed'
  consentTimestamp: string
  identity: IdentityInfo
  comprehension: ComprehensionRecord[]
  dceChoices: DceChoiceRecord[]
  profileRatings: ProfileRatingRecord[]
  overall: OverallEvaluation
  priorExperience: boolean
  simulationEvents: SimulationEventRecord[]
  startedAt: string
  submittedAt: string
  /** 客户端测得的整体填写时长（毫秒）。 */
  totalDurationMs: number
}

/** 提交接口响应。 */
export interface SubmissionResult {
  ok: boolean
  /** 数据落库模式：demo = 仅本地演示，未写入云端。 */
  mode: 'demo' | 'supabase'
  message: string
  /** 服务端校验失败时的字段级错误。 */
  fieldErrors?: Record<string, string>
}
