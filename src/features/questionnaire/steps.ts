/**
 * 问卷步骤定义。
 *
 * 问卷**不是**一页无限滚动的长表单，而是分成可返回的步骤。
 * 步骤编号与问卷模块的对应关系：
 *   consent      模块一 知情同意与身份信息
 *   scenario     模块二 统一情景与属性说明 + 理解检查
 *   dce          模块三 DCE 离散选择实验（6 题）
 *   ratings      模块四 随机配置感知评价（4 个配置 × 12 题）
 *   overall      模块五 总体评价
 *   ideal        模块六 理想配置自由设定（**V1.0 之外新增**）
 *   review       提交前检查
 *   done         感谢页面
 */

export const STEP_ORDER = [
  'consent',
  'scenario',
  'dce',
  'ratings',
  'overall',
  'ideal',
  'review',
  'done',
] as const

export type StepId = (typeof STEP_ORDER)[number]

export const STEP_META: Record<StepId, { title: string; short: string; index: number }> = {
  consent: { title: '知情同意与身份信息', short: '知情同意', index: 1 },
  scenario: { title: '研究情景与理解检查', short: '情景说明', index: 2 },
  dce: { title: '系统配置选择', short: '配置选择', index: 3 },
  ratings: { title: '配置感受评价', short: '感受评价', index: 4 },
  overall: { title: '总体评价', short: '总体评价', index: 5 },
  ideal: { title: '您的理想配置', short: '理想配置', index: 6 },
  review: { title: '提交前检查', short: '提交检查', index: 7 },
  done: { title: '提交结果', short: '完成', index: 8 },
}

/** 进度条中统计的总步数（不含 done）。 */
export const TOTAL_PROGRESS_STEPS = 7

export function isStepId(value: string | undefined): value is StepId {
  return value !== undefined && (STEP_ORDER as readonly string[]).includes(value)
}

/** 取某步骤的下一步。 */
export function nextStep(step: StepId): StepId {
  const index = STEP_ORDER.indexOf(step)
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]!
}

/** 取某步骤的上一步。 */
export function previousStep(step: StepId): StepId {
  const index = STEP_ORDER.indexOf(step)
  return STEP_ORDER[Math.max(index - 1, 0)]!
}
