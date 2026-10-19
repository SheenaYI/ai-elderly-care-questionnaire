import type {
  AgeGroup,
  AiDeviceExperience,
  CaregivingExperience,
  ComprehensionQuestionId,
  LikertValue,
  MainConcern,
  RespondentRole,
} from '@/types'

/**
 * 问卷文本内容（模块一、二、五）。
 *
 * 转录自 V1.0《智能养老AI监测_问卷初稿与DCE实验设计_V1》第 5–13、25–29、226–229 段。
 * 题目问法、选项与正确答案均按原文，未作改写。
 *
 * ⚠️ 本文件是问卷内容的唯一来源。页面组件不得硬编码题目文本。
 */

/**
 * 当前问卷版本号。**修改任何研究内容时必须同步升级此版本号。**
 *
 * 版本历史：
 *   V1.0  与《…问卷初稿与DCE实验设计_V1》一致（模块一至五）
 *   V1.1  新增模块六「理想配置自由设定」（V1.0 之外的设计变更，见
 *         docs/RESEARCH_NOTES.md E 节）。其余内容与 V1.0 完全相同。
 */
export const QUESTIONNAIRE_VERSION = 'V1.1'

// ─────────────────────────────────────────────────────────────
// 模块一｜知情同意与身份信息
// ─────────────────────────────────────────────────────────────

export const STUDY_TITLE = '智能养老AI监测系统配置偏好与采纳意愿调查'
export const STUDY_CODE = 'AI Elderly Care Questionnaire'

/**
 * 问卷开头说明。转录自 V1.0 模块一【问卷开头说明】。
 */
export const OPENING_STATEMENT =
  '您好！本研究希望了解人们对AI养老监测系统不同信息共享与监测配置的偏好，以及对安全、隐私和老人自主性的感受。问卷仅用于学术研究；参与自愿，可随时停止。不会要求提供真实监控视频、姓名或身份证号。'

/** 说明：研究团队未填写的部分不在参与者文案中编造。 */
export const OPENING_STATEMENT_NOTE =
  '研究团队应在正式发放前补充实际的数据保存期限、访问权限、联系人与退出/删除规则。'

/** 身份作答提示。转录自 V1.0 模块一【身份提示】。 */
export const ROLE_INSTRUCTION = {
  older_adult: '老年人本人请按"自己使用"作答。',
  caregiver: '家庭照护者请按"为家中老人配置"作答。',
  analysis: '分析时分组报告，不把照护者的偏好等同于老人本人的偏好。',
} as const

/** Q1 知情同意。 */
export const Q1_CONSENT = {
  id: 'Q1',
  text: '您是否已阅读说明并自愿参与本研究？',
  options: [
    { value: 'agree', label: '同意并继续' },
    { value: 'decline', label: '不同意（结束）' },
  ],
} as const

/** Q2 年龄范围。 */
export const Q2_AGE_GROUPS: readonly { value: AgeGroup; label: string }[] = [
  { value: '18-29', label: '18–29岁' },
  { value: '30-44', label: '30–44岁' },
  { value: '45-59', label: '45–59岁' },
  { value: '60-69', label: '60–69岁' },
  { value: '70+', label: '70岁及以上' },
] as const

export const Q2_QUESTION = '您的年龄范围'

/** Q3 主要答题身份。 */
export const Q3_ROLES: readonly { value: RespondentRole; label: string }[] = [
  { value: 'older_adult', label: '老年人本人' },
  { value: 'current_caregiver', label: '当前家庭照护者' },
  { value: 'prospective_caregiver', label: '潜在家庭照护者' },
  { value: 'other', label: '其他（请注明）' },
] as const

export const Q3_QUESTION = '您的主要答题身份'

/** Q4 是否了解 AI 养老监测设备。 */
export const Q4_AI_EXPERIENCE: readonly { value: AiDeviceExperience; label: string }[] = [
  { value: 'used', label: '使用过' },
  { value: 'aware_not_used', label: '了解但未使用' },
  { value: 'unaware', label: '不了解' },
] as const

