import { describe, expect, it, beforeEach } from 'vitest'
import { useQuestionnaire } from '@/app/store'
import { loadDraft, readSubmitted, saveDraft, clearDraft } from '@/lib/storage'
import { BLOCK_TASK_IDS, TASK_BY_ID } from '@/data/dceTasks'
import { PROFILES } from '@/data/profiles'
import { buildRatingPlan, buildTaskDisplayPlan, sequenceIndexForParticipant } from '@/lib/randomization'
import type { ComprehensionRecord, ScaleItemId } from '@/types'
import { ALL_SCALE_ITEM_IDS } from '@/data/scales'

/**
 * 问卷状态与草稿持久化测试。
 *
 * 覆盖 objective 中的关键数据质量要求：
 *   - 中途退出后可恢复进度（草稿持久化 / 读回）
 *   - 刷新页面或返回上一题**不会**重新随机分卷与左右位置
 *   - 随机化结果在当前会话中保持稳定
 *   - 草稿不得被误认为"已提交"
 *   - 正式提交成功后清理本地答题数据
 *   - 理解检查保留**首次**作答结果，重试只累加次数
 */

/** 每个用例前重置 store 与本地存储，避免用例间互相污染。 */
beforeEach(() => {
  window.localStorage.clear()
  useQuestionnaire.setState({
    draft: {
      ...useQuestionnaire.getState().draft,
      participantId: 'test-participant-0001',
      assignedBlock: null,
      consentStatus: 'pending',
      consentTimestamp: null,
      comprehension: [],
      dceTaskOrder: [],
      dceChoices: [],
      ratingPlan: [],
      profileRatings: [],
      simulationEvents: [],
      overall: { q8: null, q9: null, q10: '' },
    },
    hasRestoredDraft: false,
    isHydrated: true,
  })
})

describe('草稿持久化与恢复', () => {
  it('设置同意后会写入本地草稿', () => {
    expect(loadDraft()).toBeNull()
    useQuestionnaire.getState().setConsent('agreed')
    const stored = loadDraft()
    expect(stored).not.toBeNull()
    expect(stored!.draft.consentStatus).toBe('agreed')
    expect(stored!.draft.consentTimestamp).not.toBeNull()
  })

  it('restore() 能读回未完成问卷的进度', () => {
    const store = useQuestionnaire.getState()
    store.setConsent('agreed')
    store.setIdentity({ ageGroup: '60-69', respondentRole: 'older_adult' })
    store.ensureBlockAndPlan()

    const block = useQuestionnaire.getState().draft.assignedBlock
    const plan = useQuestionnaire.getState().draft.dceTaskOrder
    expect(block).not.toBeNull()
    expect(plan).toHaveLength(6)

    // 模拟"关闭页面后重新打开"
    useQuestionnaire.setState({ hasRestoredDraft: false })
    useQuestionnaire.getState().restore()

    const restored = useQuestionnaire.getState().draft
    expect(restored.consentStatus).toBe('agreed')
    expect(restored.identity.ageGroup).toBe('60-69')
    expect(restored.identity.respondentRole).toBe('older_adult')
    expect(useQuestionnaire.getState().hasRestoredDraft).toBe(true)
  })

  it('无草稿时 restore() 给出全新草稿且不报错', () => {
    useQuestionnaire.getState().restore()
    const { draft, hasRestoredDraft } = useQuestionnaire.getState()
    expect(hasRestoredDraft).toBe(false)
    expect(draft.consentStatus).toBe('pending')
    expect(draft.dceTaskOrder).toEqual([])
    expect(draft.participantId.length).toBeGreaterThan(0)
  })

  it('损坏的草稿不会导致崩溃，且会被清理', () => {
    window.localStorage.setItem('aiecq:draft:v1', '{ this is not json')
    expect(() => useQuestionnaire.getState().restore()).not.toThrow()
    expect(useQuestionnaire.getState().draft.consentStatus).toBe('pending')
    expect(window.localStorage.getItem('aiecq:draft:v1')).toBeNull()
  })
})

