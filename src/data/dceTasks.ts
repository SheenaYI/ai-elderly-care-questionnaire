import type { BlockId, DceTask, ProfileId, StructureType, TaskId } from '@/types'
import { PROFILES, PROFILE_IDS, diffAttributes } from './profiles'

/**
 * 12 道 DCE 任务。
 *
 * 逐字转录自 V1.0 模块三任务表（表 3）：任务编号、卷别、A 配置、B 配置、结构类型。
 * `changedAttributes` **不手工填写**，由配置编码自动推导，
 * 以避免人工转录与配置表不一致。
 *
 * ⚠️ 不得修改任何 profileA / profileB / block 取值。
 *    V1.0 的"同向变化"题存在完全支配关系，相关问题记录在 RESEARCH_NOTES.md（B1），
 *    在获得研究团队确认前，本案不得擅自替换配对。
 */

interface DceTaskSource {
  id: TaskId
  block: BlockId
  profileA: ProfileId
  profileB: ProfileId
  structureType: StructureType
}

/** V1.0 表 3 的原始转录内容。 */
const DCE_TASK_SOURCE: readonly DceTaskSource[] = [
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
] as const

/** 12 道任务（派生出 changedAttributes）。 */
export const DCE_TASKS: readonly DceTask[] = DCE_TASK_SOURCE.map((source) => ({
  ...source,
  changedAttributes: diffAttributes(source.profileA, source.profileB),
}))

export const TASK_BY_ID: Record<TaskId, DceTask> = DCE_TASKS.reduce(
  (acc, task) => {
    acc[task.id] = task
    return acc
  },
  {} as Record<TaskId, DceTask>,
)

export const ALL_TASK_IDS: readonly TaskId[] = DCE_TASKS.map((t) => t.id)

/** 每卷恰好 6 道任务。 */
export const TASKS_BY_BLOCK: Record<BlockId, readonly DceTask[]> = {
  A: DCE_TASKS.filter((t) => t.block === 'A'),
  B: DCE_TASKS.filter((t) => t.block === 'B'),
}

export const BLOCK_TASK_IDS: Record<BlockId, readonly TaskId[]> = {
  A: TASKS_BY_BLOCK.A.map((t) => t.id),
  B: TASKS_BY_BLOCK.B.map((t) => t.id),
}

/** 每卷预期的题目数量（V1.0：A/B 卷各 6 题）。 */
export const TASKS_PER_BLOCK = 6

/** 每位参与者评价的配置数量（V1.0 模块四：每人评价 4 个配置）。 */
export const PROFILES_PER_PARTICIPANT = 4

/**
 * DCE 题的统一题干。转录自 V1.0 各题说明段（12 题措辞一致）。
 */
export const DCE_TASK_PROMPT =
  '请设想为自己或家中老人长期采用一套AI养老监测系统。以下两个方案的基础异常识别与报警能力相同。您更愿意采用哪一种？'

/** DCE 页面的选择提问。 */
export const DCE_CHOICE_QUESTION = '您更愿意长期采用哪一种配置？'

/** 面向参与者的模拟免责声明。 */
export const SIMULATION_DISCLAIMER =
  '此过程为研究用预设模拟，不代表真实AI识别、报警或视频记录结果。'

/**
 * 由三个属性水平反查配置编码。
 *
 * C1–C8 恰好覆盖 2×2×2 的全部 8 种组合，因此任何合法的 (X1,X2,X3) 都必然
 * 对应恰好一个编码。自由自选配置用它来判断参与者"拼"出的配置是哪一个。
 * 若传入非法水平（理论上不会发生），返回 null。
 */
export function profileIdForAttributes(
  x1: number,
  x2: number,
  x3: number,
): ProfileId | null {
  if (![0, 1].includes(x1) || ![0, 1].includes(x2) || ![0, 1].includes(x3)) return null
  const found = PROFILE_IDS.find((id) => {
    const p = PROFILES[id]
    return p.X1 === x1 && p.X2 === x2 && p.X3 === x3
  })
  return found ?? null
}

// ─────────────────────────────────────────────────────────────
// 设计完整性自查（在测试与开发时运行，不在运行时阻塞用户）
// ─────────────────────────────────────────────────────────────

export interface DesignCheckResult {
  ok: boolean
  problems: string[]
  details: {
    block: BlockId
    taskCount: number
    matrixRank: number
    levelCounts: Record<string, { zero: number; one: number }>
    profileUsage: Partial<Record<ProfileId, number>>
  }[]
  totalProfileUsage: Partial<Record<ProfileId, number>>
}

