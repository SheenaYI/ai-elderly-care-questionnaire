/**
 * 问卷状态（Zustand）。
 *
 * 关键不变量（直接对应数据质量要求）：
 *   1. **随机化结果一旦确定就不再改变。** 卷别、题目顺序、左右位置、
 *      待评价配置集合全部在 `initializeDraft` / `ensureRatingPlan` 中
 *      写入一次，之后只读取，不重新生成。因此刷新页面、返回上一题
 *      都不会重新随机。
 *   2. **草稿与"已提交"严格区分。** 草稿随时保存；只有服务端确认
 *      成功后才标记 submitted 并清理本地答题数据。
 *   3. 每次状态变更都同步写入本地草稿，支持中途退出后恢复。
 */

import { create } from 'zustand'
import type {
  AttributeProfile,
  BlockId,
  ComprehensionRecord,
  CustomConfigRecord,
  DceChoiceRecord,
  DceTaskDisplayPlan,
  IdentityInfo,
  LikertValue,
  MainConcern,
  ProfileId,
  ProfileRatingRecord,
  QuestionnaireDraft,
  ScaleItemId,
  SimulationEventRecord,
  SimulationEventType,
  TaskId,
} from '@/types'
import {
  QUESTIONNAIRE_VERSION,
} from '@/data/questionnaire'
import { PROFILES } from '@/data/profiles'
import {
  assignBlock,
  buildRatingPlan,
  buildTaskDisplayPlan,
  profileAttributes,
  sequenceIndexForParticipant,
  validateRatingPlan,
} from '@/lib/randomization'
import {
  clearDraft,
  createParticipantId,
  loadDraft,
  markSubmitted,
  readPriorExperience,
  saveDraft,
} from '@/lib/storage'
import { TASK_BY_ID } from '@/data/dceTasks'

function emptyIdentity(): IdentityInfo {
  return {
    ageGroup: null,
    respondentRole: null,
    respondentRoleOther: '',
    aiDeviceExperience: null,
    caregivingExperience: null,
  }
}

function emptyOverall(): QuestionnaireDraft['overall'] {
  return { q8: null, q9: null, q10: '' }
}

function createEmptyDraft(priorExperience: boolean): QuestionnaireDraft {
  const now = new Date().toISOString()
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    participantId: createParticipantId(),
    assignedBlock: null,
    consentStatus: 'pending',
    consentTimestamp: null,
    identity: emptyIdentity(),
    comprehension: [],
    dceTaskOrder: [],
    dceChoices: [],
    ratingPlan: [],
    profileRatings: [],
    overall: emptyOverall(),
    customConfig: null,
    priorExperience,
    simulationEvents: [],
    startedAt: now,
    updatedAt: now,
  }
}

interface QuestionnaireState {
  draft: QuestionnaireDraft
  /** 本地是否存在可恢复的草稿（进入首页时提示）。 */
  hasRestoredDraft: boolean
  /** 是否已从本地存储完成初始化。 */
  isHydrated: boolean

  // ── 生命周期 ──────────────────────────────────────────────
  restore: () => void
  startNewDraft: () => void
  discardDraft: () => void

  // ── 模块一 ────────────────────────────────────────────────
  setConsent: (status: 'agreed' | 'declined') => void
  setIdentity: (patch: Partial<IdentityInfo>) => void

  // ── 模块二 ────────────────────────────────────────────────
  recordComprehension: (record: ComprehensionRecord) => void

  // ── 模块三 ────────────────────────────────────────────────
  ensureBlockAndPlan: (sequenceIndex?: number) => void
  recordDceChoice: (choice: DceChoiceRecord) => void

  // ── 模块四 ────────────────────────────────────────────────
  ensureRatingPlan: (sequenceIndex?: number) => void
  saveProfileRating: (record: ProfileRatingRecord) => void

  // ── 模块五 ────────────────────────────────────────────────
  setQ8: (value: LikertValue) => void
  setQ9: (value: MainConcern) => void
  setQ10: (value: string) => void

  // ── 模块六：自由自选配置 ─────────────────────────────────
  setCustomConfig: (record: CustomConfigRecord | null) => void

  // ── 模拟埋点 ──────────────────────────────────────────────
  recordSimulationEvent: (event: {
    taskId: TaskId | null
    profileId: ProfileId
    eventType: SimulationEventType
    durationMs?: number | null
    source: 'dce' | 'experience'
  }) => void