describe('随机化在会话中保持稳定（刷新/返回不重新随机）', () => {
  it('重复调用 ensureBlockAndPlan 不会改变卷别与题目方案', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const first = {
      block: useQuestionnaire.getState().draft.assignedBlock,
      plan: useQuestionnaire.getState().draft.dceTaskOrder,
    }

    // 模拟多次重渲染 / 返回上一题 / 重新进入该步骤
    for (let i = 0; i < 5; i += 1) {
      useQuestionnaire.getState().ensureBlockAndPlan()
    }

    expect(useQuestionnaire.getState().draft.assignedBlock).toBe(first.block)
    expect(useQuestionnaire.getState().draft.dceTaskOrder).toEqual(first.plan)
  })

  it('从本地草稿恢复后，卷别与左右位置与恢复前完全一致', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const before = useQuestionnaire.getState().draft.dceTaskOrder

    useQuestionnaire.getState().restore()
    const after = useQuestionnaire.getState().draft.dceTaskOrder

    expect(after).toEqual(before)
  })

  it('卷别与方案与由 participantId 推导的结果一致（可复现）', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const { assignedBlock, dceTaskOrder, participantId, questionnaireVersion } =
      useQuestionnaire.getState().draft

    const seed = `${participantId}:${questionnaireVersion}`
    const expectedPlan = buildTaskDisplayPlan(assignedBlock!, seed)
    expect(dceTaskOrder).toEqual(expectedPlan)
  })

  it('每卷的展示方案都通过合法性校验（题目齐全、左右为 V1.0 配对）', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const { assignedBlock, dceTaskOrder } = useQuestionnaire.getState().draft

    expect(dceTaskOrder).toHaveLength(6)
    expect(dceTaskOrder.map((p) => p.displayOrder)).toEqual([1, 2, 3, 4, 5, 6])

    for (const item of dceTaskOrder) {
      expect(BLOCK_TASK_IDS[assignedBlock!]).toContain(item.taskId)
      const pair = TASK_BY_ID[item.taskId]
      const valid =
        (item.leftProfileId === pair.profileA && item.rightProfileId === pair.profileB) ||
        (item.leftProfileId === pair.profileB && item.rightProfileId === pair.profileA)
      expect(valid, `${item.taskId} 左右配置非法`).toBe(true)
    }
  })

  it('重复调用 ensureRatingPlan 不会改变被评价的配置集合', () => {
    const store = useQuestionnaire.getState()
    store.ensureRatingPlan()
    const first = useQuestionnaire.getState().draft.ratingPlan
    expect(first).toHaveLength(4)

    for (let i = 0; i < 5; i += 1) {
      useQuestionnaire.getState().ensureRatingPlan()
    }

    expect(useQuestionnaire.getState().draft.ratingPlan).toEqual(first)
  })

  it('评分配置与由 participantId 推导的结果一致，且 4 个互不相同', () => {
    const store = useQuestionnaire.getState()
    store.ensureRatingPlan()
    const { ratingPlan, participantId, questionnaireVersion } = useQuestionnaire.getState().draft

    const expected = buildRatingPlan(
      sequenceIndexForParticipant(participantId),
      `${participantId}:${questionnaireVersion}:ratings`,
    )
    expect(ratingPlan).toEqual(expected)
    expect(new Set(ratingPlan).size).toBe(4)
  })
})

