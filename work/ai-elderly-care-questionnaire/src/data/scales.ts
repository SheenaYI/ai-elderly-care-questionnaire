import type { ConstructKey, LikertValue, ScaleItem, ScaleItemId } from '@/types'

/**
 * 模块四｜随机配置感知评价的 12 个量表题。
 *
 * 逐字转录自 V1.0 模块四量表（表 16）。**题目措辞一字未改，不得改写。**
 *
 * ⚠️ 记分方向提醒：
 *    - 隐私担忧（P1–P3）分数越高表示**隐私担忧越强**。
 *      不得反向计分为"隐私满意度"。
 *    - 安全感、自主感、采纳意愿分数越高表示该构念越强。
 */

export const CONSTRUCTS: readonly {
  key: ConstructKey
  title: string
  /** 计分方向说明，用于数据字典与后台展示。 */
  direction: string
  items: readonly ScaleItemId[]
}[] = [
  {
    key: 'security',
    title: '安全感',
    direction: '分数越高表示安全感越强',
    items: ['S1', 'S2', 'S3'],
  },
  {
    key: 'privacy',
    title: '隐私担忧',
    direction: '分数越高表示隐私担忧越强（不得反向计分为隐私满意度）',
    items: ['P1', 'P2', 'P3'],
  },
  {
    key: 'autonomy',
    title: '自主感',
    direction: '分数越高表示自主感越强',
    items: ['A1', 'A2', 'A3'],
  },
  {
    key: 'intention',
    title: '采纳意愿',
    direction: '分数越高表示采纳意愿越强',
    items: ['I1', 'I2', 'I3'],
  },
] as const

/** 12 个量表题，按 V1.0 表中的顺序。 */
export const SCALE_ITEMS: readonly ScaleItem[] = [
  {
    id: 'S1',
    construct: 'security',
    text: '我认为该系统能够及时发现老人可能发生的安全风险。',
  },
  {
    id: 'S2',
    construct: 'security',
    text: '我认为该系统能够在发生紧急情况时提供有效的安全保障。',
  },
  {
    id: 'S3',
    construct: 'security',
    text: '使用该系统会让我对老人的居家安全更加放心。',
  },
  {
    id: 'P1',
    construct: 'privacy',
    text: '我担心该系统收集或共享了过多的老人个人信息。',
  },
  {
    id: 'P2',
    construct: 'privacy',
    text: '我担心该系统会使老人的私人生活受到过度关注。',
  },
  {
    id: 'P3',
    construct: 'privacy',
    text: '我担心该系统中的个人信息被不必要的人员查看。',
  },
  {
    id: 'A1',
    construct: 'autonomy',
    text: '我认为老人使用该系统后，仍然能够自主安排日常生活。',
  },
  {
    id: 'A2',
    construct: 'autonomy',
    text: '我认为该系统不会过度干预老人的个人生活。',
  },
  {
    id: 'A3',
    construct: 'autonomy',
    text: '我认为老人能够对自己的监测和信息共享方式保持控制权。',
  },
  {
    id: 'I1',
    construct: 'intention',
    text: '如果该系统实际可用，我愿意选择或为老人配置该系统。',
  },
  {
    id: 'I2',
    construct: 'intention',
    text: '我愿意在实际养老照护中长期使用该系统。',
  },
  {
    id: 'I3',
    construct: 'intention',
    text: '如果有类似养老需求，我愿意推荐使用该系统。',
  },
] as const

export const SCALE_ITEM_BY_ID: Record<ScaleItemId, ScaleItem> = SCALE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item
    return acc
  },
  {} as Record<ScaleItemId, ScaleItem>,
)

export const ALL_SCALE_ITEM_IDS: readonly ScaleItemId[] = SCALE_ITEMS.map((i) => i.id)

/** 全部量表题数量（应为 12）。 */
export const SCALE_ITEM_COUNT = SCALE_ITEMS.length

/** 5 点 Likert 量表。转录自 V1.0 模块四评分标准。 */
export const LIKERT_OPTIONS: readonly { value: LikertValue; label: string }[] = [
  { value: 1, label: '非常不同意' },
  { value: 2, label: '不同意' },
  { value: 3, label: '一般' },
  { value: 4, label: '同意' },
  { value: 5, label: '非常同意' },
] as const

export const LIKERT_VALUES: readonly LikertValue[] = [1, 2, 3, 4, 5] as const

export const LIKERT_SCALE_PROMPT = '评分标准：1=非常不同意，2=不同意，3=一般，4=同意，5=非常同意。'

/** 判断一个数值是否为合法 Likert 取值。 */
export function isLikertValue(value: unknown): value is LikertValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

/** 按构念取题。 */
export function getItemsByConstruct(construct: ConstructKey): readonly ScaleItem[] {
  return SCALE_ITEMS.filter((item) => item.construct === construct)
}
