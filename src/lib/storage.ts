/**
 * 本地草稿持久化。
 *
 * 要求：
 *   - 草稿用于支持"中途退出后恢复进度"与"提交失败后保留填写状态"。
 *   - 草稿**不得**被误认为已提交。因此 `saveDraft` 始终写入
 *     `savedAt` 且不写任何"已提交"标记；已提交状态单独存放。
 *   - 正式提交成功后调用 `clearDraft()` 清理本地答题数据。
 *   - 不向浏览器控制台打印任何研究数据。
 */

import type { QuestionnaireDraft } from '@/types'

const DRAFT_KEY = 'aiecq:draft:v1'
const SUBMITTED_KEY = 'aiecq:submitted:v1'
const PRIOR_EXPERIENCE_KEY = 'aiecq:prior-experience:v1'

interface StoredDraft {
  savedAt: string
  draft: QuestionnaireDraft
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** 读取草稿。损坏或版本不符时返回 null 并清理，避免阻塞参与者。 */
export function loadDraft(): StoredDraft | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.draft) {
      window.localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return parsed
  } catch {
    // 解析失败：清理损坏数据，不打印内容
    try {
      window.localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* 忽略 */
    }
    return null
  }
}

/** 写入草稿。返回是否成功。 */
export function saveDraft(draft: QuestionnaireDraft): boolean {
  if (!isBrowser()) return false
  try {
    const payload: StoredDraft = { savedAt: new Date().toISOString(), draft }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
    return true
  } catch {
    // 可能超出配额或被隐私模式禁用
    return false
  }
}

/** 清理草稿（正式提交成功后调用）。 */
export function clearDraft(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 记录本参与者已成功提交的 participant_id，用于防止重复提交。 */
export function markSubmitted(participantId: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(
      SUBMITTED_KEY,
      JSON.stringify({ participantId, submittedAt: new Date().toISOString() }),
    )
  } catch {
    /* 忽略 */
  }
}

/** 读取本浏览器是否已成功提交过（本地防重复提交的第一道防线）。 */
export function readSubmitted(): { participantId: string; submittedAt: string } | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(SUBMITTED_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { participantId: string; submittedAt: string }
  } catch {
    return null
  }
}

/**
 * 记录"参与者是否在正式问卷前使用过独立情景体验页面"。
 * 该标记只用于 Pilot 检查与后续分析，**不会**写入 DCE 选择数据。
 */
export function markPriorExperience(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(PRIOR_EXPERIENCE_KEY, '1')
  } catch {
    /* 忽略 */
  }
}

export function readPriorExperience(): boolean {
  if (!isBrowser()) return false
  try {
    return window.localStorage.getItem(PRIOR_EXPERIENCE_KEY) === '1'
  } catch {
    return false
  }
}

/** 生成匿名参与者标识。不含任何个人身份信息。 */
export function createParticipantId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 退化实现：仅用于不支持 randomUUID 的环境
  return 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