describe('逐题记录与回改', () => {
  it('记录 DCE 选择时保存真正选中的配置，而非"方案A/B"位置', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const item = useQuestionnaire.getState().draft.dceTaskOrder[0]!

    const left = PROFILES[item.leftProfileId]
    const right = PROFILES[item.rightProfileId]

    useQuestionnaire.getState().recordDceChoice({
      taskId: item.taskId,
      blockId: useQuestionnaire.getState().draft.assignedBlock!,
      taskDisplayOrder: item.displayOrder,
      leftProfileId: item.leftProfileId,
      rightProfileId: item.rightProfileId,
      leftProfileAttributes: { X1: left.X1, X2: left.X2, X3: left.X3 },
      rightProfileAttributes: { X1: right.X1, X2: right.X2, X3: right.X3 },
      selectedSide: 'right',
      selectedProfileId: item.rightProfileId,
      responseDurationMs: 5000,
    })

    const saved = useQuestionnaire.getState().draft.dceChoices
    expect(saved).toHaveLength(1)
    expect(saved[0]!.selectedSide).toBe('right')
    expect(saved[0]!.selectedProfileId).toBe(item.rightProfileId)
    // 选中配置必须与所选一侧一致
    expect(saved[0]!.selectedProfileId).not.toBe(item.leftProfileId)
  })

  it('回改同一题时覆盖旧记录而不是新增（不产生重复行）', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const item = useQuestionnaire.getState().draft.dceTaskOrder[0]!
    const block = useQuestionnaire.getState().draft.assignedBlock!
    const attrs = (id: typeof item.leftProfileId) => {
      const p = PROFILES[id]
      return { X1: p.X1, X2: p.X2, X3: p.X3 }
    }
    const base = {
      taskId: item.taskId,
      blockId: block,
      taskDisplayOrder: item.displayOrder,
      leftProfileId: item.leftProfileId,
      rightProfileId: item.rightProfileId,
      leftProfileAttributes: attrs(item.leftProfileId),
      rightProfileAttributes: attrs(item.rightProfileId),
      responseDurationMs: 1000,
    }

    useQuestionnaire.getState().recordDceChoice({
      ...base, selectedSide: 'left', selectedProfileId: item.leftProfileId,
    })
    useQuestionnaire.getState().recordDceChoice({
      ...base, selectedSide: 'right', selectedProfileId: item.rightProfileId, responseDurationMs: 9000,
    })

    const saved = useQuestionnaire.getState().draft.dceChoices
    expect(saved).toHaveLength(1)
    expect(saved[0]!.selectedSide).toBe('right')
    expect(saved[0]!.responseDurationMs).toBe(9000)
  })

  it('DCE 记录按展示顺序排序', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const plan = useQuestionnaire.getState().draft.dceTaskOrder
    const block = useQuestionnaire.getState().draft.assignedBlock!

    // 逆序记录，验证最终按 displayOrder 排序
    for (const item of [...plan].reverse()) {
      const p = PROFILES[item.leftProfileId]
      useQuestionnaire.getState().recordDceChoice({
        taskId: item.taskId,
        blockId: block,
        taskDisplayOrder: item.displayOrder,
        leftProfileId: item.leftProfileId,
        rightProfileId: item.rightProfileId,
        leftProfileAttributes: { X1: p.X1, X2: p.X2, X3: p.X3 },
        rightProfileAttributes: { X1: p.X1, X2: p.X2, X3: p.X3 },
        selectedSide: 'left',
        selectedProfileId: item.leftProfileId,
        responseDurationMs: 3000,
      })
    }

    const orders = useQuestionnaire.getState().draft.dceChoices.map((c) => c.taskDisplayOrder)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('保存同一配置的评价会覆盖而不是重复', () => {
    const store = useQuestionnaire.getState()
    store.ensureRatingPlan()
    const profileId = useQuestionnaire.getState().draft.ratingPlan[0]!
    const profile = PROFILES[profileId]
    const scores = Object.fromEntries(
      ALL_SCALE_ITEM_IDS.map((id) => [id, 4]),
    ) as Record<ScaleItemId, 1 | 2 | 3 | 4 | 5>

    const record = {
      profileId, X1: profile.X1, X2: profile.X2, X3: profile.X3, ratingOrder: 1, scores,
    }
    useQuestionnaire.getState().saveProfileRating(record)
    useQuestionnaire.getState().saveProfileRating({ ...record, scores: { ...scores, S1: 5 } })

    const saved = useQuestionnaire.getState().draft.profileRatings
    expect(saved).toHaveLength(1)
    expect(saved[0]!.scores.S1).toBe(5)
  })
})

describe('理解检查保留首次作答结果', () => {
  it('首次作答被记录，重试只累加 retryCount，不覆盖首次结果', () => {
    const store = useQuestionnaire.getState()
    const first: ComprehensionRecord = {
      questionId: 'Q6',
      firstAnswerIndex: 2, // 错误选项
      isCorrect: false,
      retryCount: 0,
    }
    store.recordComprehension(first)

    const afterFirst = useQuestionnaire.getState().draft.comprehension
    expect(afterFirst).toHaveLength(1)
    expect(afterFirst[0]!.firstAnswerIndex).toBe(2)
    expect(afterFirst[0]!.isCorrect).toBe(false)

    // 参与者重试并答对
    useQuestionnaire.getState().recordComprehension({
      questionId: 'Q6',
      firstAnswerIndex: 0,
      isCorrect: true,
      retryCount: 1,
    })

    const afterRetry = useQuestionnaire.getState().draft.comprehension
    expect(afterRetry).toHaveLength(1)
    // 关键：首次作答结果必须保留，用于研究分析
    expect(afterRetry[0]!.firstAnswerIndex).toBe(2)
    expect(afterRetry[0]!.isCorrect).toBe(false)
    expect(afterRetry[0]!.retryCount).toBe(1)
  })

  it('两道理解检查题各自独立记录', () => {
    const store = useQuestionnaire.getState()
    store.recordComprehension({ questionId: 'Q6', firstAnswerIndex: 0, isCorrect: true, retryCount: 0 })
    store.recordComprehension({ questionId: 'Q7', firstAnswerIndex: 1, isCorrect: true, retryCount: 0 })
    expect(useQuestionnaire.getState().draft.comprehension).toHaveLength(2)
  })
})