function matrixRank(matrix: number[][]): number {
  // 高斯消元求秩
  const rows = matrix.map((r) => [...r])
  const rowCount = rows.length
  const colCount = rows[0]?.length ?? 0
  let rank = 0

  for (let col = 0; col < colCount && rank < rowCount; col += 1) {
    let pivot = -1
    for (let row = rank; row < rowCount; row += 1) {
      if (Math.abs(rows[row]![col]!) > 1e-9) {
        pivot = row
        break
      }
    }
    if (pivot === -1) continue
    const tmp = rows[rank]!
    rows[rank] = rows[pivot]!
    rows[pivot] = tmp

    const pivotValue = rows[rank]![col]!
    for (let row = 0; row < rowCount; row += 1) {
      if (row === rank) continue
      const factor = rows[row]![col]! / pivotValue
      if (factor === 0) continue
      for (let c = col; c < colCount; c += 1) {
        rows[row]![c] = rows[row]![c]! - factor * rows[rank]![c]!
      }
    }
    rank += 1
  }
  return rank
}

/**
 * 校验 V1.0 设计的关键统计性质。
 *
 * 同时被 `npm test` 与管理后台的"设计完整性"面板使用，
 * 以便将来替换任务表后立即发现矩阵不可识别或属性失衡。
 */
export function checkDesignIntegrity(): DesignCheckResult {
  const problems: string[] = []
  const details: DesignCheckResult['details'] = []

  for (const block of ['A', 'B'] as BlockId[]) {
    const tasks = TASKS_BY_BLOCK[block]

    if (tasks.length !== TASKS_PER_BLOCK) {
      problems.push(`${block} 卷题目数为 ${tasks.length}，应为 ${TASKS_PER_BLOCK}`)
    }

    // 差分矩阵：每行 = [X1差, X2差, X3差]
    const matrix = tasks.map((task) => {
      const a = PROFILES[task.profileA]
      const b = PROFILES[task.profileB]
      return [b.X1 - a.X1, b.X2 - a.X2, b.X3 - a.X3]
    })
    const rank = matrixRank(matrix)
    if (rank !== 3) {
      problems.push(`${block} 卷差分矩阵秩为 ${rank}，应为 3`)
    }

    // 每个属性 0/1 的出现次数
    const levelCounts: Record<string, { zero: number; one: number }> = {}
    for (const key of ['X1', 'X2', 'X3'] as const) {
      let zero = 0
      let one = 0
      for (const task of tasks) {
        for (const pid of [task.profileA, task.profileB]) {
          if (PROFILES[pid][key] === 0) zero += 1
          else one += 1
        }
      }
      levelCounts[key] = { zero, one }
      if (zero !== one) {
        problems.push(`${block} 卷 ${key} 属性水平不平衡：0 出现 ${zero} 次，1 出现 ${one} 次`)
      }
    }

    // 配置使用次数
    const profileUsage: Partial<Record<ProfileId, number>> = {}
    for (const task of tasks) {
      for (const pid of [task.profileA, task.profileB]) {
        profileUsage[pid] = (profileUsage[pid] ?? 0) + 1
      }
    }

    details.push({
      block,
      taskCount: tasks.length,
      matrixRank: rank,
      levelCounts,
      profileUsage,
    })
  }

  // 每题必须恰好有两个属性发生变化（V1.0 全部任务均为 2 属性变化）
  for (const task of DCE_TASKS) {
    if (task.changedAttributes.length !== 2) {
      problems.push(
        `${task.id} 变化属性数为 ${task.changedAttributes.length}，应为 2（${task.changedAttributes.join(',')}）`,
      )
    }
    if (task.profileA === task.profileB) {
      problems.push(`${task.id} 两个方案为同一配置 ${task.profileA}`)
    }
    if (PROFILES[task.profileA].id !== task.profileA || !PROFILE_IDS.includes(task.profileB)) {
      problems.push(`${task.id} 引用了不存在的配置编码`)
    }
  }

  // 全设计 8 个配置应被均衡使用
  const totalProfileUsage: Partial<Record<ProfileId, number>> = {}
  for (const task of DCE_TASKS) {
    for (const pid of [task.profileA, task.profileB]) {
      totalProfileUsage[pid] = (totalProfileUsage[pid] ?? 0) + 1
    }
  }
  const usages = PROFILE_IDS.map((id) => totalProfileUsage[id] ?? 0)
  const maxUsage = Math.max(...usages)
  const minUsage = Math.min(...usages)
  if (maxUsage - minUsage > 1) {
    problems.push(
      `全设计配置使用不均衡：最多 ${maxUsage} 次，最少 ${minUsage} 次（${JSON.stringify(totalProfileUsage)}）`,
    )
  }

  return { ok: problems.length === 0, problems, details, totalProfileUsage }
}
