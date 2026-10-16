/**
 * 模拟情景脚本（配置无关部分）。
 *
 * 实验控制要求（V1.0 与用户指令）：
 *   - **各配置使用相同的异常事件**（疑似跌倒）
 *   - **各配置使用相同的模拟时间线**（14:30 正常 → 14:32 异常 → 14:33 通知）
 *   - **各配置使用一致的交互结构**
 *   - **不得**因配置不同而改变跌倒识别准确率、事件严重程度或报警速度
 *   - 所有配置基础异常识别性能相同
 *
 * 因此本文件中的时间与事件描述是**常量**，任何配置相关的内容
 * （谁能看到什么、通知发给谁）都由 profiles.ts 的属性水平派生，
 * 不得写在这里。
 */

import type { ProfileId } from '@/types'
import { PROFILES, getAttributeLevel } from '@/data/profiles'

/** 模拟事件的时间线节点。所有配置完全一致。 */
export interface TimelineStep {
  time: string
  /** 正常状态下的文案。 */
  normalText: string
  /** 该节点被激活后的文案。 */
  activeText: string
  /** 该节点在流程中的序号（0 起）。 */
  index: number
}

export const SIMULATION_EVENT = {
  type: '疑似跌倒',
  time: '14:32',
  /** 统一风险描述：不得按配置差异化。 */
  description: '系统在客厅活动区域检测到疑似跌倒。',
  /** 触发异常前的正常时间点。 */
  normalTime: '14:30',
  /** 通知生成时间。 */
  notifyTime: '14:33',
} as const

export const TIMELINE_STEPS: readonly TimelineStep[] = [
  {
    index: 0,
    time: '14:30',
    normalText: '系统运行正常',
    activeText: '系统运行正常',
  },
  {
    index: 1,
    time: '14:32',
    normalText: '等待模拟异常事件',
    activeText: '检测到疑似跌倒',
  },
  {
    index: 2,
    time: '14:33',
    normalText: '等待发送异常通知',
    activeText: '异常通知已生成',
  },
] as const

/** 模拟阶段。 */
export type SimulationStage = 'normal' | 'event' | 'notification' | 'details'

/** 通知中"接收者可以查看"的条目。完全由 X1 与 X2 决定。 */
export interface NotificationContent {
  title: string
  /** 通知对象（X2 决定）。 */
  recipientLabel: string
  /** 通知正文（X1 决定详细程度）。 */
  message: string
  /** 接收者可查看的信息清单（X1 决定）。 */
  accessItems: string[]
  /** 是否可查看详细活动记录与视频（X1 = 1）。 */
  hasDetailedAccess: boolean
  /** 接收者列表（X2 决定），用于展示"通知发送给谁"。 */
  recipients: string[]
}

/** 接收者名单：X2 决定。 */
export function getRecipients(profileId: ProfileId): string[] {
  const profile = PROFILES[profileId]
  return profile.X2 === 0
    ? ['您指定的子女']
    : ['您指定的子女', '授权的养老服务机构']
}

/** 通知内容：X1 决定可见范围，X2 决定通知对象。 */
export function getNotificationContent(profileId: ProfileId): NotificationContent {
  const profile = PROFILES[profileId]
  const hasDetailedAccess = profile.X1 === 1
  const recipientLabel = getAttributeLevel('X2', profile.X2).label

  return {
    title: '疑似跌倒警报',
    recipientLabel,
    message: hasDetailedAccess
      ? '系统于14:32检测到疑似跌倒。已生成事件详细记录，接收者可查看相关活动记录与视频片段。'
      : '系统于14:32检测到疑似跌倒。已向指定接收者发送简要提醒。',
    accessItems: hasDetailedAccess
      ? ['异常事件摘要', '详细活动记录', '相关视频片段']
      : ['异常事件摘要（简要提示）'],
    hasDetailedAccess,
    recipients: getRecipients(profileId),
  }
}

/** 监测状态文案：X3 决定平时是否持续详细监测。 */
export interface MonitoringCopy {
  normalStatus: string
  normalDescription: string
  eventStatus: string
  eventDescription: string
}

export function getMonitoringCopy(profileId: ProfileId): MonitoringCopy {
  const profile = PROFILES[profileId]
  if (profile.X3 === 0) {
    return {
      normalStatus: '基础异常识别进行中',
      normalDescription: '详细监测未开启，仅在检测到异常时启动',
      eventStatus: '已启动详细监测',
      eventDescription: '正在生成事件记录',
    }
  }
  return {
    normalStatus: '持续详细监测进行中',
    normalDescription: '基础异常识别与详细监测均在运行',
    eventStatus: '持续详细监测保持运行',
    eventDescription: '正在生成事件记录',
  }
}

/** 模拟流程各阶段的时间控制（所有配置一致）。 */
export const SIMULATION_TIMING = {
  /** 进入模拟后，多久自动触发异常事件。 */
  autoEventDelayMs: 2200,
  /** 事件触发后，多久生成通知。 */
  notifyDelayMs: 1100,
} as const

/** 模拟事件视频路径（本地静态资源，缺失时降级为占位界面）。 */
export const SIMULATION_VIDEO_PATH = '/videos/fall-demo.mp4'
