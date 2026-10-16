import { describe, expect, it } from 'vitest'
import {
  DCE_TASKS,
  TASKS_BY_BLOCK,
  TASK_BY_ID,
  TASKS_PER_BLOCK,
  BLOCK_TASK_IDS,
  PROFILES_PER_PARTICIPANT,
  checkDesignIntegrity,
} from '@/data/dceTasks'
import { PROFILES, PROFILE_IDS, diffAttributes } from '@/data/profiles'

/**
 * DCE 任务配置测试。
 *
 * 目的：保护 V1.0 的研究设计不被意外改动。
 * 如果这些测试失败，说明 C1–C8 或 T01–T12 的取值被修改了。
 */

// V1.0 表 3 的权威转录（独立于实现，用于交叉验证）
const EXPECTED_TASKS: {
  id: string
  block: 'A' | 'B'
  profileA: string
  profileB: string
  structureType: string
}[] = [
  { id: 'T01', block: 'A', profileA: 'C1', profileB: 'C3', structureType: '同向变化' },
  { id: 'T02', block: 'A', profileA: 'C1', profileB: 'C5', structureType: '同向变化' },
  { id: 'T03', block: 'A', profileA: 'C1', profileB: 'C7', structureType: '同向变化' },
  { id: 'T04', block: 'B', profileA: 'C2', profileB: 'C4', structureType: '替代权衡' },
  { id: 'T05', block: 'B', profileA: 'C2', profileB: 'C6', structureType: '替代权衡' },
  { id: 'T06', block: 'B', profileA: 'C2', profileB: 'C8', structureType: '同向变化' },
  { id: 'T07', block: 'A', profileA: 'C3', profileB: 'C5', structureType: '替代权衡' },
  { id: 'T08', block: 'A', profileA: 'C3', profileB: 'C7', structureType: '替代权衡' },
  { id: 'T09', block: 'B', profileA: 'C4', profileB: 'C6', structureType: '替代权衡' },
  { id: 'T10', block: 'B', profileA: 'C4', profileB: 'C8', structureType: '同向变化' },
  { id: 'T11', block: 'A', profileA: 'C5', profileB: 'C7', structureType: '替代权衡' },
  { id: 'T12', block: 'B', profileA: 'C6', profileB: 'C8', structureType: '同向变化' },
]

// V1.0 表 2 的权威转录
const EXPECTED_PROFILES: Record<string, [number, number, number]> = {
  C1: [0, 0, 0], C2: [0, 0, 1], C3: [0, 1, 1], C4: [1, 0, 0],
  C5: [1, 0, 1], C6: [0, 1, 0], C7: [1, 1, 0], C8: [1, 1, 1],
}

describe('C1–C8 配置编码', () => {
  it('恰好有 8 个配置，编号为 C1–C8', () => {
    expect(PROFILE_IDS).toHaveLength(8)
    expect([...PROFILE_IDS]).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'])
  })

  it('每个配置的 (X1, X2, X3) 与 V1.0 表 2 完全一致', () => {
    for (const [id, expected] of Object.entries(EXPECTED_PROFILES)) {
      const profile = PROFILES[id as keyof typeof PROFILES]
      expect([profile.X1, profile.X2, profile.X3], `配置 ${id}`).toEqual(expected)
    }
  })

  it('覆盖全部 2×2×2 = 8 种组合，无重复无缺失', () => {
    const seen = new Set(
      PROFILE_IDS.map((id) => `${PROFILES[id].X1}${PROFILES[id].X2}${PROFILES[id].X3}`),
    )
    expect(seen.size).toBe(8)
  })
})

