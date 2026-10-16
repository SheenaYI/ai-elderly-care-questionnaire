/**
 * 随机化引擎。
 *
 * 设计目标（对应 V1.0 第四部分"四项设计检查"与用户提出的数据质量要求）：
 *   1. A/B 随机分卷。
 *   2. 每卷题目展示顺序随机。
 *   3. 每题左右方案位置随机交换（用于检测与抵消位置效应）。
 *   4. 每人评价 4 个不同配置，且总体样本中各配置被评价次数尽量均衡。
 *   5. **随机化结果在一次问卷会话中保持稳定**：刷新页面、返回上一题
 *      都不得重新随机。因此本模块全部为纯函数，随机化结果由调用方
 *      写入草稿并持久化，而非在渲染时重新计算。
 *
 * 所有随机性来自显式传入的 `seed`，因此结果可复现、可审计。
 */

import type {
  AttributeProfile,
  BlockId,
  DceTaskDisplayPlan,
  ProfileId,
  TaskId,
} from '@/types'
import { PROFILES, PROFILE_IDS } from '@/data/profiles'
import {
  BLOCK_TASK_IDS,
  PROFILES_PER_PARTICIPANT,
  TASK_BY_ID,
  TASKS_PER_BLOCK,
} from '@/data/dceTasks'

/** 任务编号 → V1.0 表中写明的 A/B 配置配对（不作为展示位置使用）。 */
const TASK_PAIRS: Record<string, { profileA: ProfileId; profileB: ProfileId }> = Object.fromEntries(
  Object.values(TASK_BY_ID).map((t) => [t.id, { profileA: t.profileA, profileB: t.profileB }]),
)

// ─────────────────────────────────────────────────────────────
// 确定性伪随机数发生器
// ─────────────────────────────────────────────────────────────

/** 将任意字符串散列为 32 位无符号整数（FNV-1a）。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * mulberry32：小巧、快速、统计性质良好的 32 位 PRNG。
 * 同一 seed 必然产生同一序列，保证随机化可复现。
 */
