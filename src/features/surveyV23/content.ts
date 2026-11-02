import type { ProfileId } from "../../types";

/** V2.3 is intentionally separate from the retained V1.1 research instrument. */
export const SURVEY_VERSION = "V2.3" as const;
export const INSTRUMENT_REVISION = "2026-11-02" as const;
export type RespondentType = "elder" | "caregiver";
export type Split = "A" | "B";
export type Answer = string | number | string[];
export interface Question {
  id: string;
  text: string;
  options: readonly string[];
}
export const BACKGROUND: Record<RespondentType, readonly Question[]> = {
  elder: [
    {
      id: "a1",
      text: "您今年多大年纪？",
      options: ["60–65 岁", "66–70 岁", "71–75 岁", "76 岁及以上"],
    },
    {
      id: "a2",
      text: "您现在和谁一起住？",
      options: [
        "一个人住",
        "和老伴一起住",
        "和子女一起住",
        "和其他家庭成员一起住",
      ],
    },
    {
      id: "a3",
      text: "您平时用智能手机或智能设备吗？",
      options: ["完全不会用", "会一点（打电话、微信）", "用得很熟练"],
    },
    {
      id: "a4",
      text: "您平时的身体情况：",
      options: ["完全能自己照顾自己", "偶尔需要人帮忙", "经常需要人照顾"],
    },
    {
      id: "a5",
      text: "您觉得自己跌倒或突发疾病的风险大吗？",
      options: ["几乎没有", "有一点", "比较大", "很大"],
    },
    {
      id: "a6",
      text: "最近一年您摔倒过吗？",
      options: ["没有", "摔过 1 次", "摔过 2 次及以上"],
    },
  ],
  caregiver: [
    {
      id: "b0",
      text: "您家中是否有 60 周岁及以上、由您实际参与照护的老人？",
      options: ["是", "否"],
    },
    {
      id: "b1",
      text: "您的年龄：",
      options: ["18–29 岁", "30–44 岁", "45–59 岁", "60 岁及以上"],
    },
    {
      id: "b2",
      text: "您与老人的关系：",
      options: ["子女", "配偶", "其他亲属", "其他家庭成员"],
    },
    {
      id: "b3",
      text: "您的照护频率与年限：",
      options: [
        "每天照护且超过 1 年",
        "每天照护但不足 1 年",
        "每周数次",
        "偶尔帮忙",
      ],
    },
    {
      id: "b4",
      text: "老人居住状态：",
      options: ["独居", "与您同住", "与伴侣居住", "和其他家庭成员居住"],
    },
    {
      id: "b5",
      text: "老人的健康/跌倒风险：",
      options: [
        "无",
        "轻微（有慢病但行动自如）",
        "中度（行动不便或有 1 次跌倒史）",
        "较高（多次跌倒/失能倾向）",
      ],
    },
    {
      id: "b6",
      text: "您是否了解 AI 养老监测设备？",
      options: ["使用过", "了解但未使用", "不了解"],
    },
  ],
};
export const OPENING: Record<RespondentType, string> = {
  elder:
    "您好！我们是在校大学生，正在做一个关于AI智能养老设备的研究。想了解您对一种“能帮忙照看您的状态”的智能监测设备的看法。问卷不记名，没有对错之分，您怎么想就怎么答。数据只用于学术研究，匿名保存，结题后一年内删除；您可以随时退出，退出不会有任何影响。",
  caregiver:
    "您好！本次调研为大学生创新创业训练计划项目专项研究，希望了解家庭照护者对 AI 养老监测系统不同配置的偏好，以及对安全、隐私与自主性的看法。问卷匿名作答，数据仅用于学术研究。数据结题后一年内删除；您可以随时退出，退出不会有任何影响。",
};
export const ATTRIBUTE_COPY = {
  X1: {
    title: "信息共享层级",
    question: "能看到的信息",
    labels: ["只要简单提示", "可以看详细记录和视频"],
    clauses: [
      '平时家人只能看到"活动正常/疑似跌倒"等简单提示',
      "接收者还可以查看与事件相关的详细记录（异常前后的活动记录或视频）",
    ],
  },
  X2: {
    title: "信息接收对象",
    question: "信息发给谁",
    labels: ["只发给指定子女", "子女和养老服务机构"],
    clauses: ["信息只发给指定的子女", "信息发给指定的子女和签约的养老服务机构"],
  },
  X3: {
    title: "详细监测方式",
    question: "监测方式",
    labels: ["发现异常才详细记录", "全天不停详细监测记录"],
    clauses: [
      "设备平时只做基础判断，出现异常时才开始详细监测与记录",
      "设备全天持续进行详细监测与记录",
    ],
  },
} as const;
export const BOUNDARY =
  "设备什么时候详细记录，由 X3 决定；记录的内容别人能看多细，由 X1 决定；这些信息发给谁，由 X2 决定。三者各管一件事，互不重叠。";
