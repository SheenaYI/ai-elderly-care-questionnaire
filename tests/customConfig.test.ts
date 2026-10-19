import { describe, expect, it, beforeEach } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import IdealConfigStep from '@/features/questionnaire/IdealConfigStep'
import { useQuestionnaire } from '@/app/store'
import {
  submissionSchema,
  validateSubmissionSemantics,
  checkCompletion,
} from '@/lib/validation/schemas'
import { buildSubmission, buildDraft } from './helpers'
import { PROFILES, PROFILE_IDS } from '@/data/profiles'
import { profileIdForAttributes } from '@/data/dceTasks'
import { CUSTOM_CONFIG_TOGGLES, isCustomConfigComplete } from '@/data/questionnaire'

/**
 * 模块六「理想配置自由设定」测试。
 *
 * 该模块是 V1.0 之外新增的，因此需要独立锁定：
 *   1. 三个开关的组合与 C1–C8 一一对应（反查函数正确）；
 *   2. 必填校验：缺失或非法时提交被拒、完成度检查报缺；
 *   3. 防篡改：matchedProfileId 必须与三个水平一致；
 *   4. 读取/保存：切换开关会写入草稿，刷新后能恢复；
 *   5. 页面可渲染，开关具备无障碍语义（role=switch / aria-checked）。
 */

beforeEach(() => {
  window.localStorage.clear()
  // store 是模块级单例，跨用例共享；这里显式重置。
  // 用 act() 包裹以符合 React 18 对状态更新的要求（否则会打印告警）。
  act(() => {
    useQuestionnaire.setState((state) => ({
      draft: { ...state.draft, customConfig: null },
    }))
  })
})

describe('配置编码反查（profileIdForAttributes）', () => {
  it('8 种组合与 C1–C8 一一对应且互不重复', () => {
    const seen = new Set<string>()
    for (const x1 of [0, 1]) {
      for (const x2 of [0, 1]) {
        for (const x3 of [0, 1]) {
          const id = profileIdForAttributes(x1, x2, x3)
          expect(id, `(${x1},${x2},${x3}) 应有对应配置`).not.toBeNull()
          expect(seen.has(id!), `配置 ${id} 被重复映射`).toBe(false)
          seen.add(id!)
        }
      }
    }
    expect(seen.size).toBe(8)
    expect([...seen].sort()).toEqual([...PROFILE_IDS].sort())
  })

  it('反查结果与 PROFILES 定义一致（交叉验证）', () => {
    for (const id of PROFILE_IDS) {
      const p = PROFILES[id]
      expect(profileIdForAttributes(p.X1, p.X2, p.X3)).toBe(id)
    }
  })

  it('非法水平返回 null', () => {
    expect(profileIdForAttributes(2, 0, 0)).toBeNull()
    expect(profileIdForAttributes(0, -1, 0)).toBeNull()
    expect(profileIdForAttributes(0.5, 0, 0)).toBeNull()
  })
})

describe('完成度判定', () => {
  it('三个水平齐全才算完成', () => {
    expect(isCustomConfigComplete({ X1: 0, X2: 0, X3: 0 })).toBe(true)
    expect(isCustomConfigComplete({ X1: 1, X2: 1, X3: 1 })).toBe(true)
    expect(isCustomConfigComplete({ X1: 0, X2: 1, X3: null })).toBe(false)
    expect(isCustomConfigComplete({ X1: 0, X2: undefined, X3: 0 })).toBe(false)
    expect(isCustomConfigComplete(null)).toBe(false)
    expect(isCustomConfigComplete(undefined)).toBe(false)
  })
})

describe('提交校验', () => {
  it('完整载荷通过结构校验与语义校验', () => {
    const parsed = submissionSchema.safeParse(buildSubmission())
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(validateSubmissionSemantics(parsed.data)).toEqual([])
    }
  })

  it('缺失 customConfig 时结构校验失败', () => {
    const base = buildSubmission() as unknown as Record<string, unknown>
    const { customConfig: _drop, ...without } = base
    expect(submissionSchema.safeParse(without).success).toBe(false)
  })

  it('三个水平超出 0/1 时失败', () => {
    const base = buildSubmission()
    const bad = { ...base, customConfig: { ...base.customConfig, X1: 2 } }
    expect(submissionSchema.safeParse(bad).success).toBe(false)
  })

  it('matchedProfileId 与三个水平不一致时，语义校验报错（防篡改）', () => {
    const base = buildSubmission()
    // 三个水平对应 C1，但声称是 C8
    const tampered = {
      ...base,
      customConfig: { ...base.customConfig, X1: 0, X2: 0, X3: 0, matchedProfileId: 'C8' },
    }
    const parsed = submissionSchema.safeParse(tampered)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const problems = validateSubmissionSemantics(parsed.data)
      expect(problems.some((p) => p.path === 'customConfig.matchedProfileId')).toBe(true)
    }
  })

  it('matchedProfileId 为 null 但三个水平能匹配到配置时，语义校验报错', () => {
    const base = buildSubmission()
    const tampered = {
      ...base,
      customConfig: { ...base.customConfig, matchedProfileId: null },
    }
    const parsed = submissionSchema.safeParse(tampered)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(
        validateSubmissionSemantics(parsed.data).some(
          (p) => p.path === 'customConfig.matchedProfileId',
        ),
      ).toBe(true)
    }
  })

  it('提交前检查：缺失 ideal 配置时不可提交，并提示对应部分', () => {
    const draft = buildDraft({ customConfig: null })
    const report = checkCompletion(draft)
    expect(report.customConfig).toBe(false)
    expect(report.complete).toBe(false)
    expect(report.missing.map((m) => m.section)).toContain('理想配置')
  })

  it('提交前检查：填写齐全后该项通过', () => {
    const report = checkCompletion(buildDraft())
    expect(report.customConfig).toBe(true)
    expect(report.complete).toBe(true)
  })
})

