/**
 * 测试辅助：构造合法的问卷数据，供各测试用例复用。
 *
 * 这里的一切都从真实的配置文件中派生（profiles / dceTasks / scales），
 * 因此如果研究配置被改动，测试会立刻反映出来。
 */

import type {
  AttributeProfile,
  BlockId,
  ComprehensionRecord,
  DceChoiceRecord,
  ProfileId,
  ProfileRatingRecord,
  ProfileRatingScores,
  QuestionnaireDraft,
  ScaleItemId,
  SurveySubmission,
  TaskId,
} from '@/types'
import { PROFILES } from '@/data/profiles'
import { BLOCK_TASK_IDS, PROFILES_PER_PARTICIPANT, TASKS_PER_BLOCK, TASK_BY_ID } from '@/data/dceTasks'
import { ALL_SCALE_ITEM_IDS, SCALE_ITEM_COUNT } from '@/data/scales'
import { QUESTIONNAIRE_VERSION } from '@/data/questionnaire'
import { buildRatingPlan, buildTaskDisplayPlan } from '@/lib/randomization'
import { checkCompletion } from '@/lib/validation/schemas'

export function attrs(profileId: ProfileId): AttributeProfile {
  const p = PROFILES[profileId]
  return { X1: p.X1, X2: p.X2, X3: p.X3 }
}

/** 构造某卷的 6 条 DCE 记录（遵循随机化后的左右位置）。 */
export function buildDceChoices(block: BlockId, seed = 'test-seed'): DceChoiceRecord[] {
  const plan = buildTaskDisplayPlan(block, seed)
  return plan.map((item) => {
    const left = item.leftProfileId
    const right = item.rightProfileId
    // 总是选择左侧，以便测试 selected_profile_id 与 selected_side 的一致性
    return {
      taskId: item.taskId,
      blockId: block,
      taskDisplayOrder: item.displayOrder,
      leftProfileId: left,
      rightProfileId: right,
      leftProfileAttributes: attrs(left),
      rightProfileAttributes: attrs(right),
      selectedSide: 'left',
      selectedProfileId: left,
      responseDurationMs: 4200,
    }
  })
}

/** 构造 4 个配置 × 12 题的评分记录。 */
export function buildProfileRatings(sequenceIndex = 0): ProfileRatingRecord[] {
  const plan = buildRatingPlan(sequenceIndex, 'test-seed')
  return plan.map((profileId, index) => {
    const scores = {} as ProfileRatingScores
    for (const [i, itemId] of ALL_SCALE_ITEM_IDS.entries()) {
      scores[itemId as ScaleItemId] = (((i + index) % 5) + 1) as 1 | 2 | 3 | 4 | 5
    }
    return {
      profileId,
      ...attrs(profileId),
      ratingOrder: index + 1,
      scores,
    }
  })
}

export function buildComprehension(): ComprehensionRecord[] {
  return [
    { questionId: 'Q6', firstAnswerIndex: 0, isCorrect: true, retryCount: 0 },
    { questionId: 'Q7', firstAnswerIndex: 1, isCorrect: true, retryCount: 0 },
  ]
}

/** 构造一份完整、合法的提交载荷。 */
export function buildSubmission(
  overrides: Partial<SurveySubmission> = {},
  block: BlockId = 'A',
): SurveySubmission {
  const startedAt = new Date('2026-01-01T10:00:00.000Z').toISOString()
  const submittedAt = new Date('2026-01-01T10:12:00.000Z').toISOString()

  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    participantId: 'test-participant-0001',
    assignedBlock: block,
    consentStatus: 'agreed',
    consentTimestamp: startedAt,
    identity: {
      ageGroup: '30-44',
      respondentRole: 'current_caregiver',
      respondentRoleOther: '',
      aiDeviceExperience: 'aware_not_used',
      caregivingExperience: 'often',
    },
    comprehension: buildComprehension(),
    dceChoices: buildDceChoices(block),
    profileRatings: buildProfileRatings(0),
    overall: { q8: 4, q9: 'privacy_exposure', q10: '' },
    // 自由自选配置：默认取 C6（X1=0, X2=1, X3=0），字段均为合法值
    customConfig: {
      X1: 0,
      X2: 1,
      X3: 0,
      matchedProfileId: 'C6',
      responseDurationMs: 6400,
    },
    priorExperience: false,
    simulationEvents: [],
    startedAt,
    submittedAt,
    totalDurationMs: 12 * 60 * 1000,
    ...overrides,
  }
}

/** 构造一份完整的本地草稿（用于完成度校验与提交流程测试）。 */
export function buildDraft(overrides: Partial<QuestionnaireDraft> = {}): QuestionnaireDraft {
  const now = new Date('2026-01-01T10:00:00.000Z').toISOString()
  const block: BlockId = 'A'
  const ratings = buildProfileRatings(0)

  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    participantId: 'test-participant-0001',
    assignedBlock: block,
    consentStatus: 'agreed',
    consentTimestamp: now,
    identity: {
      ageGroup: '30-44',
      respondentRole: 'current_caregiver',
      respondentRoleOther: '',
      aiDeviceExperience: 'aware_not_used',
      caregivingExperience: 'often',
    },
    comprehension: buildComprehension(),
    dceTaskOrder: buildTaskDisplayPlan(block, 'test-seed').map((p) => ({
      taskId: p.taskId,
      displayOrder: p.displayOrder,
      leftProfileId: p.leftProfileId,
      rightProfileId: p.rightProfileId,
    })),
    dceChoices: buildDceChoices(block),
    ratingPlan: ratings.map((r) => r.profileId),
    profileRatings: ratings,
    overall: { q8: 4, q9: 'privacy_exposure', q10: '' },
    // 自由自选配置：默认取 C6（X1=0, X2=1, X3=0），字段均为合法值
    customConfig: {
      X1: 0,
      X2: 1,
      X3: 0,
      matchedProfileId: 'C6',
      responseDurationMs: 6400,
    },
    priorExperience: false,
    simulationEvents: [],
    startedAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export {
  TASKS_PER_BLOCK,
  PROFILES_PER_PARTICIPANT,
  SCALE_ITEM_COUNT,
  BLOCK_TASK_IDS,
  TASK_BY_ID,
  checkCompletion,
}
export type { TaskId }
