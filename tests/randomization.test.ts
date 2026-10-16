import { describe, expect, it } from 'vitest'
import {
  assignBlock,
  auditRatingAllocation,
  buildRatingPlan,
  buildTaskDisplayPlan,
  createRng,
  hashString,
  shuffle,
  sequenceIndexForParticipant,
  validateRatingPlan,
  validateTaskDisplayPlan,
} from '@/lib/randomization'
import { BLOCK_TASK_IDS, PROFILES_PER_PARTICIPANT, TASK_BY_ID, TASKS_PER_BLOCK } from '@/data/dceTasks'
import { PROFILE_IDS } from '@/data/profiles'
import type { BlockId, DceTaskDisplayPlan } from '@/types'

/**
 * 随机化测试。
 *
 * 覆盖用户明确要求的自动化验证：
 *   - DCE 任务顺序随机化
 *   - DCE 左右位置随机化
 *   - A/B 随机分卷
 *   - 每人评价 4 个不同配置
 *   - 随机化在当前问卷会话中保持稳定
 */

const SEED = 'participant-abc:V1.0'

describe('确定性随机数发生器', () => {
  it('同一 seed 产生同一序列（可复现）', () => {
    const a = createRng('seed-1')
    const b = createRng('seed-1')
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('不同 seed 产生不同序列', () => {
    const a = createRng('seed-1')
    const b = createRng('seed-2')
    expect(Array.from({ length: 10 }, () => a())).not.toEqual(
      Array.from({ length: 10 }, () => b()),
    )
  })

  it('输出落在 [0, 1) 区间', () => {
    const rng = createRng('range-check')
    for (let i = 0; i < 500; i += 1) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('hashString 稳定且区分不同输入', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})

describe('shuffle', () => {
  it('保留全部元素（是一个排列）', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const output = shuffle(input, createRng('s'))
    expect([...output].sort((a, b) => a - b)).toEqual(input)
  })

  it('不修改入参', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffle(input, createRng('s'))
    expect(input).toEqual(copy)
  })
})

describe('A/B 随机分卷', () => {
  it('总是返回 A 或 B', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(['A', 'B']).toContain(assignBlock(`p-${i}`, i))
    }
  })

  it('同一 seed 与序号结果稳定（刷新不改变卷别）', () => {
    const first = assignBlock(SEED, 7)
    const second = assignBlock(SEED, 7)
    expect(second).toBe(first)
  })

  it('同一 seed 下按序号交替分配，人数严格均衡', () => {
    // 同一批次（同一 seed）内，序号奇偶交替 ⇒ 偶数序号与奇数序号各占一半
    const assignments = Array.from({ length: 100 }, (_, i) => assignBlock('batch-seed', i))
    const countA = assignments.filter((b) => b === 'A').length
    const countB = assignments.filter((b) => b === 'B').length
    expect(countA).toBe(50)
    expect(countB).toBe(50)
  })

  it('同一 seed 下相邻序号必为不同卷别', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(assignBlock('batch-seed', i)).not.toBe(assignBlock('batch-seed', i + 1))
    }
  })

  it('交替分配的起始卷别是随机的（不同 seed 可产生不同起点）', () => {
    const firsts = new Set(
      Array.from({ length: 40 }, (_, i) => assignBlock(`seed-${i}`, 0)),
    )
    expect(firsts.size).toBe(2)
  })
})

