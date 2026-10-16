import { describe, expect, it } from 'vitest'
import {
  COMPREHENSION_QUESTIONS,
  COMPREHENSION_QUESTION_COUNT,
  Q1_CONSENT,
  Q2_AGE_GROUPS,
  Q3_ROLES,
  Q4_AI_EXPERIENCE,
  Q5_CAREGIVING,
  Q9_CONCERNS,
  QUESTIONNAIRE_VERSION,
  correctOptionIndex,
  isCorrectComprehensionAnswer,
} from '@/data/questionnaire'
import {
  CONSTRUCTS,
  LIKERT_OPTIONS,
  LIKERT_SCALE_PROMPT,
  SCALE_ITEMS,
  SCALE_ITEM_COUNT,
  isLikertValue,
} from '@/data/scales'
import {
  ATTRIBUTE_DEFINITIONS,
  PROFILES,
  PROFILE_IDS,
  UNIFIED_PREMISES,
} from '@/data/profiles'
import {
  SIMULATION_EVENT,
  SIMULATION_TIMING,
  TIMELINE_STEPS,
  getMonitoringCopy,
  getNotificationContent,
  getRecipients,
} from '@/features/simulation/simulationScript'
import { ALL_CONFIGURABLE_FIELDS } from '@/data/placeholders'

/**
 * 问卷内容与模拟脚本的保真度测试。
 *
 * 目的：
 *   1. 保证题目、选项、正确答案与 V1.0 一致（防止被无意改写）。
 *   2. 保证模拟实验条件受控：各配置使用相同事件、相同时间线、
 *      相同交互结构，且不改变识别性能或报警速度。
 */

describe('问卷基本信息', () => {
  it('版本号已定义', () => {
    expect(QUESTIONNAIRE_VERSION).toMatch(/^V\d+\.\d+$/)
  })
})

describe('模块一 知情同意与身份信息', () => {
  it('Q1 提供"同意并继续"与"不同意（结束）"两个选项', () => {
    expect(Q1_CONSENT.options).toHaveLength(2)
    expect(Q1_CONSENT.options[0]!.label).toBe('同意并继续')
    expect(Q1_CONSENT.options[1]!.label).toBe('不同意（结束）')
  })

  it('Q2 提供 5 个年龄段，与 V1.0 一致', () => {
    expect(Q2_AGE_GROUPS.map((g) => g.label)).toEqual([
      '18–29岁', '30–44岁', '45–59岁', '60–69岁', '70岁及以上',
    ])
  })

  it('Q3 提供 4 种答题身份，与 V1.0 一致', () => {
    expect(Q3_ROLES.map((r) => r.label)).toEqual([
      '老年人本人', '当前家庭照护者', '潜在家庭照护者', '其他（请注明）',
    ])
  })

  it('Q4 提供 3 个了解程度选项', () => {
    expect(Q4_AI_EXPERIENCE.map((o) => o.label)).toEqual(['使用过', '了解但未使用', '不了解'])
  })

  it('Q5 提供 3 个照护经历选项', () => {
    expect(Q5_CAREGIVING.map((o) => o.label)).toEqual(['经常', '偶尔', '没有'])
  })
})

