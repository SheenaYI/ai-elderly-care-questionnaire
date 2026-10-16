import { describe, expect, it } from 'vitest'
import {
  checkCompletion,
  comprehensionRecordIsConsistent,
  submissionSchema,
  validateSubmissionSemantics,
} from '@/lib/validation/schemas'
import { buildDraft, buildSubmission, attrs } from './helpers'
import { PROFILES } from '@/data/profiles'
import type { SurveySubmission } from '@/types'

/**
 * 问卷数据校验测试。
 *
 * 服务端与前端共用同一套规则（src/lib/validation/schemas.ts），
 * 因此这些测试同时覆盖了提交接口的校验逻辑。
 */

describe('提交载荷结构校验（zod）', () => {
  it('接受一份完整合法的提交', () => {
    const result = submissionSchema.safeParse(buildSubmission())
    expect(result.success, result.success ? '' : JSON.stringify(result.error?.issues, null, 2)).toBe(true)
  })

  it('要求问卷版本号与当前版本一致', () => {
    const result = submissionSchema.safeParse(buildSubmission({ questionnaireVersion: 'V0.9' }))
    expect(result.success).toBe(false)
  })

  it('要求 consent_status 为 agreed', () => {
    const bad = { ...buildSubmission(), consentStatus: 'declined' }
    expect(submissionSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝缺少 DCE 题目的提交（不足 6 题）', () => {
    const base = buildSubmission()
    const result = submissionSchema.safeParse({
      ...base,
      dceChoices: base.dceChoices.slice(0, 5),
    })
    expect(result.success).toBe(false)
  })

  it('拒绝题数超过 6 的 DCE 数据', () => {
    const base = buildSubmission()
    const result = submissionSchema.safeParse({
      ...base,
      dceChoices: [...base.dceChoices, base.dceChoices[0]!],
    })
    expect(result.success).toBe(false)
  })

  it('拒绝评价配置不足 4 个的提交', () => {
    const base = buildSubmission()
    const result = submissionSchema.safeParse({
      ...base,
      profileRatings: base.profileRatings.slice(0, 3),
    })
    expect(result.success).toBe(false)
  })

  it('拒绝量表取值超出 1–5 的评分', () => {
    const base = buildSubmission()
    const broken = {
      ...base,
      profileRatings: base.profileRatings.map((r, i) =>
        i === 0 ? { ...r, scores: { ...r.scores, S1: 6 } } : r,
      ),
    }
    expect(submissionSchema.safeParse(broken).success).toBe(false)
  })

  it('拒绝缺少量表题目的评分记录', () => {
    const base = buildSubmission()
    const first = base.profileRatings[0]!
    const { S3: _removed, ...partialScores } = first.scores
    const broken = {
      ...base,
      profileRatings: [{ ...first, scores: partialScores }, ...base.profileRatings.slice(1)],
    }
    expect(submissionSchema.safeParse(broken).success).toBe(false)
  })

  it('拒绝缺少理解检查题的提交', () => {
    const base = buildSubmission()
    expect(
      submissionSchema.safeParse({ ...base, comprehension: base.comprehension.slice(0, 1) }).success,
    ).toBe(false)
  })

  it('Q10 允许为空字符串', () => {
    const base = buildSubmission()
    const result = submissionSchema.safeParse({
      ...base,
      overall: { ...base.overall, q10: '' },
    })
    expect(result.success).toBe(true)
  })

  it('Q8 必须是 1–5 的整数', () => {
    const base = buildSubmission()
    expect(
      submissionSchema.safeParse({ ...base, overall: { ...base.overall, q8: 0 } }).success,
    ).toBe(false)
    expect(
      submissionSchema.safeParse({ ...base, overall: { ...base.overall, q8: 6 } }).success,
    ).toBe(false)
  })

  it('拒绝非法的身份枚举值', () => {
    const base = buildSubmission()
    const bad = {
      ...base,
      identity: { ...base.identity, ageGroup: '5-10' },
    }
    expect(submissionSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝非法的配置编码', () => {
    const base = buildSubmission()
    const broken = {
      ...base,
      dceChoices: base.dceChoices.map((c, i) =>
        i === 0 ? { ...c, selectedProfileId: 'C9' } : c,
      ),
    }
    expect(submissionSchema.safeParse(broken).success).toBe(false)
  })
})

describe('研究语义校验', () => {
  /** 先通过结构校验，再做语义校验。 */
  function semantics(input: SurveySubmission) {
    const parsed = submissionSchema.parse(input)
    return validateSubmissionSemantics(parsed)
  }

  it('合法的提交没有语义问题', () => {
    expect(semantics(buildSubmission())).toEqual([])
  })

  it('A 卷提交 B 卷的题目会被拒绝', () => {
    const base = buildSubmission({}, 'A')
    const bChoices = buildSubmission({}, 'B').dceChoices
    const problems = semantics({ ...base, dceChoices: bChoices })
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.map((p) => p.message).join(' ')).toMatch(/不属于|缺少/)
  })

  it('记录"选择了方案A"但 selected_profile_id 指向另一配置时会被拒绝', () => {
    const base = buildSubmission()
    const first = base.dceChoices[0]!
    // 声称选了左侧，但把 selected_profile_id 改成右侧的配置
    const tampered = {
      ...base,
      dceChoices: [
        { ...first, selectedSide: 'left' as const, selectedProfileId: first.rightProfileId },
        ...base.dceChoices.slice(1),
      ],
    }
    const problems = semantics(tampered)
    expect(problems.map((p) => p.message).join(' ')).toContain('不一致')
  })

  it('左右方案为同一配置时会被拒绝', () => {
    const base = buildSubmission()
    const first = base.dceChoices[0]!
    const tampered = {
      ...base,
      dceChoices: [
        {
          ...first,
          rightProfileId: first.leftProfileId,
          rightProfileAttributes: first.leftProfileAttributes,
        },
        ...base.dceChoices.slice(1),
      ],
    }
    const problems = semantics(tampered)
    expect(problems.map((p) => p.message).join(' ')).toMatch(/同一配置|左右/)
  })

  it('属性快照与配置编码不一致时会被拒绝', () => {
    const base = buildSubmission()
    const first = base.dceChoices[0]!
    // 篡改属性快照，使其与 left_profile_id 不符
    const tampered = {
      ...base,
      dceChoices: [
        {
          ...first,
          leftProfileAttributes: { X1: 1, X2: 1, X3: 1 } as const,
        },
        ...base.dceChoices.slice(1),
      ],
    }
    const problems = semantics(tampered)
    expect(problems.some((p) => p.message.includes('属性快照'))).toBe(true)
  })

  it('评分记录的属性与配置编码不一致时会被拒绝', () => {
    const base = buildSubmission()
    const tampered = {
      ...base,
      profileRatings: base.profileRatings.map((r, i) =>
        i === 0 ? { ...r, X1: ((r.X1 + 1) % 2) as 0 | 1 } : r,
      ),
    }
    const problems = semantics(tampered)
    expect(problems.some((p) => p.path.startsWith('profileRatings'))).toBe(true)
  })

  it('重复评价同一配置会被拒绝', () => {
    const base = buildSubmission()
    const tampered = {
      ...base,
      profileRatings: base.profileRatings.map((r, i) =>
        i === 3 ? { ...r, profileId: base.profileRatings[0]!.profileId } : r,
      ),
    }
    const problems = semantics(tampered)
    expect(problems.some((p) => p.message.includes('重复'))).toBe(true)
  })

  it('展示顺序不是 1–6 的排列时会被拒绝', () => {
    const base = buildSubmission()
    const tampered = {
      ...base,
      dceChoices: base.dceChoices.map((c, i) => ({ ...c, taskDisplayOrder: i === 0 ? 6 : c.taskDisplayOrder })),
    }
    const problems = semantics(tampered)
    expect(problems.some((p) => p.message.includes('展示顺序'))).toBe(true)
  })

  it('评价顺序不是 1–4 的排列时会被拒绝', () => {
    const base = buildSubmission()
    const tampered = {
      ...base,
      profileRatings: base.profileRatings.map((r, i) => ({ ...r, ratingOrder: i === 0 ? 4 : r.ratingOrder })),
    }
    const problems = semantics(tampered)
    expect(problems.some((p) => p.message.includes('评价顺序'))).toBe(true)
  })

  it('提交时间早于开始时间会被拒绝', () => {
    const base = buildSubmission()
    const problems = semantics({
      ...base,
      startedAt: new Date('2026-02-01T10:00:00.000Z').toISOString(),
      submittedAt: new Date('2026-01-01T10:00:00.000Z').toISOString(),
    })
    expect(problems.some((p) => p.path === 'submittedAt')).toBe(true)
  })

  it('伪造理解检查的 is_correct 会被拒绝', () => {
    const base = buildSubmission()
    const problems = semantics({
      ...base,
      comprehension: [
        // Q6 的正确答案是索引 0；这里声称索引 2 但标记为正确
        { questionId: 'Q6', firstAnswerIndex: 2, isCorrect: true, retryCount: 0 },
        base.comprehension[1]!,
      ],
    })
    expect(problems.some((p) => p.path.startsWith('comprehension'))).toBe(true)
  })
})

describe('理解检查一致性判定', () => {
  it('答对时 is_correct 应为 true', () => {
    // Q6 正确答案索引 0
    expect(comprehensionRecordIsConsistent({ questionId: 'Q6', firstAnswerIndex: 0, isCorrect: true })).toBe(true)
    expect(comprehensionRecordIsConsistent({ questionId: 'Q6', firstAnswerIndex: 0, isCorrect: false })).toBe(false)
    // Q7 正确答案索引 1
    expect(comprehensionRecordIsConsistent({ questionId: 'Q7', firstAnswerIndex: 1, isCorrect: true })).toBe(true)
    expect(comprehensionRecordIsConsistent({ questionId: 'Q7', firstAnswerIndex: 0, isCorrect: false })).toBe(true)
  })
})

describe('提交前完成度检查', () => {
  it('完整草稿判定为可提交', () => {
    const report = checkCompletion(buildDraft())
    expect(report.missing, report.missing.map((m) => `${m.section}: ${m.detail}`).join('; ')).toEqual([])
    expect(report.complete).toBe(true)
  })

  it('未同意时不可提交', () => {
    const report = checkCompletion(buildDraft({ consentStatus: 'pending' }))
    expect(report.consent).toBe(false)
    expect(report.complete).toBe(false)
    expect(report.missing.map((m) => m.section)).toContain('知情同意')
  })

  it('DCE 少于一题时不可提交，并报告进度', () => {
    const draft = buildDraft()
    const report = checkCompletion({ ...draft, dceChoices: draft.dceChoices.slice(0, 4) })
    expect(report.dce).toBe(false)
    const item = report.missing.find((m) => m.section.includes('DCE'))
    expect(item?.detail).toContain('4 / 6')
  })

  it('评价配置不足时不可提交，并报告进度', () => {
    const draft = buildDraft()
    const report = checkCompletion({ ...draft, profileRatings: draft.profileRatings.slice(0, 2) })
    expect(report.ratings).toBe(false)
    expect(report.missing.find((m) => m.section.includes('评价'))?.detail).toContain('2 / 4')
  })

  it('某个配置的 12 题不完整时，该配置不计为已完成', () => {
    const draft = buildDraft()
    const first = draft.profileRatings[0]!
    const { S1: _drop, ...partial } = first.scores
    const report = checkCompletion({
      ...draft,
      profileRatings: [{ ...first, scores: partial }, ...draft.profileRatings.slice(1)],
    })
    expect(report.ratings).toBe(false)
  })

  it('未填写 Q8 或 Q9 时不可提交（Q10 可跳过）', () => {
    const draft = buildDraft()
    expect(checkCompletion({ ...draft, overall: { q8: null, q9: 'other', q10: '' } }).overall).toBe(false)
    expect(checkCompletion({ ...draft, overall: { q8: 4, q9: null, q10: '' } }).overall).toBe(false)
    expect(checkCompletion({ ...draft, overall: { q8: 4, q9: 'other', q10: '' } }).overall).toBe(true)
  })

  it('身份选择"其他"但未填写说明时不可提交', () => {
    const draft = buildDraft()
    const report = checkCompletion({
      ...draft,
      identity: { ...draft.identity, respondentRole: 'other', respondentRoleOther: '' },
    })
    expect(report.identity).toBe(false)
  })

  it('身份选择"其他"并填写说明后可以提交', () => {
    const draft = buildDraft()
    const report = checkCompletion({
      ...draft,
      identity: { ...draft.identity, respondentRole: 'other', respondentRoleOther: '社区养老工作者' },
    })
    expect(report.identity).toBe(true)
  })
})

describe('属性快照正确性', () => {
  it('helpers 生成的属性快照与 C1–C8 定义一致', () => {
    for (const [id, profile] of Object.entries(PROFILES)) {
      expect(attrs(id as keyof typeof PROFILES)).toEqual({
        X1: profile.X1,
        X2: profile.X2,
        X3: profile.X3,
      })
    }
  })
})
