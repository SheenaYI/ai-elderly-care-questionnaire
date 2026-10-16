import type {
  AttributeKey,
  AttributeLevel,
  AttributeProfile,
  Profile,
  ProfileId,
} from '@/types'

/**
 * 三个实验属性的定义与水平。
 *
 * 全部文案转录自 V1.0《智能养老AI监测_问卷初稿与DCE实验设计_V1》
 * 模块二属性表（表 1）与"统一前提"（第 15、24 段）。
 * 除 X3 的展示名称外（见 RESEARCH_NOTES.md B2），未作任何改写。
 */

export interface AttributeLevelDefinition {
  level: AttributeLevel
  /** 水平短标签，用于卡片中的属性值小标题。 */
  label: string
  /** 水平完整说明，用于卡片正文。 */
  description: string
}

export interface AttributeDefinition {
  key: AttributeKey
  /** 面向参与者的属性名称（DCE 卡片题头）。 */
  title: string
  /** 研究用语名称。 */
  researchTitle: string
  /** 一句话解释属性操纵的内容。 */
  summary: string
  levels: Record<AttributeLevel, AttributeLevelDefinition>
}

export const ATTRIBUTE_DEFINITIONS: readonly AttributeDefinition[] = [
  {
    key: 'X1',
    title: '能看到什么',
    researchTitle: 'X1 共享层级',
    summary: '接收者能够查看的信息详细程度。',
    levels: {
      0: {
        level: 0,
        label: '仅摘要信息',
        description:
          '接收者仅查看"活动正常""疑似跌倒"等简要提示，不提供详细活动记录或视频。',
      },
      1: {
        level: 1,
        label: '详细原始数据',
        description:
          '接收者还可查看相关活动记录、视频等详细信息。',
      },
    },
  },
  {
    key: 'X2',
    title: '谁能查看',
    researchTitle: 'X2 共享对象',
    summary: '允许查看监测信息的人员范围。',
    levels: {
      0: {
        level: 0,
        label: '仅指定子女',
        description: '监测信息仅向您指定的子女开放。',
      },
      1: {
        level: 1,
        label: '指定子女与授权养老服务机构',
        description: '指定子女与授权养老服务机构均可以查看允许共享的信息。',
      },
    },
  },
  {
    key: 'X3',
    title: '平时如何监测',
    researchTitle: 'X3 详细监测方式',
    summary: '平时是否持续进行详细监测与记录。',
    levels: {
      0: {
        level: 0,
        label: '异常时详细监测',
        description:
          '基础异常检测持续运行；仅在异常时启动详细监测与记录。',
      },
      1: {
        level: 1,
        label: '全天持续详细监测',
        description: '全天持续进行详细活动监测与记录。',
      },
    },
  },
] as const

/** 属性定义按 key 索引。 */
export const ATTRIBUTE_BY_KEY: Record<AttributeKey, AttributeDefinition> = {
  X1: ATTRIBUTE_DEFINITIONS[0]!,
  X2: ATTRIBUTE_DEFINITIONS[1]!,
  X3: ATTRIBUTE_DEFINITIONS[2]!,
}

/**
 * 统一前提。转录自 V1.0 第 15、24 段。
 *
 * 这些说明必须向参与者展示，以避免把"仅摘要信息"误解为系统无法识别异常。
 */
export const UNIFIED_PREMISES = {
  /** 所有方案共有的基础能力（务必在情景说明中突出）。 */
  sharedCapability:
    '所有方案都具有相同的基础异常识别与报警能力，能够识别疑似跌倒、异常静止等风险，并向授权人员发出基本提醒。',
  /** 提示参与者不要假设已发生跌倒。 */
  taskFraming: '请比较长期使用这些配置的感受，而不是假设已经发生了跌倒事件。',
  /** 统一前提列表（原文）。 */
  items: [
    '系统基础报警性能相同。',
    '云端处理 / 存储规则、价格、授权与暂停设置在各方案间保持一致。',
    '"详细监测"与"向接收者共享详细信息"是不同概念。',
    '没有标准答案，请选实际更愿意采用的方案。',
  ],
  /** 用于模块四，确保 A3 自主感不被误解为配置间差异（见 RESEARCH_NOTES.md B4）。 */
  autonomyControlNotice: '所有配置均提供相同的授权与暂停设置。',
} as const

/**
 * 八种完整配置 C1–C8。
 *
 * 逐字转录自 V1.0 模块三配置表（表 2）。**不得修改任何取值。**
 */
export const PROFILES: Record<ProfileId, Profile> = {
  C1: { id: 'C1', X1: 0, X2: 0, X3: 0 },
  C2: { id: 'C2', X1: 0, X2: 0, X3: 1 },
  C3: { id: 'C3', X1: 0, X2: 1, X3: 1 },
  C4: { id: 'C4', X1: 1, X2: 0, X3: 0 },
  C5: { id: 'C5', X1: 1, X2: 0, X3: 1 },
  C6: { id: 'C6', X1: 0, X2: 1, X3: 0 },
  C7: { id: 'C7', X1: 1, X2: 1, X3: 0 },
  C8: { id: 'C8', X1: 1, X2: 1, X3: 1 },
}

/** 按 C1–C8 顺序排列的配置列表。 */
export const PROFILE_IDS: readonly ProfileId[] = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
] as const

export const PROFILE_LIST: readonly Profile[] = PROFILE_IDS.map((id) => PROFILES[id])

/** 取出配置的三个属性水平（用于快照记录）。 */
export function getAttributeProfile(profileId: ProfileId): AttributeProfile {
  const profile = PROFILES[profileId]
  return { X1: profile.X1, X2: profile.X2, X3: profile.X3 }
}

/** 读取某属性某水平的展示定义。 */
export function getAttributeLevel(
  key: AttributeKey,
  level: AttributeLevel,
): AttributeLevelDefinition {
  return ATTRIBUTE_BY_KEY[key].levels[level]
}

/** 计算两个配置之间发生变化的属性。 */
export function diffAttributes(a: ProfileId, b: ProfileId): AttributeKey[] {
  const pa = PROFILES[a]
  const pb = PROFILES[b]
  return (['X1', 'X2', 'X3'] as AttributeKey[]).filter((k) => pa[k] !== pb[k])
}

/** 判断某属性在两个配置之间是否不同（决定卡片是否用浅金色突出）。 */
export function isAttributeDifferent(
  key: AttributeKey,
  a: ProfileId,
  b: ProfileId,
): boolean {
  return PROFILES[a][key] !== PROFILES[b][key]
}