  // ── 提交 ──────────────────────────────────────────────────
  markDraftSubmitted: () => void
}

/** 写入本地草稿（失败不阻塞界面）。 */
function persist(draft: QuestionnaireDraft): QuestionnaireDraft {
  const next = { ...draft, updatedAt: new Date().toISOString() }
  saveDraft(next)
  return next
}

export const useQuestionnaire = create<QuestionnaireState>((set, get) => ({
  draft: createEmptyDraft(false),
  hasRestoredDraft: false,
  isHydrated: false,

  restore: () => {
    const stored = loadDraft()
    if (stored?.draft) {
      // 草稿可能存在旧版本字段缺失，做一次宽松补齐
      const draft: QuestionnaireDraft = {
        ...createEmptyDraft(stored.draft.priorExperience ?? readPriorExperience()),
        ...stored.draft,
        identity: { ...emptyIdentity(), ...stored.draft.identity },
        overall: { ...emptyOverall(), ...stored.draft.overall },
        dceTaskOrder: stored.draft.dceTaskOrder ?? [],
        dceChoices: stored.draft.dceChoices ?? [],
        ratingPlan: stored.draft.ratingPlan ?? [],
        profileRatings: stored.draft.profileRatings ?? [],
        comprehension: stored.draft.comprehension ?? [],
        simulationEvents: stored.draft.simulationEvents ?? [],
        customConfig: stored.draft.customConfig ?? null,
      }
      set({ draft, hasRestoredDraft: true, isHydrated: true })
      return
    }
    set({
      draft: createEmptyDraft(readPriorExperience()),
      hasRestoredDraft: false,
      isHydrated: true,
    })
  },

  startNewDraft: () => {
    set({
      draft: persist(createEmptyDraft(readPriorExperience())),
      hasRestoredDraft: false,
    })
  },

  discardDraft: () => {
    clearDraft()
    set({
      draft: persist(createEmptyDraft(readPriorExperience())),
      hasRestoredDraft: false,
    })
  },

  setConsent: (status) => {
    set((state) => ({
      draft: persist({
        ...state.draft,
        consentStatus: status,
        consentTimestamp: status === 'agreed' ? new Date().toISOString() : null,
      }),
    }))
  },

  setIdentity: (patch) => {
    set((state) => ({
      draft: persist({
        ...state.draft,
        identity: { ...state.draft.identity, ...patch },
      }),
    }))
  },

  recordComprehension: (record) => {
    set((state) => {
      const existingIndex = state.draft.comprehension.findIndex(
        (c) => c.questionId === record.questionId,
      )
      // 首次作答结果必须保留：若已有记录，则只累加 retryCount，不覆盖首次结果
      if (existingIndex >= 0) {
        const existing = state.draft.comprehension[existingIndex]!
        const updated: ComprehensionRecord = {
          ...existing,
          retryCount: record.retryCount,
        }
        const comprehension = [...state.draft.comprehension]
        comprehension[existingIndex] = updated
        return { draft: persist({ ...state.draft, comprehension }) }
      }
      return {
        draft: persist({
          ...state.draft,
          comprehension: [...state.draft.comprehension, record],
        }),
      }
    })
  },

  ensureBlockAndPlan: (sequenceIndex) => {
    const { draft } = get()
    if (draft.assignedBlock && draft.dceTaskOrder.length > 0) return // 已稳定，不重新随机

    const seed = `${draft.participantId}:${draft.questionnaireVersion}`
    const block: BlockId = assignBlock(seed, sequenceIndex)
    const plan: DceTaskDisplayPlan[] = buildTaskDisplayPlan(block, seed)

    set((state) => ({
      draft: persist({ ...state.draft, assignedBlock: block, dceTaskOrder: plan }),
    }))
  },

  recordDceChoice: (choice) => {
    set((state) => {
      const others = state.draft.dceChoices.filter((c) => c.taskId !== choice.taskId)
      const dceChoices = [...others, choice].sort((a, b) => a.taskDisplayOrder - b.taskDisplayOrder)
      return { draft: persist({ ...state.draft, dceChoices }) }
    })
  },

  ensureRatingPlan: (sequenceIndex) => {
    const { draft } = get()
    if (draft.ratingPlan.length > 0) return // 已稳定

    const seed = `${draft.participantId}:${draft.questionnaireVersion}:ratings`
    // 未显式传入序号时，由 participant_id 推导，保证不同参与者评价不同的配置组合
    const resolvedIndex = sequenceIndex ?? sequenceIndexForParticipant(draft.participantId)
    const plan = buildRatingPlan(resolvedIndex, seed)
    const check = validateRatingPlan(plan)
    if (!check.ok) {
      // 理论不可达；若不满足研究要求则退回到确定性方案，保证问卷可继续
      const fallback: ProfileId[] = ['C1', 'C3', 'C5', 'C7']
      set((state) => ({ draft: persist({ ...state.draft, ratingPlan: fallback }) }))
      return
    }
    set((state) => ({ draft: persist({ ...state.draft, ratingPlan: plan }) }))
  },

  saveProfileRating: (record) => {
    set((state) => {
      const others = state.draft.profileRatings.filter((r) => r.profileId !== record.profileId)
      const profileRatings = [...others, record].sort((a, b) => a.ratingOrder - b.ratingOrder)
      return { draft: persist({ ...state.draft, profileRatings }) }
    })
  },

  setQ8: (value) => {
    set((state) => ({
      draft: persist({ ...state.draft, overall: { ...state.draft.overall, q8: value } }),
    }))
  },

  setQ9: (value) => {
    set((state) => ({
      draft: persist({ ...state.draft, overall: { ...state.draft.overall, q9: value } }),
    }))
  },

  setQ10: (value) => {
    set((state) => ({
      draft: persist({ ...state.draft, overall: { ...state.draft.overall, q10: value } }),
    }))
  },

  setCustomConfig: (record) => {
    set((state) => ({ draft: persist({ ...state.draft, customConfig: record }) }))
  },

  recordSimulationEvent: ({ taskId, profileId, eventType, durationMs = null, source }) => {
    set((state) => {
      const startedMs = Date.parse(state.draft.startedAt)
      const eventTimestampMs = Number.isFinite(startedMs)
        ? Math.max(0, Date.now() - startedMs)
        : 0
      const event: SimulationEventRecord = {
        taskId,
        profileId,
        eventType,
        eventTimestampMs,
        durationMs,
        source,
      }
      // 埋点数量上限，避免异常情况下草稿无限增长
      const simulationEvents = [...state.draft.simulationEvents, event].slice(-500)
      return { draft: persist({ ...state.draft, simulationEvents }) }
    })
  },

  markDraftSubmitted: () => {
    markSubmitted(get().draft.participantId)
    clearDraft()
  },
}))