export const Q4_QUESTION = '您是否了解AI养老监测设备？'

/** Q5 是否有照护老人的经历。 */
export const Q5_CAREGIVING: readonly { value: CaregivingExperience; label: string }[] = [
  { value: 'often', label: '经常' },
  { value: 'sometimes', label: '偶尔' },
  { value: 'never', label: '没有' },
] as const

export const Q5_QUESTION = '您是否有照护老人的经历？'

// ─────────────────────────────────────────────────────────────
// 模块二｜统一情景与理解检查（Q6、Q7）
// ─────────────────────────────────────────────────────────────

export const SCENARIO_STATEMENT =
  '请设想一位老人独自在家生活，家中计划安装AI养老监测系统。所有方案都具有相同的基础异常识别与报警能力，能够识别疑似跌倒、异常静止等风险，并向授权人员发出基本提醒。不同方案仅在下列三方面不同。请比较长期使用这些配置的感受，而不是假设已经发生了跌倒事件。'

export interface ComprehensionOption {
  label: string
  /** 是否为 V1.0 标注的正确答案。 */
  correct: boolean
}

export interface ComprehensionQuestion {
  id: ComprehensionQuestionId
  text: string
  options: readonly ComprehensionOption[]
  /** 答错后展示的正确解释。 */
  explanation: string
}

/**
 * 两道理解检查题。正确答案与解释均按 V1.0 原文。
 * 答错时展示解释并允许重新阅读后继续；后台记录首次作答结果。
 */
export const COMPREHENSION_QUESTIONS: readonly ComprehensionQuestion[] = [
  {
    id: 'Q6',
    text: '理解检查：“仅摘要信息”是指？',
    options: [
      { label: '仅可查看简要提示', correct: true },
      { label: '可查看完整视频', correct: false },
      { label: '系统不能识别异常', correct: false },
    ],
    explanation:
      '正确答案是"仅可查看简要提示"。“仅摘要信息”只限制"接收者能看到什么"，并不会降低系统识别异常的能力——所有方案的基础异常识别与报警能力都相同。接收者仍会收到"疑似跌倒""长时间未活动"等简要提醒。',
  },
  {
    id: 'Q7',
    text: '理解检查：“异常触发详细监测”是指？',
    options: [
      { label: '平时完全不检测', correct: false },
      { label: '基础检测持续，异常时启动详细记录', correct: true },
      { label: '全天持续详细记录', correct: false },
    ],
    explanation:
      '正确答案是"基础检测持续，异常时启动详细记录"。在这一配置下，系统平时仍持续进行**基础异常识别**；只有检测到疑似异常事件时，才启动**详细监测与事件记录**。它并不等于"平时完全不检测"。',
  },
] as const

export const COMPREHENSION_QUESTION_BY_ID: Record<ComprehensionQuestionId, ComprehensionQuestion> =
  COMPREHENSION_QUESTIONS.reduce(
    (acc, q) => {
      acc[q.id] = q
      return acc
    },
    {} as Record<ComprehensionQuestionId, ComprehensionQuestion>,
  )

/** 理解检查在 12 题问卷中的数量。 */
export const COMPREHENSION_QUESTION_COUNT = COMPREHENSION_QUESTIONS.length

/** 判断某题某选项是否为正确答案。 */
export function isCorrectComprehensionAnswer(
  questionId: ComprehensionQuestionId,
  optionIndex: number,
): boolean {
  return COMPREHENSION_QUESTION_BY_ID[questionId].options[optionIndex]?.correct === true
}

/** 取正确答案的选项索引。 */
export function correctOptionIndex(questionId: ComprehensionQuestionId): number {
  return COMPREHENSION_QUESTION_BY_ID[questionId].options.findIndex((o) => o.correct)
}

// ─────────────────────────────────────────────────────────────
// 模块五｜总体评价（Q8–Q10）
// ─────────────────────────────────────────────────────────────