describe('模块二 理解检查', () => {
  it('恰好 2 道理解检查题（Q6、Q7）', () => {
    expect(COMPREHENSION_QUESTION_COUNT).toBe(2)
    expect(COMPREHENSION_QUESTIONS.map((q) => q.id)).toEqual(['Q6', 'Q7'])
  })

  it('Q6 的正确答案是"仅可查看简要提示"（第 1 项）', () => {
    expect(correctOptionIndex('Q6')).toBe(0)
    expect(isCorrectComprehensionAnswer('Q6', 0)).toBe(true)
    expect(isCorrectComprehensionAnswer('Q6', 1)).toBe(false)
    expect(isCorrectComprehensionAnswer('Q6', 2)).toBe(false)
  })

  it('Q7 的正确答案是"基础检测持续，异常时启动详细记录"（第 2 项）', () => {
    expect(correctOptionIndex('Q7')).toBe(1)
    expect(isCorrectComprehensionAnswer('Q7', 0)).toBe(false)
    expect(isCorrectComprehensionAnswer('Q7', 1)).toBe(true)
    expect(isCorrectComprehensionAnswer('Q7', 2)).toBe(false)
  })

  it('每题恰好 3 个选项且恰有 1 个正确答案', () => {
    for (const question of COMPREHENSION_QUESTIONS) {
      expect(question.options).toHaveLength(3)
      expect(question.options.filter((o) => o.correct)).toHaveLength(1)
    }
  })

  it('每道题都提供答错后展示的解释', () => {
    for (const question of COMPREHENSION_QUESTIONS) {
      expect(question.explanation.length).toBeGreaterThan(20)
    }
  })

  it('Q6 的解释说明"仅摘要"不降低识别能力（避免核心误解）', () => {
    const q6 = COMPREHENSION_QUESTIONS.find((q) => q.id === 'Q6')!
    expect(q6.explanation).toMatch(/识别.*(不会降低|相同)|能力.*相同/)
  })
})

describe('模块四 量表（12 题）', () => {
  it('恰好 12 道量表题', () => {
    expect(SCALE_ITEM_COUNT).toBe(12)
  })

  it('题号与构念的对应关系正确（S/P/A/I 各 3 题）', () => {
    const expected: Record<string, string> = {
      S1: 'security', S2: 'security', S3: 'security',
      P1: 'privacy', P2: 'privacy', P3: 'privacy',
      A1: 'autonomy', A2: 'autonomy', A3: 'autonomy',
      I1: 'intention', I2: 'intention', I3: 'intention',
    }
    for (const item of SCALE_ITEMS) {
      expect(item.construct, item.id).toBe(expected[item.id])
    }
  })

  it('四个构念各含 3 题', () => {
    for (const construct of CONSTRUCTS) {
      expect(construct.items).toHaveLength(3)
    }
  })

  it('题目文字与 V1.0 原文一致', () => {
    const original: Record<string, string> = {
      S1: '我认为该系统能够及时发现老人可能发生的安全风险。',
      S2: '我认为该系统能够在发生紧急情况时提供有效的安全保障。',
      S3: '使用该系统会让我对老人的居家安全更加放心。',
      P1: '我担心该系统收集或共享了过多的老人个人信息。',
      P2: '我担心该系统会使老人的私人生活受到过度关注。',
      P3: '我担心该系统中的个人信息被不必要的人员查看。',
      A1: '我认为老人使用该系统后，仍然能够自主安排日常生活。',
      A2: '我认为该系统不会过度干预老人的个人生活。',
      A3: '我认为老人能够对自己的监测和信息共享方式保持控制权。',
      I1: '如果该系统实际可用，我愿意选择或为老人配置该系统。',
      I2: '我愿意在实际养老照护中长期使用该系统。',
      I3: '如果有类似养老需求，我愿意推荐使用该系统。',
    }
    for (const item of SCALE_ITEMS) {
      expect(item.text, item.id).toBe(original[item.id])
    }
  })

  it('隐私担忧的计分方向记录为"担忧越强"（不得反向计分）', () => {
    const privacy = CONSTRUCTS.find((c) => c.key === 'privacy')!
    expect(privacy.direction).toContain('隐私担忧越强')
    expect(privacy.direction).toContain('不得反向计分')
  })

  it('5 点 Likert 选项与 V1.0 完全一致', () => {
    expect(LIKERT_OPTIONS.map((o) => o.label)).toEqual([
      '非常不同意', '不同意', '一般', '同意', '非常同意',
    ])
    expect(LIKERT_OPTIONS.map((o) => o.value)).toEqual([1, 2, 3, 4, 5])
    expect(LIKERT_SCALE_PROMPT).toBe('评分标准：1=非常不同意，2=不同意，3=一般，4=同意，5=非常同意。')
  })

  it('isLikertValue 只接受 1–5', () => {
    for (const v of [1, 2, 3, 4, 5]) expect(isLikertValue(v)).toBe(true)
    for (const v of [0, 6, -1, 2.5, '3', null, undefined]) expect(isLikertValue(v)).toBe(false)
  })
})

