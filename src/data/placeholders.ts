/**
 * 待研究团队填写的占位字段。
 *
 * ⚠️ 严禁编造以下任何信息：
 *    学校 / 研究单位、伦理审批编号、研究负责人、研究联系人、联系方式、
 *    数据保存期限、可访问数据的人员范围、退出与数据删除申请方式、
 *    预计填写时间。
 *
 * 正式上线前，研究团队必须替换本文件中所有 `pending: true` 的字段。
 * 未替换时，界面会以醒目的"待填写"样式显示，且本站不应作为正式发放渠道。
 *
 * 配置方式：直接修改本文件的 `value` 字段，或通过环境变量注入后在此读取。
 * 详见 docs/SETUP.md。
 */

export interface ConfigurableField {
  /** 字段标识，用于在界面与数据字典中定位。 */
  key: string
  /** 显示名称。 */
  label: string
  /** 实际内容。未填写时为 null。 */
  value: string | null
  /** 界面未填写时展示的占位文字。 */
  placeholder: string
  /** 是否仍在等待研究团队填写。 */
  pending: boolean
  /** 该字段的填写指引。 */
  guidance: string
}

function field(
  key: string,
  label: string,
  placeholder: string,
  guidance: string,
  value: string | null = null,
): ConfigurableField {
  return { key, label, value, placeholder, pending: value === null || value.trim() === '', guidance }
}

export const RESEARCH_CONTACT = field(
  'researchContact',
  '研究联系人',
  '[待填写：研究联系人]',
  '填写研究联系人姓名或研究团队联系邮箱。建议同时提供可长期接收退出申请的邮箱。',
)

export const RESEARCH_CONTACT_EMAIL = field(
  'researchContactEmail',
  '联系人邮箱',
  '[待填写：联系人邮箱]',
  '填写研究团队可公开的联系邮箱，用于参与者咨询、退出与数据删除申请。',
)

export const RESEARCH_INSTITUTION = field(
  'researchInstitution',
  '所属学校或研究单位',
  '[待填写：所属学校或研究单位]',
  '填写承担本研究的学校或研究单位全称。',
)

export const RESEARCH_LEAD = field(
  'researchLead',
  '研究负责人',
  '[待填写：研究负责人]',
  '填写研究负责人姓名与身份（如指导教师 / 项目负责人）。需经本人同意后公开。',
)

export const ETHICS_APPROVAL = field(
  'ethicsApproval',
  '伦理审批编号',
  '[待填写：伦理审批编号]',
  '填写所在单位伦理审查委员会的审批编号。若本单位无需编号，请填写"本单位伦理审查意见：无需编号"及审查日期。',
)

export const DATA_RETENTION = field(
  'dataRetention',
  '数据保存期限',
  '[待填写：数据保存期限]',
  '填写研究数据的保存起止期限（例如：自收集之日起 3 年，到期后销毁）。',
)

export const DATA_ACCESS_SCOPE = field(
  'dataAccessScope',
  '可访问数据的人员范围',
  '[待填写：可访问数据的人员范围]',
  '填写有权访问原始数据的成员范围（例如：仅本项目 3 名经培训的研究成员）。',
)

export const WITHDRAWAL_PROCEDURE = field(
  'withdrawalProcedure',
  '退出与数据删除申请方式',
  '[待填写：退出与数据删除申请方式]',
  '填写参与者退出研究及申请删除已提交数据的具体方式与时限。',
)

export const ESTIMATED_DURATION = field(
  'estimatedDuration',
  '预计填写时间',
  '[待填写：预计填写时间]',
  '必须由研究团队在完成内部试填（Pilot）后，依据实测时长中位数填写。禁止编造。',
)

/** 全部待配置字段，用于管理后台的"上线前检查"面板。 */
export const ALL_CONFIGURABLE_FIELDS: readonly ConfigurableField[] = [
  RESEARCH_INSTITUTION,
  RESEARCH_LEAD,
  RESEARCH_CONTACT,
  RESEARCH_CONTACT_EMAIL,
  ETHICS_APPROVAL,
  ESTIMATED_DURATION,
  DATA_RETENTION,
  DATA_ACCESS_SCOPE,
  WITHDRAWAL_PROCEDURE,
] as const

/** 尚未填写的字段。 */
export function pendingFields(): ConfigurableField[] {
  return ALL_CONFIGURABLE_FIELDS.filter((f) => f.pending)
}

/** 是否所有上线前必填项都已配置完成。 */
export function isLaunchReady(): boolean {
  return pendingFields().length === 0
}