// ─────────────────────────────────────────────────────────────
// 选择器与工具
// ─────────────────────────────────────────────────────────────

/** 读取某配置的属性快照。 */
export function attributesOf(profileId: ProfileId): AttributeProfile {
  return profileAttributes(profileId)
}

/** 读取草稿中某道 DCE 任务的展示方案。 */
export function planForTask(
  plan: readonly DceTaskDisplayPlan[],
  taskId: TaskId,
): DceTaskDisplayPlan | undefined {
  return plan.find((p) => p.taskId === taskId)
}

/** 是否已完成 6 道 DCE。 */
export function dceCompleted(draft: QuestionnaireDraft): boolean {
  return draft.dceChoices.length === 6
}

/** 读取某个配置的已保存评分。 */
export function ratingForProfile(
  draft: QuestionnaireDraft,
  profileId: ProfileId,
): ProfileRatingRecord | undefined {
  return draft.profileRatings.find((r) => r.profileId === profileId)
}

/** 全部量表题是否都有评分。 */
export function isRatingComplete(record: ProfileRatingRecord | undefined): boolean {
  if (!record) return false
  const ids: ScaleItemId[] = [
    'S1', 'S2', 'S3', 'P1', 'P2', 'P3', 'A1', 'A2', 'A3', 'I1', 'I2', 'I3',
  ]
  return ids.every((id) => typeof record.scores[id] === 'number')
}

/** 校验配置的展示属性与编码一致（防转录错误）。 */
export function profileMatches(id: ProfileId, attrs: AttributeProfile): boolean {
  const p = PROFILES[id]
  return p.X1 === attrs.X1 && p.X2 === attrs.X2 && p.X3 === attrs.X3
}

/** 供调试与测试：读取 V1.0 中某题的两配置。 */
export function taskPair(taskId: TaskId): { profileA: ProfileId; profileB: ProfileId } {
  const t = TASK_BY_ID[taskId]
  return { profileA: t.profileA, profileB: t.profileB }
}