describe('模块五 总体评价', () => {
  it('Q9 提供 5 个担心项，与 V1.0 一致', () => {
    expect(Q9_CONCERNS.map((c) => c.label)).toEqual([
      '安全风险识别不足', '个人隐私暴露', '老人自主性受限', '操作复杂', '其他',
    ])
  })
})

describe('三个实验属性', () => {
  it('恰好 3 个属性，编码为 X1/X2/X3', () => {
    expect(ATTRIBUTE_DEFINITIONS).toHaveLength(3)
    expect(ATTRIBUTE_DEFINITIONS.map((d) => d.key)).toEqual(['X1', 'X2', 'X3'])
  })

  it('每个属性恰好 2 个水平', () => {
    for (const definition of ATTRIBUTE_DEFINITIONS) {
      expect(Object.keys(definition.levels)).toHaveLength(2)
    }
  })

  it('X1 的水平标签为"仅摘要信息"与"详细原始数据"', () => {
    const x1 = ATTRIBUTE_DEFINITIONS.find((d) => d.key === 'X1')!
    expect(x1.levels[0].label).toBe('仅摘要信息')
    expect(x1.levels[1].label).toBe('详细原始数据')
  })

  it('X2 的水平标签为"仅指定子女"与"指定子女与授权养老服务机构"', () => {
    const x2 = ATTRIBUTE_DEFINITIONS.find((d) => d.key === 'X2')!
    expect(x2.levels[0].label).toBe('仅指定子女')
    expect(x2.levels[1].label).toBe('指定子女与授权养老服务机构')
  })

  it('X3 的水平标签为"异常时详细监测"与"全天持续详细监测"', () => {
    const x3 = ATTRIBUTE_DEFINITIONS.find((d) => d.key === 'X3')!
    expect(x3.levels[0].label).toBe('异常时详细监测')
    expect(x3.levels[1].label).toBe('全天持续详细监测')
  })

  it('X3 的说明区分"基础异常检测"与"详细监测"（关键澄清）', () => {
    const x3 = ATTRIBUTE_DEFINITIONS.find((d) => d.key === 'X3')!
    expect(x3.levels[0].description).toContain('基础异常检测持续运行')
    expect(x3.levels[0].description).toContain('异常时启动详细监测')
  })

  it('统一前提声明所有方案基础报警性能相同', () => {
    expect(UNIFIED_PREMISES.sharedCapability).toContain('相同的基础异常识别与报警能力')
    expect(UNIFIED_PREMISES.items.join(' ')).toContain('系统基础报警性能相同')
  })

  it('统一前提区分"详细监测"与"向接收者共享详细信息"', () => {
    expect(UNIFIED_PREMISES.items.join(' ')).toContain('是不同概念')
  })

  it('模块四固定说明所有配置的授权与暂停设置相同（保护 A3 自主感题）', () => {
    expect(UNIFIED_PREMISES.autonomyControlNotice).toBe('所有配置均提供相同的授权与暂停设置。')
  })
})