describe('T01–T12 任务配对', () => {
  it('恰好有 12 道任务', () => {
    expect(DCE_TASKS).toHaveLength(12)
  })

  it('每道题的卷别、A/B 配置与结构类型与 V1.0 表 3 一致', () => {
    for (const expected of EXPECTED_TASKS) {
      const task = TASK_BY_ID[expected.id as keyof typeof TASK_BY_ID]
      expect(task, `任务 ${expected.id} 应存在`).toBeDefined()
      expect(task.block, `${expected.id} 卷别`).toBe(expected.block)
      expect(task.profileA, `${expected.id} A 配置`).toBe(expected.profileA)
      expect(task.profileB, `${expected.id} B 配置`).toBe(expected.profileB)
      expect(task.structureType, `${expected.id} 结构类型`).toBe(expected.structureType)
    }
  })

  it('changedAttributes 由配置编码推导，且与 V1.0 标注的变化属性一致', () => {
    // V1.0 各题"变化属性"标注
    const declared: Record<string, string[]> = {
      T01: ['X2', 'X3'], T02: ['X1', 'X3'], T03: ['X1', 'X2'], T04: ['X1', 'X3'],
      T05: ['X2', 'X3'], T06: ['X1', 'X2'], T07: ['X1', 'X2'], T08: ['X1', 'X3'],
      T09: ['X1', 'X2'], T10: ['X2', 'X3'], T11: ['X2', 'X3'], T12: ['X1', 'X3'],
    }
    for (const task of DCE_TASKS) {
      expect(task.changedAttributes, `${task.id}`).toEqual(declared[task.id])
      // 同时交叉验证：推导结果与独立计算的差分一致
      expect(diffAttributes(task.profileA, task.profileB)).toEqual(task.changedAttributes)
    }
  })

  it('每道题的两个方案都不同，且恰好有 2 个属性发生变化', () => {
    for (const task of DCE_TASKS) {
      expect(task.profileA, `${task.id} 两方案不应相同`).not.toBe(task.profileB)
      expect(task.changedAttributes, `${task.id} 变化属性数`).toHaveLength(2)
    }
  })

  it('任务编号无重复', () => {
    const ids = DCE_TASKS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('A/B 分卷', () => {
  it('每卷恰好 6 道题', () => {
    expect(TASKS_BY_BLOCK.A).toHaveLength(TASKS_PER_BLOCK)
    expect(TASKS_BY_BLOCK.B).toHaveLength(TASKS_PER_BLOCK)
    expect(TASKS_PER_BLOCK).toBe(6)
  })

  it('A 卷为 T01,T02,T03,T07,T08,T11；B 卷为 T04,T05,T06,T09,T10,T12', () => {
    expect([...BLOCK_TASK_IDS.A]).toEqual(['T01', 'T02', 'T03', 'T07', 'T08', 'T11'])
    expect([...BLOCK_TASK_IDS.B]).toEqual(['T04', 'T05', 'T06', 'T09', 'T10', 'T12'])
  })

  it('两卷任务互不重叠，合计覆盖全部 12 题', () => {
    const a = new Set(BLOCK_TASK_IDS.A)
    const b = new Set(BLOCK_TASK_IDS.B)
    for (const id of a) expect(b.has(id), `${id} 不应同时属于两卷`).toBe(false)
    expect(new Set([...BLOCK_TASK_IDS.A, ...BLOCK_TASK_IDS.B]).size).toBe(12)
  })

  it('每卷的差分矩阵秩 = 3（主效应可识别）', () => {
    for (const block of ['A', 'B'] as const) {
      const matrix = TASKS_BY_BLOCK[block].map((t) => {
        const a = PROFILES[t.profileA]
        const b = PROFILES[t.profileB]
        return [b.X1 - a.X1, b.X2 - a.X2, b.X3 - a.X3]
      })
      expect(rank(matrix), `${block} 卷秩`).toBe(3)
    }
  })

  it('每卷中每个属性的 0 与 1 各出现 6 次（属性平衡）', () => {
    for (const block of ['A', 'B'] as const) {
      for (const key of ['X1', 'X2', 'X3'] as const) {
        let zero = 0
        let one = 0
        for (const task of TASKS_BY_BLOCK[block]) {
          for (const pid of [task.profileA, task.profileB]) {
            if (PROFILES[pid][key] === 0) zero += 1
            else one += 1
          }
        }
        expect(zero, `${block} 卷 ${key} 的 0 次数`).toBe(6)
        expect(one, `${block} 卷 ${key} 的 1 次数`).toBe(6)
      }
    }
  })

  it('每卷各含 3 道同向变化题与 3 道替代权衡题', () => {
    for (const block of ['A', 'B'] as const) {
      const tasks = TASKS_BY_BLOCK[block]
      expect(tasks.filter((t) => t.structureType === '同向变化')).toHaveLength(3)
      expect(tasks.filter((t) => t.structureType === '替代权衡')).toHaveLength(3)
    }
  })

  it('A 卷只使用 C1/C3/C5/C7，B 卷只使用 C2/C4/C6/C8', () => {
    const collect = (block: 'A' | 'B') =>
      new Set(TASKS_BY_BLOCK[block].flatMap((t) => [t.profileA, t.profileB]))
    expect([...collect('A')].sort()).toEqual(['C1', 'C3', 'C5', 'C7'])
    expect([...collect('B')].sort()).toEqual(['C2', 'C4', 'C6', 'C8'])
  })
})

describe('设计完整性自查函数', () => {
  it('对当前 V1.0 配置返回通过', () => {
    const result = checkDesignIntegrity()
    expect(result.problems, `发现问题：\n${result.problems.join('\n')}`).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('报告每卷秩为 3 且属性平衡', () => {
    const result = checkDesignIntegrity()
    for (const detail of result.details) {
      expect(detail.matrixRank).toBe(3)
      expect(detail.taskCount).toBe(TASKS_PER_BLOCK)
      for (const counts of Object.values(detail.levelCounts)) {
        expect(counts.zero).toBe(counts.one)
      }
    }
  })

  it('全设计 8 个配置各被使用 3 次', () => {
    const result = checkDesignIntegrity()
    for (const id of PROFILE_IDS) {
      expect(result.totalProfileUsage[id], `配置 ${id} 使用次数`).toBe(3)
    }
  })
})

describe('每位参与者评价 4 个配置', () => {
  it('常量 PROFILES_PER_PARTICIPANT 为 4', () => {
    expect(PROFILES_PER_PARTICIPANT).toBe(4)
  })
})

/** 测试内独立实现的高斯消元求秩（不依赖被测代码）。 */
function rank(matrix: number[][]): number {
  const rows = matrix.map((r) => [...r])
  const rowCount = rows.length
  const colCount = rows[0]?.length ?? 0
  let r = 0
  for (let col = 0; col < colCount && r < rowCount; col += 1) {
    let pivot = -1
    for (let row = r; row < rowCount; row += 1) {
      if (Math.abs(rows[row]![col]!) > 1e-9) { pivot = row; break }
    }
    if (pivot === -1) continue
    const tmp = rows[r]!; rows[r] = rows[pivot]!; rows[pivot] = tmp
    const pv = rows[r]![col]!
    for (let row = 0; row < rowCount; row += 1) {
      if (row === r) continue
      const factor = rows[row]![col]! / pv
      if (factor === 0) continue
      for (let c = col; c < colCount; c += 1) rows[row]![c] = rows[row]![c]! - factor * rows[r]![c]!
    }
    r += 1
  }
  return r
}