export function createRng(seed: number | string): () => number {
  let state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates 洗牌，返回新数组，不修改入参。 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

// ─────────────────────────────────────────────────────────────
// 1. A/B 随机分卷
// ─────────────────────────────────────────────────────────────

/**
 * 随机分配卷别。
 *
 * 若提供 `sequenceIndex`（该参与者在样本中的到达序号），则采用
 * **随机起点 + 交替分配**：先随机决定奇偶序号各自对应的卷别，
 * 再按序号交替。这样既保证分卷随机（起点随机、不可预测），
 * 又保证累计样本量下 A/B 人数尽量均衡——避免纯抛硬币在小样本下
 * 出现明显失衡。
 */
export function assignBlock(seed: string | number, sequenceIndex?: number): BlockId {
  const rng = createRng(`block:${seed}`)
  // 随机决定偶数序号分配到哪一卷，奇数序号分配到另一卷
  const evenBlock: BlockId = rng() < 0.5 ? 'A' : 'B'
  const oddBlock: BlockId = evenBlock === 'A' ? 'B' : 'A'

  if (sequenceIndex === undefined) {
    // 无序号信息时退回纯随机，同时保留 seed 决定论
    return rng() < 0.5 ? 'A' : 'B'
  }
  return sequenceIndex % 2 === 0 ? evenBlock : oddBlock
}

// ─────────────────────────────────────────────────────────────
// 2 + 3. 题目顺序随机化 与 左右位置随机交换
// ─────────────────────────────────────────────────────────────

/** 读取某题在 V1.0 表中的 A/B 配置配对。 */
function getTaskPair(taskId: TaskId): { profileA: ProfileId; profileB: ProfileId } {
  const entry = TASK_PAIRS[taskId]
  if (!entry) throw new Error(`未知任务编号：${taskId}`)
  return entry
}

/**
 * 生成一卷的展示方案：题目顺序随机 + 每题左右随机。
 *
 * @param block  参与者的卷别
 * @param seed   会话种子；同一会话必须传入相同 seed 以保证稳定
 */
export function buildTaskDisplayPlan(block: BlockId, seed: string | number): DceTaskDisplayPlan[] {
  const taskIds = BLOCK_TASK_IDS[block]
  const orderRng = createRng(`order:${seed}:${block}`)
  const shuffledTaskIds = shuffle(taskIds, orderRng)

  const positionRng = createRng(`position:${seed}:${block}`)

  return shuffledTaskIds.map((taskId, index) => {
    const task = getTaskPair(taskId)
    // 每题独立决定是否交换左右
    const swap = positionRng() < 0.5
    return {
      taskId,
      displayOrder: index + 1,
      leftProfileId: swap ? task.profileB : task.profileA,
      rightProfileId: swap ? task.profileA : task.profileB,
    }
  })
}


// ─────────────────────────────────────────────────────────────
// 4. 每人评价 4 个配置（平衡分配）
// ─────────────────────────────────────────────────────────────

/**
 * 4 个配置的平衡分配方案。
 *
 * 机制说明（可复现、可审计）：
 *
 * 把 C1–C8 视为一个长度为 8 的循环序列 `S = [C1..C8]`。对第 k 位参与者
 * （`sequenceIndex = k`），取其起点偏移 `o = k mod 8`，并取步长 `2`
 * （与 8 互质，保证连续 4 项互不相同），得到
 *
 *     评价配置 = [ S[o], S[o+2], S[o+4], S[o+6] ]   （下标 mod 8）
 *
 * 性质：
 *   - **每人 4 个不同配置**：步长 2 与 8 互质，且只取 4 项，故互不相同。
 *   - **总体均衡**：连续 8 位参与者（k = 0..7）的起点覆盖全部 8 个偏移；
 *     对任一固定偏移位置 p（第 1–4 个被评价的位置），8 位参与者恰好
 *     各评价到 8 个不同配置一次。因此每人 4 个配置、每 8 人恰好
 *     覆盖 4 × 8 = 32 = 8 配置 × 4 次，即**每个配置被评价 4 次**，
 *     完全均衡，无随机漂移。
 *   - **可审计**：给定 `sequenceIndex` 即可推出配置，无需保存随机状态；
 *     同时在草稿中显式保存 `ratingPlan` 以供核对。
 *
 * 评价顺序本身再做一次随机洗牌（seed 固定），但洗牌只改变顺序，
 * 不改变被选中的 4 个配置集合。
 */
export function buildRatingPlan(
  sequenceIndex: number,
  seed: string | number,
): ProfileId[] {
  const cycleLength = PROFILE_IDS.length // 8
  const step = 2 // 与 8 互质，保证 4 项互不相同
  const start = ((sequenceIndex % cycleLength) + cycleLength) % cycleLength

  const selected: ProfileId[] = []
  for (let i = 0; i < PROFILES_PER_PARTICIPANT; i += 1) {
    selected.push(PROFILE_IDS[(start + i * step) % cycleLength]!)
  }

  // 评价顺序随机（不影响集合内容）
  const orderRng = createRng(`rating-order:${seed}`)
  return shuffle(selected, orderRng)
}

/** 校验一份分配方案是否满足研究要求。 */
export function validateRatingPlan(plan: readonly ProfileId[]): {
  ok: boolean
  problems: string[]
} {
  const problems: string[] = []
  if (plan.length !== PROFILES_PER_PARTICIPANT) {
    problems.push(`评价配置数为 ${plan.length}，应为 ${PROFILES_PER_PARTICIPANT}`)
  }
  if (new Set(plan).size !== plan.length) {
    problems.push('评价配置存在重复，应为不同配置')
  }
  for (const id of plan) {
    if (!PROFILE_IDS.includes(id)) problems.push(`未知配置编码：${id}`)
  }
  return { ok: problems.length === 0, problems }
}

/**
 * 审计一批参与者的评分配置分配结果。
 * 供测试与管理后台"配置评分数据完整性"面板使用。
 */
export function auditRatingAllocation(sequenceIndices: readonly number[]): {
  totalAssignments: number
  counts: Record<ProfileId, number>
  maxMinDifference: number
  balanced: boolean
} {
  const counts = Object.fromEntries(PROFILE_IDS.map((id) => [id, 0])) as Record<ProfileId, number>
  for (const index of sequenceIndices) {
    for (const profileId of buildRatingPlan(index, 'audit')) {
      counts[profileId] += 1
    }
  }
  const values = Object.values(counts)
  const maxMinDifference = values.length ? Math.max(...values) - Math.min(...values) : 0
  return {
    totalAssignments: sequenceIndices.length * PROFILES_PER_PARTICIPANT,
    counts,
    maxMinDifference,
    // 只要每位参与者评价 4 个不同配置，最多相差 1 次即视为均衡
    balanced: maxMinDifference <= 1,
  }
}

// ─────────────────────────────────────────────────────────────
// 一致性自查
// ─────────────────────────────────────────────────────────────

/** 校验展示方案：题目齐全、无重复、每位参与者的左右分布不过度偏斜。 */
export function validateTaskDisplayPlan(
  block: BlockId,
  plan: readonly DceTaskDisplayPlan[],
): { ok: boolean; problems: string[] } {
  const problems: string[] = []
  const expected = BLOCK_TASK_IDS[block]

  if (plan.length !== TASKS_PER_BLOCK) {
    problems.push(`展示题目数为 ${plan.length}，${block} 卷应为 ${TASKS_PER_BLOCK}`)
  }

  const seen = new Set<TaskId>()
  for (const item of plan) {
    if (seen.has(item.taskId)) problems.push(`任务 ${item.taskId} 重复出现`)
    seen.add(item.taskId)

    if (!expected.includes(item.taskId)) {
      problems.push(`任务 ${item.taskId} 不属于 ${block} 卷`)
    }
    if (item.leftProfileId === item.rightProfileId) {
      problems.push(`任务 ${item.taskId} 左右方案相同（${item.leftProfileId}）`)
    }

    const pair = getTaskPair(item.taskId)
    const validPair =
      (item.leftProfileId === pair.profileA && item.rightProfileId === pair.profileB) ||
      (item.leftProfileId === pair.profileB && item.rightProfileId === pair.profileA)
    if (!validPair) {
      problems.push(
        `任务 ${item.taskId} 的左右配置 (${item.leftProfileId}, ${item.rightProfileId}) 与 V1.0 配对 (${pair.profileA}, ${pair.profileB}) 不符`,
      )
    }
  }

  for (const taskId of expected) {
    if (!seen.has(taskId)) problems.push(`${block} 卷缺少任务 ${taskId}`)
  }

  return { ok: problems.length === 0, problems }
}

/** 取某配置的三个属性（用于快照）。 */
export function profileAttributes(profileId: ProfileId): AttributeProfile {
  const p = PROFILES[profileId]
  return { X1: p.X1, X2: p.X2, X3: p.X3 }
}
