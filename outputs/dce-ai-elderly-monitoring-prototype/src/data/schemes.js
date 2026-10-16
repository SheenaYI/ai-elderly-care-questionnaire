export const ATTRIBUTE_DEFINITIONS = [
  {
    key: 'sharingLevel',
    title: '能看到什么',
    shortTitle: '共享层级',
  },
  {
    key: 'recipients',
    title: '谁能查看',
    shortTitle: '共享对象',
  },
  {
    key: 'monitoringMode',
    title: '平时怎么监测',
    shortTitle: '监测方式',
  },
]

export const ATTRIBUTE_VALUES = {
  sharingLevel: {
    detailed: {
      label: '详细原始数据',
      description: '授权接收者可以查看较详细的日常活动记录及相关视频片段。',
    },
    summary: {
      label: '仅摘要信息',
      description:
        '接收者只能查看简要异常提醒，例如“疑似跌倒”“长时间未活动”，不提供详细活动记录或视频。',
    },
  },
  recipients: {
    children_and_care_staff: {
      label: '您指定的子女及您授权的养老服务人员',
      description: '指定子女与授权养老服务人员均可以查看允许共享的信息。',
    },
    children: {
      label: '仅您指定的子女',
      description: '监测信息仅向指定子女开放。',
    },
  },
  monitoringMode: {
    event_triggered: {
      label: '仅异常触发详细监测',
      description:
        '系统平时持续进行基础异常识别。只有检测到疑似异常事件时，才启动详细监测与事件记录。',
      normalStatus: '详细监测未开启',
      normalDescription: '当前仅进行基础异常识别',
      eventStatus: '正在启动详细监测',
      eventDescription: '正在生成事件记录',
    },
    continuous: {
      label: '持续详细监测',
      description: '系统持续进行基础异常识别、详细监测与事件记录。',
      normalStatus: '持续详细监测进行中',
      normalDescription: '基础异常识别与详细监测均在运行',
      eventStatus: '持续详细监测保持运行',
      eventDescription: '正在生成事件记录',
    },
  },
}

export const SCHEMES = {
  A: {
    id: 'A',
    label: '方案A',
    sharingLevel: 'detailed',
    recipients: 'children_and_care_staff',
    monitoringMode: 'event_triggered',
  },
  B: {
    id: 'B',
    label: '方案B',
    sharingLevel: 'summary',
    recipients: 'children',
    monitoringMode: 'event_triggered',
  },
}

export const SCHEME_LIST = Object.values(SCHEMES)

export function getAttributeValue(scheme, attributeKey) {
  return ATTRIBUTE_VALUES[attributeKey][scheme[attributeKey]]
}

export function isDifferentAttribute(attributeKey) {
  const values = SCHEME_LIST.map((scheme) => scheme[attributeKey])
  return new Set(values).size > 1
}

export function getRecipientLabel(scheme) {
  return getAttributeValue(scheme, 'recipients').label
}

export function getMonitoringCopy(scheme) {
  return getAttributeValue(scheme, 'monitoringMode')
}

export function getNotificationContent(scheme) {
  const hasDetailedAccess = scheme.sharingLevel === 'detailed'

  return {
    title: '疑似跌倒警报',
    recipients: getRecipientLabel(scheme),
    time: '14:32',
    message: hasDetailedAccess
      ? '系统于14:32检测到疑似跌倒。已生成事件详细记录。'
      : '系统于14:32检测到疑似跌倒。已向指定子女发送简要提醒。',
    accessItems: hasDetailedAccess
      ? ['异常事件摘要', '相关活动记录', '事件视频片段']
      : ['异常事件摘要'],
    hasDetailedAccess,
  }
}