export const COMMON_PREMISES: Record<
  RespondentType,
  { title: string; items: readonly string[] }
> = {
  elder: {
    title: "这套设备对所有方案都一样、改不了的部分：",
    items: [
      '平时：设备只进行"活动正常 / 好久没动静 / 好像摔倒了"这些简单基础的情况识别，不保存平时您的敏感信息。',
      "出事时：一旦发现好像摔倒了，设备马上按方案设定发出警报。",
      "李阿姨随时可以根据系统规定进行调整设置。",
      "费用、存储方式各方案都一样。",
    ],
  },
  caregiver: {
    title: "所有方案完全相同、不可更改的部分：",
    items: [
      '日常记录：设备持续进行基础状态识别，例如判断"活动正常""长时间无活动"等简单情况，不保存日常生活视频。',
      "异常处理：一旦判断疑似跌倒，系统立即按方案设定的接收对象发送警报（基础报警能力所有方案一致）。",
      "老人可根据系统规定调整设置。",
      "费用、云端存储规则在所有方案间一致。",
    ],
  },
};
export const BASIC_SCENARIO =
  "设备持续进行基础状态识别，例如判断活动是否正常、是否长时间无活动等简单情况；基础识别本身不保存日常生活视频，也不进行全天详细活动记录。发现疑似摔倒等异常时，才按照具体方案设定启动详细记录并通知相关人员。若方案设置为全天详细监测，详细记录则按该设置持续进行。";
export const SCENARIO_INTRO: Record<RespondentType, string> = {
  elder:
    "请设想：李阿姨 72 岁，一个人住在家里，一年前在家中滑倒过。家人想为她装一套智能监测设备。",
  caregiver:
    "请设想：李阿姨 72 岁，独居，一年前在家中滑倒过。家人计划为她安装一套 AI 养老监测系统。",
};
export const CHECKS: Record<
  RespondentType,
  readonly (Question & { correct: number; explanation: string })[]