describe('页面渲染与交互', () => {
  async function renderStep() {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(IdealConfigStep, { onContinue: () => {} })))
    })
    await act(async () => {
      await Promise.resolve()
    })
    return container
  }

  it('渲染三个开关，且都具备无障碍语义', async () => {
    const container = await renderStep()
    const switches = container.querySelectorAll('[role="switch"]')
    expect(switches.length).toBe(3)
    for (const el of switches) {
      expect(el.getAttribute('aria-checked')).toMatch(/^(true|false)$/)
      expect(el.getAttribute('aria-label')).toBeTruthy()
    }
  })

  it('三个开关的标题与属性配置一致', async () => {
    const container = await renderStep()
    const text = container.textContent ?? ''
    for (const toggle of CUSTOM_CONFIG_TOGGLES) {
      expect(text).toContain(toggle.title)
      expect(text).toContain(toggle.offLabel)
    }
  })

  it('默认全关时显示 C1，并给出对应属性文字', async () => {
    const container = await renderStep()
    const text = container.textContent ?? ''
    // 默认 (0,0,0) → C1
    expect(text).toContain('C1')
    expect(text).toContain('仅摘要信息')
  })

  it('点击开关会写入草稿，且记录的编码随组合变化', async () => {
    const container = await renderStep()
    const switches = [...container.querySelectorAll('[role="switch"]')]

    // 依次打开第二个（X2）与第三个（X3）→ (0,1,1) = C3
    await act(async () => {
      ;(switches[1] as HTMLElement).click()
    })
    await act(async () => {
      ;(switches[2] as HTMLElement).click()
    })

    const saved = useQuestionnaire.getState().draft.customConfig
    expect(saved).not.toBeNull()
    expect(saved!.X1).toBe(0)
    expect(saved!.X2).toBe(1)
    expect(saved!.X3).toBe(1)
    expect(saved!.matchedProfileId).toBe('C3')
    // 必须记录耗时
    expect(saved!.responseDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('再次点击可把开关关回去', async () => {
    const container = await renderStep()
    const switches = [...container.querySelectorAll('[role="switch"]')]
    await act(async () => {
      ;(switches[0] as HTMLElement).click()
    })
    expect(useQuestionnaire.getState().draft.customConfig?.X1).toBe(1)
    await act(async () => {
      ;(switches[0] as HTMLElement).click()
    })
    expect(useQuestionnaire.getState().draft.customConfig?.X1).toBe(0)
  })

  it('进入即落一次草稿（即使不改动开关也有记录）', async () => {
    await renderStep()
    const saved = useQuestionnaire.getState().draft.customConfig
    expect(saved).not.toBeNull()
    expect(saved!.matchedProfileId).toBe('C1')
  })
})

describe('提交载荷携带自选配置', () => {
  it('buildSubmission 输出 customConfig，且与草稿一致', async () => {
    const { buildSubmission: buildFromDraft } = await import('@/lib/submission')
    const draft = buildDraft({
      customConfig: { X1: 1, X2: 0, X3: 1, matchedProfileId: 'C5', responseDurationMs: 3200 },
    })
    const payload = buildFromDraft(draft)
    expect(payload).not.toBeNull()
    expect(payload!.customConfig).toEqual({
      X1: 1,
      X2: 0,
      X3: 1,
      matchedProfileId: 'C5',
      responseDurationMs: 3200,
    })
  })

  it('草稿缺少自选配置时不构造载荷（避免上传不完整问卷）', async () => {
    const { buildSubmission: buildFromDraft } = await import('@/lib/submission')
    expect(buildFromDraft(buildDraft({ customConfig: null }))).toBeNull()
  })
})