export const Q8_QUESTION = '总体而言，我愿意在养老照护中使用AI监测系统。'
export const Q8_SCALE_PROMPT = '1=非常不同意，5=非常同意'

export const Q9_QUESTION = '选择AI养老监测系统时，您最担心什么？'

export const Q9_CONCERNS: readonly { value: MainConcern; label: string }[] = [
  { value: 'insufficient_detection', label: '安全风险识别不足' },
  { value: 'privacy_exposure', label: '个人隐私暴露' },
  { value: 'limited_autonomy', label: '老人自主性受限' },
  { value: 'complex_operation', label: '操作复杂' },
  { value: 'other', label: '其他' },
] as const

export const Q10_QUESTION =
  '您认为理想的AI养老监测系统应如何平衡安全、隐私和自主性？'

export const Q10_NOTE = '开放填写，可跳过。'

// ─────────────────────────────────────────────────────────────
// 模块六｜理想配置自由设定（在 V1.0 之外新增，需研究团队确认）
// ─────────────────────────────────────────────────────────────

/**
 * ⚠️ 本部分是**在 V1.0 问卷之外新增的**，不属于原始设计。
 *    已记录在 docs/RESEARCH_NOTES.md（E 节），便于研究团队在伦理申请与
 *    分析计划中交代。改动任何一处文案需同步升级 QUESTIONNAIRE_VERSION。
 */
export const CUSTOM_CONFIG_TITLE = '您的理想配置'

export const CUSTOM_CONFIG_INTRO =
  '假设您可以自己设定一套 AI 养老监测系统，您会怎么选？请分别调整下面三个开关，直到它变成您最愿意长期使用的样子。'

export const CUSTOM_CONFIG_NOTE =
  '三个开关彼此独立，共可组成 8 种配置。所有配置的基础异常识别与报警能力完全相同，差别只在于下面三点。这里没有标准答案。'

/** 三个开关的展示文案（与 DCE 属性一一对应）。 */
export const CUSTOM_CONFIG_TOGGLES = [
  {
    key: 'X1' as const,
    title: '能看到什么',
    researchTitle: 'X1 共享层级',
    offLabel: '仅摘要信息',
    onLabel: '详细原始数据',
    offHint: '接收者只看到"疑似跌倒"等简要提示',
    onHint: '接收者还能看到活动记录与视频',
  },
  {
    key: 'X2' as const,
    title: '谁能查看',
    researchTitle: 'X2 共享对象',
    offLabel: '仅指定子女',
    onLabel: '子女 + 养老服务机构',
    offHint: '只有您指定的子女可以查看',
    onHint: '指定子女与授权养老服务机构都能查看',
  },
  {
    key: 'X3' as const,
    title: '平时如何监测',
    researchTitle: 'X3 详细监测方式',
    offLabel: '异常时详细监测',
    onLabel: '全天持续详细监测',
    offHint: '基础检测持续运行，异常时才启动详细记录',
    onHint: '全天持续进行详细活动监测与记录',
  },
] as const

/** 提交前的确认提示。 */
export const CUSTOM_CONFIG_CONFIRM_HINT =
  '请确认这就是您最愿意长期使用的配置。确认后进入提交前检查。'

/** 选择部分是否已完成（三个水平都已明确）。 */
export function isCustomConfigComplete(
  config: { X1?: number | null; X2?: number | null; X3?: number | null } | null | undefined,
): boolean {
  if (!config) return false
  return (
    (config.X1 === 0 || config.X1 === 1) &&
    (config.X2 === 0 || config.X2 === 1) &&
    (config.X3 === 0 || config.X3 === 1)
  )
}

/** Q8 使用的 5 点量表（原文为 1–5）。 */
export const Q8_LIKERT_OPTIONS: readonly { value: LikertValue; label: string }[] = [
  { value: 1, label: '1 非常不同意' },
  { value: 2, label: '2 不同意' },
  { value: 3, label: '3 一般' },
  { value: 4, label: '4 同意' },
  { value: 5, label: '5 非常同意' },
] as const