describe('草稿与"已提交"严格区分', () => {
  it('填写过程中不会写入已提交标记', () => {
    const store = useQuestionnaire.getState()
    store.setConsent('agreed')
    store.ensureBlockAndPlan()
    store.setQ8(4)
    store.setQ9('privacy_exposure')

    expect(readSubmitted()).toBeNull()
    // 草稿仍然存在，说明"有草稿"不等于"已提交"
    expect(loadDraft()).not.toBeNull()
  })

  it('markDraftSubmitted 记录已提交并清理本地草稿', () => {
    const store = useQuestionnaire.getState()
    store.setConsent('agreed')
    store.ensureBlockAndPlan()
    expect(loadDraft()).not.toBeNull()

    const participantId = useQuestionnaire.getState().draft.participantId
    useQuestionnaire.getState().markDraftSubmitted()

    expect(loadDraft()).toBeNull()
    const submitted = readSubmitted()
    expect(submitted).not.toBeNull()
    expect(submitted!.participantId).toBe(participantId)
  })

  it('discardDraft 会清理草稿且给出新的匿名编号', () => {
    const store = useQuestionnaire.getState()
    store.setConsent('agreed')
    const oldId = useQuestionnaire.getState().draft.participantId

    useQuestionnaire.getState().discardDraft()
    expect(useQuestionnaire.getState().draft.consentStatus).toBe('pending')
    expect(useQuestionnaire.getState().draft.participantId).not.toBe(oldId)
  })
})

describe('模拟使用埋点', () => {
  it('记录打开/关闭事件与停留时长，且不写入 DCE 选择数据', () => {
    const store = useQuestionnaire.getState()
    store.ensureBlockAndPlan()
    const choicesBefore = useQuestionnaire.getState().draft.dceChoices.length

    store.recordSimulationEvent({
      taskId: 'T01', profileId: 'C1', eventType: 'open', source: 'dce',
    })
    store.recordSimulationEvent({
      taskId: 'T01', profileId: 'C1', eventType: 'close', durationMs: 8500, source: 'dce',
    })

    const events = useQuestionnaire.getState().draft.simulationEvents
    expect(events).toHaveLength(2)
    expect(events[0]!.eventType).toBe('open')
    expect(events[1]!.durationMs).toBe(8500)
    expect(events[1]!.source).toBe('dce')
    // 关键：模拟埋点不得影响 DCE 选择数据
    expect(useQuestionnaire.getState().draft.dceChoices.length).toBe(choicesBefore)
  })

  it('独立体验页来源被单独标记（不写入正式 DCE 数据）', () => {
    useQuestionnaire.getState().recordSimulationEvent({
      taskId: null, profileId: 'C4', eventType: 'open', source: 'experience',
    })
    const event = useQuestionnaire.getState().draft.simulationEvents[0]!
    expect(event.source).toBe('experience')
    expect(event.taskId).toBeNull()
  })

  it('埋点数量有上限，异常情况下不会无限增长', () => {
    for (let i = 0; i < 520; i += 1) {
      useQuestionnaire.getState().recordSimulationEvent({
        taskId: null, profileId: 'C1', eventType: 'open', source: 'experience',
      })
    }
    const events = useQuestionnaire.getState().draft.simulationEvents
    expect(events.length).toBeLessThanOrEqual(500)
  })
})

describe('存储层守卫', () => {
  it('saveDraft / clearDraft 在无草稿时也安全', () => {
    clearDraft()
    expect(loadDraft()).toBeNull()
    expect(() => clearDraft()).not.toThrow()
  })

  it('saveDraft 记录 savedAt 时间戳（不等于已提交）', () => {
    const draft = useQuestionnaire.getState().draft
    expect(saveDraft(draft)).toBe(true)
    const stored = loadDraft()
    expect(stored!.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(readSubmitted()).toBeNull()
  })
})