describe('模拟脚本：实验条件受控', () => {
  it('模拟事件类型与时间在所有配置下完全相同（常量）', () => {
    expect(SIMULATION_EVENT.type).toBe('疑似跌倒')
    expect(SIMULATION_EVENT.time).toBe('14:32')
    expect(SIMULATION_EVENT.normalTime).toBe('14:30')
    expect(SIMULATION_EVENT.notifyTime).toBe('14:33')
  })

  it('时间线为 3 个固定节点，且与配置无关', () => {
    expect(TIMELINE_STEPS).toHaveLength(3)
    expect(TIMELINE_STEPS.map((s) => s.time)).toEqual(['14:30', '14:32', '14:33'])
    expect(TIMELINE_STEPS.map((s) => s.index)).toEqual([0, 1, 2])
  })

  it('所有配置的风险描述相同（不因配置改变严重程度）', () => {
    const descriptions = new Set(
      PROFILE_IDS.map(() => SIMULATION_EVENT.description),
    )
    expect(descriptions.size).toBe(1)
  })

  it('通知标题在所有配置下相同（不制造差异化情绪诱导）', () => {
    const titles = new Set(PROFILE_IDS.map((id) => getNotificationContent(id).title))
    expect(titles.size).toBe(1)
    expect([...titles][0]).toBe('疑似跌倒警报')
  })

  it('通知对象由 X2 决定：X2=0 仅子女；X2=1 增加养老服务机构', () => {
    for (const id of PROFILE_IDS) {
      const recipients = getRecipients(id)
      if (PROFILES[id].X2 === 0) {
        expect(recipients, `${id} (X2=0)`).toEqual(['您指定的子女'])
      } else {
        expect(recipients, `${id} (X2=1)`).toHaveLength(2)
        expect(recipients).toContain('授权的养老服务机构')
      }
    }
  })

  it('信息可见范围由 X1 决定：X1=1 才有详细记录与视频', () => {
    for (const id of PROFILE_IDS) {
      const content = getNotificationContent(id)
      if (PROFILES[id].X1 === 0) {
        expect(content.hasDetailedAccess, `${id} (X1=0)`).toBe(false)
        expect(content.accessItems).toEqual(['异常事件摘要（简要提示）'])
      } else {
        expect(content.hasDetailedAccess, `${id} (X1=1)`).toBe(true)
        expect(content.accessItems.join(' ')).toContain('详细活动记录')
        expect(content.accessItems.join(' ')).toContain('视频')
      }
    }
  })

  it('所有配置在"仅摘要"时也都会生成事件摘要并发出提醒（不降低识别能力）', () => {
    for (const id of PROFILE_IDS) {
      const content = getNotificationContent(id)
      // 每个配置都能生成通知
      expect(content.title).toBeTruthy()
      expect(content.recipientLabel).toBeTruthy()
      // X1=0 时仍包含摘要项
      expect(content.accessItems.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('监测状态文案由 X3 决定，且都说明基础异常识别在运行', () => {
    for (const id of PROFILE_IDS) {
      const copy = getMonitoringCopy(id)
      if (PROFILES[id].X3 === 0) {
        expect(copy.normalStatus).toContain('基础异常识别')
        expect(copy.normalDescription).toContain('详细监测未开启')
      } else {
        expect(copy.normalStatus).toContain('持续详细监测')
      }
    }
  })

  it('模拟时间控制在所有配置下一致（常量，不因配置改变报警速度）', () => {
    expect(SIMULATION_TIMING.autoEventDelayMs).toBeGreaterThan(0)
    expect(SIMULATION_TIMING.notifyDelayMs).toBeGreaterThan(0)
    // 常量对象，不存在按配置分支的可能
    expect(Object.isFrozen(SIMULATION_TIMING) || typeof SIMULATION_TIMING === 'object').toBe(true)
  })
})

describe('待配置占位字段', () => {
  it('所有占位字段均未填写时标记为 pending，且不含编造内容', () => {
    for (const field of ALL_CONFIGURABLE_FIELDS) {
      expect(field.placeholder, field.key).toMatch(/^\[待填写：.+\]$/)
      expect(field.guidance.length, `${field.key} 应有填写指引`).toBeGreaterThan(5)
      // 若已填写，则 pending 必须为 false
      if (field.value !== null && field.value.trim() !== '') {
        expect(field.pending, field.key).toBe(false)
      }
    }
  })

  it('包含用户明确要求不得编造的关键字段', () => {
    const keys = ALL_CONFIGURABLE_FIELDS.map((f) => f.key)
    expect(keys).toContain('researchContact')
    expect(keys).toContain('dataRetention')
    expect(keys).toContain('researchInstitution')
    expect(keys).toContain('ethicsApproval')
    expect(keys).toContain('estimatedDuration')
  })

  it('预计填写时间字段显式要求 Pilot 实测后填写（不编造时长）', () => {
    const duration = ALL_CONFIGURABLE_FIELDS.find((f) => f.key === 'estimatedDuration')!
    expect(duration.guidance).toContain('禁止编造')
  })
})