> = {
  elder: [
    {
      id: "a7",
      text: "“只看简单提示”是什么意思？",
      options: [
        "只能看到“正常/疑似跌倒”这类提示",
        "能看到完整视频",
        "什么都看不到",
      ],
      correct: 0,
      explanation: "只能看到“正常/疑似跌倒”这类提示，家人不能看到完整视频。",
    },
    {
      id: "a8",
      text: "“异常时才开始详细监测”是什么意思？",
      options: [
        "平时什么都不管",
        "平时做基础判断，异常时才开始详细记录",
        "只在白天工作",
      ],
      correct: 1,
      explanation: "平时仍做基础判断，异常时才开始详细记录。",
    },
  ],
  caregiver: [
    {
      id: "b7",
      text: "“仅摘要信息”是指：",
      options: ["仅可查看简要提示", "可查看完整视频", "系统不能传递任何信息"],
      correct: 0,
      explanation: "仅摘要信息是指仅可查看简要提示，不影响基础异常识别能力。",
    },
    {
      id: "b8",
      text: "“异常时启动详细监测”是指：",
      options: [
        "平时完全不检测",
        "基础检测持续，异常时启动详细监测",
        "仅在白天检测",
      ],
      correct: 1,
      explanation: "基础检测持续，异常时启动详细监测。",
    },
  ],
};
export const TASKS = {
  T01: { split: "A", A: "C1", B: "C3" },
  T02: { split: "A", A: "C5", B: "C6" },
  T07: { split: "A", A: "C3", B: "C5" },
  T08: { split: "A", A: "C3", B: "C7" },
  T04: { split: "B", A: "C2", B: "C4" },
  T05: { split: "B", A: "C2", B: "C6" },
  T06: { split: "B", A: "C2", B: "C8" },
  T10: { split: "B", A: "C3", B: "C4" },
} as const satisfies Record<
  string,
  { split: Split; A: ProfileId; B: ProfileId }
>;
export type V23TaskId = keyof typeof TASKS;
export const ITEM_IDS = [
  "s1",
  "s2",
  "p1",
  "p2",
  "a1",
  "a2",
  "i1",
  "i2",
] as const;
export type ItemId = (typeof ITEM_IDS)[number];
export const RATINGS: Record<RespondentType, Record<ItemId, string>> = {
  elder: {
    s1: "我觉得这台设备能及时发现家里可能出的危险。",
    s2: "我觉得真出事的时候，这台设备能帮上忙。",
    p1: "我担心这台设备收集的信息太多。",
    p2: "我担心不该看的人能看到我在家的详细情况。",
    a1: "用了这台设备，我平时想怎么过日子还是怎么过。",
    a2: "我觉得这台设备不会管得太多、让我不自在。",
    i1: "要是真能装，我愿意用这台设备。",
    i2: "我愿意长期用这台设备。",
  },
  caregiver: {
    s1: "我认为该系统能够及时发现老人可能发生的安全风险。",
    s2: "我认为该系统在紧急情况下能提供有效的安全保障。",
    p1: "我担心该系统收集了过多的老人个人信息。",
    p2: "我担心不必要的人员能够查看老人的详细活动信息。",
    a1: "我认为老人使用该系统后，仍能自主安排日常生活。",
    a2: "我认为该系统不会过度干预老人的私人生活。",
    i1: "如果该系统实际可用，我愿意选择或为老人配置它。",
    i2: "我愿意在实际养老照护中长期使用该系统。",
  },
};
export const WILLINGNESS: Record<RespondentType, readonly string[]> = {
  elder: ["很不愿意", "不太愿意", "说不好", "比较愿意", "非常愿意"],
  caregiver: ["非常不同意", "不同意", "一般", "同意", "非常同意"],
};
export const CONCERNS: Record<RespondentType, readonly string[]> = {
  elder: [
    "出事发现不了",
    "自己的私事被人看到",
    "自己说了不算",
    "设备乱报警/出故障",
    "其他",
  ],
  caregiver: [
    "安全风险识别不足",
    "个人隐私暴露",
    "老人自主权受限",
    "设备误报/故障",
    "其他",
  ],
};
export const WEIGHT_KEYS = ["security", "privacy", "autonomy"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export const WEIGHT_LABELS: Record<
  RespondentType,
  Record<WeightKey, string>
> = {
  elder: {
    security: "安全保障（及时发现摔倒等危险）",
    privacy: "不被打扰（少收集、少传我的信息）",
    autonomy: "自己做主（设备开不开、怎么设由我自己定）",
  },
  caregiver: {
    security: "安全保护（及时发现跌倒等风险）",
    privacy: "隐私保护（减少活动信息的收集与共享）",
    autonomy: "自主决定权（由老人自己决定设备的开关与设置）",
  },
};