describe('DCE 题目顺序与左右位置随机化', () => {
  it('每卷恰好 6 题，且全部来自该卷', () => {
    for (const block of ['A', 'B'] as BlockId[]) {
      const plan = buildTaskDisplayPlan(block, SEED)
      expect(plan).toHaveLength(TASKS_PER_BLOCK)
      const validation = validateTaskDisplayPlan(block, plan)
      expect(validation.problems, validation.problems.join('\n')).toEqual([])
      expect(validation.ok).toBe(true)
    }
  })

  it('展示顺序为 1..6 的连续编号', () => {
    for (const block of ['A', 'B'] as BlockId[]) {
      const plan = buildTaskDisplayPlan(block, SEED)
      expect(plan.map((p) => p.displayOrder)).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('题目顺序被打乱（至少在一个卷别上不是原始顺序）', () => {
    const plans = (['A', 'B'] as BlockId[]).map((b) => buildTaskDisplayPlan(b, SEED).map((p) => p.taskId))
    const aOriginal = plans[0]!.join(',') === BLOCK_TASK_IDS.A.join(',')
    const bOriginal = plans[1]!.join(',') === BLOCK_TASK_IDS.B.join(',')
    expect(aOriginal && bOriginal).toBe(false)
  })

  it('左右配置始终是 V1.0 的合法配对（或交换）', () => {
    for (const block of ['A', 'B'] as BlockId[]) {
      for (const item of buildTaskDisplayPlan(block, SEED)) {
        const pair = TASK_BY_ID[item.taskId]
        const valid =
          (item.leftProfileId === pair.profileA && item.rightProfileId === pair.profileB) ||
          (item.leftProfileId === pair.profileB && item.rightProfileId === pair.profileA)
        expect(valid, `${item.taskId} 的左右配置非法`).toBe(true)
      }
    }
  })

  it('左右位置确实被随机交换（同一 seed 下存在被交换的题目）', () => {
    const allSwapped = (['A', 'B'] as BlockId[]).every((block) =>
      buildTaskDisplayPlan(block, SEED).every((item) => item.leftProfileId === TASK_BY_ID[item.taskId].profileA),
    )
    expect(allSwapped).toBe(false)
  })

  it('同一 seed 与卷别可完整复现（返回上一题不重新随机）', () => {
    for (const block of ['A', 'B'] as BlockId[]) {
      const first = buildTaskDisplayPlan(block, SEED)
      const second = buildTaskDisplayPlan(block, SEED)
      expect(second).toEqual(first)
    }
  })

  it('不同参与者得到不同的题目顺序或左右位置', () => {
    const plansA = Array.from({ length: 12 }, (_, i) => buildTaskDisplayPlan('A', `p-${i}`))
    const signatures = new Set(
      plansA.map((p) =>
        p.map((item) => `${item.taskId}:${item.leftProfileId}${item.rightProfileId}`).join('|'),
      ),
    )
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('跨大量参与者，左侧与右侧方案分布大致均衡（位置随机化有效）', () => {
    let leftIsProfileA = 0
    let total = 0
    for (let i = 0; i < 400; i += 1) {
      for (const block of ['A', 'B'] as BlockId[]) {
        for (const item of buildTaskDisplayPlan(block, `seed-${i}`)) {
          total += 1
          if (item.leftProfileId === TASK_BY_ID[item.taskId].profileA) leftIsProfileA += 1
        }
      }
    }
    const share = leftIsProfileA / total
    // 二项分布下 4800 次抽样，允许 ±5%
    expect(share).toBeGreaterThan(0.45)
    expect(share).toBeLessThan(0.55)
  })
})

describe('validateTaskDisplayPlan 能识别非法方案', () => {
  it('检测题目重复', () => {
    const plan = buildTaskDisplayPlan('A', SEED)
    const broken: DceTaskDisplayPlan[] = [plan[0]!, plan[0]!, ...plan.slice(2)]
    const result = validateTaskDisplayPlan('A', broken)
    expect(result.ok).toBe(false)
    expect(result.problems.join()).toContain('重复')
  })

  it('检测属于错误卷别的题目', () => {
    const bPlan = buildTaskDisplayPlan('B', SEED)
    const mixed: DceTaskDisplayPlan[] = [...bPlan.slice(0, 5), buildTaskDisplayPlan('A', SEED)[0]!]
      .map((item, index) => ({ ...item, displayOrder: index + 1 }))
    const result = validateTaskDisplayPlan('B', mixed)
    expect(result.ok).toBe(false)
  })

  it('检测左右方案相同的非法题目', () => {
    const plan = buildTaskDisplayPlan('A', SEED)
    const broken = plan.map((item, index) =>
      index === 0 ? { ...item, rightProfileId: item.leftProfileId } : item,
    )
    const result = validateTaskDisplayPlan('A', broken)
    expect(result.ok).toBe(false)
  })
})

describe('每人评价 4 个不同配置（平衡分配）', () => {
  it('每位参与者恰好 4 个配置，且互不相同', () => {
    for (let i = 0; i < 50; i += 1) {
      const plan = buildRatingPlan(i, `seed-${i}`)
      expect(plan).toHaveLength(PROFILES_PER_PARTICIPANT)
      expect(new Set(plan).size).toBe(PROFILES_PER_PARTICIPANT)
      expect(validateRatingPlan(plan).ok).toBe(true)
    }
  })

  it('只使用合法的 C1–C8 编码', () => {
    for (let i = 0; i < 30; i += 1) {
      for (const id of buildRatingPlan(i, 's')) {
        expect(PROFILE_IDS).toContain(id)
      }
    }
  })

  it('同一序号 + 同一 seed 结果可复现', () => {
    expect(buildRatingPlan(3, 'seed-x')).toEqual(buildRatingPlan(3, 'seed-x'))
  })

  it('连续 8 位参与者恰好各评价每个配置 4 次（完全均衡）', () => {
    const audit = auditRatingAllocation([0, 1, 2, 3, 4, 5, 6, 7])
    expect(audit.totalAssignments).toBe(32)
    for (const id of PROFILE_IDS) {
      expect(audit.counts[id], `配置 ${id} 被评价次数`).toBe(4)
    }
    expect(audit.maxMinDifference).toBe(0)
    expect(audit.balanced).toBe(true)
  })

  it('任意 8 位连续参与者均保持完全均衡', () => {
    for (const start of [0, 8, 16, 40, 96]) {
      const audit = auditRatingAllocation(
        Array.from({ length: 8 }, (_, i) => start + i),
      )
      expect(audit.maxMinDifference, `起始序号 ${start}`).toBe(0)
    }
  })

  it('大样本下各配置被评价次数最多相差 1 次（无随机漂移）', () => {
    const audit = auditRatingAllocation(Array.from({ length: 137 }, (_, i) => i))
    expect(audit.maxMinDifference).toBeLessThanOrEqual(1)
    expect(audit.balanced).toBe(true)
  })

  it('不同参与者会评价不同的配置组合（避免所有人都评同一组）', () => {
    // 模拟真实的随机 participant_id（UUID v4 形式）
    const ids = Array.from({ length: 24 }, (_, i) => `9f1c2b3a-0000-4000-8000-${String(i).padStart(12, '0')}`)
    const sets = new Set(
      ids.map((id) => [...buildRatingPlan(sequenceIndexForParticipant(id), 'seed')].sort().join(',')),
    )
    expect(sets.size).toBeGreaterThan(1)
  })

  it('由 participant_id 推导的序号覆盖全部 8 个偏移（散列分布均匀）', () => {
    const counts = new Array(8).fill(0)
    for (let i = 0; i < 800; i += 1) {
      const id = `participant-${i}-${(i * 7919).toString(36)}`
      counts[sequenceIndexForParticipant(id)] += 1
    }
    // 每个桶都应被使用，且分布大致均匀（800/8 = 100）
    for (const [index, count] of counts.entries()) {
      expect(count, `偏移 ${index} 的命中次数`).toBeGreaterThan(50)
      expect(count, `偏移 ${index} 的命中次数`).toBeLessThan(160)
    }
  })

  it('按 participant_id 分配时，大样本下各配置被评价次数基本均衡', () => {
    // 说明：散列分桶是"期望均匀"，不是"严格均匀"——每个桶恰好贡献
    // 4 次评价，因此各配置被评价次数 ≈ 参与者数 / 2，允许抽样波动。
    // 严格逐轮均衡由按到达顺序分配 sequence_index 保证（见 RESEARCH_NOTES）。
    const N = 800
    const indices = Array.from({ length: N }, (_, i) =>
      sequenceIndexForParticipant(`uuid-${i}-${(i * 104729).toString(36)}`),
    )
    const audit = auditRatingAllocation(indices)

    expect(audit.totalAssignments).toBe(N * PROFILES_PER_PARTICIPANT)

    const expected = (N * PROFILES_PER_PARTICIPANT) / PROFILE_IDS.length
    const values = PROFILE_IDS.map((id) => audit.counts[id])
    // 每个配置都被评价到
    for (const id of PROFILE_IDS) {
      expect(audit.counts[id], `配置 ${id} 至少被评价一次`).toBeGreaterThan(0)
    }
    // 与理论期望的偏差在 15% 以内
    for (const [index, value] of values.entries()) {
      const deviation = Math.abs(value - expected) / expected
      expect(deviation, `配置 ${PROFILE_IDS[index]} 偏差 ${(deviation * 100).toFixed(1)}%`).toBeLessThan(0.15)
    }
    // 最大最小差远小于总量
    expect(audit.maxMinDifference / expected).toBeLessThan(0.25)
  })

  it('评价顺序在配置集合固定的前提下被打乱', () => {
    const orders = new Set(
      Array.from({ length: 30 }, (_, i) => buildRatingPlan(0, `seed-${i}`).join(',')),
    )
    expect(orders.size).toBeGreaterThan(1)
    // 但集合内容应当一致（同一序号的配置集合不随 seed 改变）
    const firstSet = [...buildRatingPlan(0, 'a')].sort().join(',')
    const secondSet = [...buildRatingPlan(0, 'b')].sort().join(',')
    expect(secondSet).toBe(firstSet)
  })
})

describe('validateRatingPlan 能识别非法方案', () => {
  it('检测重复配置', () => {
    const result = validateRatingPlan(['C1', 'C1', 'C3', 'C5'])
    expect(result.ok).toBe(false)
    expect(result.problems.join()).toContain('重复')
  })

  it('检测数量不足', () => {
    const result = validateRatingPlan(['C1', 'C3'])
    expect(result.ok).toBe(false)
  })
})
