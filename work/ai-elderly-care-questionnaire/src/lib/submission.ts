/**
 * 问卷提交客户端。
 *
 * 流程：前端表单 → 安全提交接口 → 服务端校验 → Supabase 数据库
 *
 * 设计要点：
 *   1. 前端**不直接**写数据库。提交统一走 /api/submit-survey，
 *      由服务端做权威校验、版本检查、重复提交检查。
 *   2. 未配置后端时进入 **Demo 模式**，并明确告知用户数据未保存到云端。
 *      绝不在 Demo 模式下显示"已成功提交到服务器"。
 *   3. 提交失败时保留本地草稿，提示用户重试。
 */

import type { QuestionnaireDraft, SubmissionResult, SurveySubmission } from '@/types'
import { config, detectDataMode } from '@/lib/config'
import { submissionSchema, validateSubmissionSemantics } from '@/lib/validation/schemas'

/** 由本地草稿组装提交载荷。调用方需先确认问卷已完成。 */
export function buildSubmission(draft: QuestionnaireDraft): SurveySubmission | null {
  if (draft.consentStatus !== 'agreed') return null
  if (!draft.assignedBlock) return null

  const submittedAt = new Date().toISOString()
  const startedMs = Date.parse(draft.startedAt)
  const totalDurationMs = Number.isFinite(startedMs)
    ? Math.max(0, Date.parse(submittedAt) - startedMs)
    : 0

  return {
    questionnaireVersion: draft.questionnaireVersion,
    participantId: draft.participantId,
    assignedBlock: draft.assignedBlock,
    consentStatus: 'agreed',
    consentTimestamp: draft.consentTimestamp ?? submittedAt,
    identity: {
      ...draft.identity,
      // 非"其他"身份时不保留自由填写内容
      respondentRoleOther:
        draft.identity.respondentRole === 'other' ? draft.identity.respondentRoleOther : '',
    },
    comprehension: draft.comprehension.map((c) => ({ ...c })),
    dceChoices: draft.dceChoices.map((c) => ({ ...c })),
    profileRatings: draft.profileRatings.map((r) => ({
      profileId: r.profileId,
      X1: r.X1,
      X2: r.X2,
      X3: r.X3,
      ratingOrder: r.ratingOrder,
      scores: { ...r.scores },
    })),
    overall: {
      q8: draft.overall.q8!,
      q9: draft.overall.q9!,
      q10: draft.overall.q10 ?? '',
    },
    priorExperience: draft.priorExperience,
    simulationEvents: draft.simulationEvents.map((e) => ({ ...e })),
    startedAt: draft.startedAt,
    submittedAt,
    totalDurationMs,
  }
}

export interface SubmitOutcome extends SubmissionResult {
  /** 服务端返回的字段级问题（用于定位未完成项）。 */
  problems?: { path: string; message: string }[]
}

/**
 * 提交问卷。
 *
 * Demo 模式：不发送网络请求，返回 `mode: 'demo'` 并明确说明**数据未写入云端**。
 */
export async function submitSurvey(draft: QuestionnaireDraft): Promise<SubmitOutcome> {
  const payload = buildSubmission(draft)
  if (!payload) {
    return {
      ok: false,
      mode: detectDataMode(),
      message: '问卷尚未满足提交条件（需已完成知情同意并分配卷别）。',
    }
  }

  // 提交前先在客户端做一次自检，尽早发现缺漏（服务端仍会独立复核）
  const parsed = submissionSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      mode: detectDataMode(),
      message: '问卷数据未通过完整性校验，未提交。',
      fieldErrors: flattenZodIssues(parsed.error.issues),
    }
  }
  const semantic = validateSubmissionSemantics(parsed.data)
  if (semantic.length > 0) {
    return {
      ok: false,
      mode: detectDataMode(),
      message: '问卷数据未通过一致性校验，未提交。',
      problems: semantic,
    }
  }

  // ── Demo 模式：明确不落库 ────────────────────────────────────
  if (detectDataMode() === 'demo') {
    if (!config.allowDemoMode) {
      return {
        ok: false,
        mode: 'demo',
        message:
          '当前未配置数据提交后端，且本环境不允许 Demo 模式提交。请联系研究团队完成 Supabase 配置后再试。',
      }
    }
    return {
      ok: true,
      mode: 'demo',
      message:
        'Demo 模式：本次填写已完成校验，但数据**仅保留在您本人的浏览器中，未上传到云端数据库**。该结果仅用于内部试填与演示，不能作为正式研究数据。',
    }
  }

  // ── 真实提交：经由服务端接口 ─────────────────────────────────
  try {
    const response = await fetch(config.submitEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }

    if (!response.ok) {
      const serverMessage =
        body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : `服务器返回错误（HTTP ${response.status}）。`
      const problems =
        body && typeof body === 'object' && 'problems' in body && Array.isArray(body.problems)
          ? (body.problems as { path: string; message: string }[])
          : undefined
      return { ok: false, mode: 'supabase', message: serverMessage, problems }
    }

    if (!body || typeof body !== 'object' || !('ok' in body)) {
      return {
        ok: false,
        mode: 'supabase',
        message: '服务器返回了无法识别的响应，无法确认是否提交成功。请稍后重试。',
      }
    }

    const result = body as SubmissionResult & { problems?: { path: string; message: string }[] }
    return {
      ok: result.ok === true,
      mode: result.mode ?? 'supabase',
      message: result.message ?? (result.ok ? '提交成功。' : '提交失败。'),
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      ...(result.problems ? { problems: result.problems } : {}),
    }
  } catch {
    // 网络错误：保留本地草稿，让用户重试
    return {
      ok: false,
      mode: 'supabase',
      message: '网络连接失败，未能提交。您的填写内容已保存在本机，请检查网络后重试。',
    }
  }
}

function flattenZodIssues(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || '_'
    if (!out[key]) out[key] = issue.message
  }
  return out
}
