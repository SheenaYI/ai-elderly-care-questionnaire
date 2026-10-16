---
name: AI养老监测 DCE 交互式原型
description: 面向研究参与者的温和、严谨且可理解的居家照护配置选择界面。
colors:
  primary: "#214c43"
  primary-deep: "#173b34"
  primary-soft: "#edf5f1"
  sage-surface: "#f5f7f3"
  sage-text: "#557064"
  warm-page: "#f6f5f0"
  white: "#ffffff"
  difference-surface: "#fff9ed"
  difference-text: "#71450b"
  alert: "#fb7185"
typography:
  headline:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "1.5rem–1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "0.9375rem–1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, system-ui, sans-serif"
    fontSize: "0.75rem–0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  control: "8px"
  panel: "12px"
  surface: "16px"
spacing:
  compact: "12px"
  standard: "16px"
  comfortable: "20px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "12px 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
    height: "48px"
  option-card-selected:
    backgroundColor: "{colors.white}"
    textColor: "{colors.primary}"
    rounded: "{rounded.surface}"
    padding: "20px"
  difference-row:
    backgroundColor: "{colors.difference-surface}"
    textColor: "{colors.difference-text}"
    rounded: "{rounded.panel}"
    padding: "16px"
---

# Design System: AI养老监测 DCE 交互式原型

## Overview

**Creative North Star: "居家照护研究工作簿"**

这个系统把严谨的 DCE 研究任务放在温和、可信的家居照护语境中。问卷界面优先呈现可比较、可阅读、可确认的信息；深色监测画面只用于解释预设模拟事件，不抢占选择任务的注意力。

它使用低饱和的深绿、灰绿和暖白建立稳定感，以浅琥珀只标记 A/B 真正不同的实验属性。视觉语言应让参与者理解隐私与共享范围的取舍，而不把虚构系统包装成真实产品宣传。

**Key Characteristics:**

- 温暖但克制的研究问卷表面，适合中老年参与者阅读。
- 方案 A/B 的信息权重完全对等；颜色只提示属性差异和状态。
- 浅色问卷与深色模拟画面形成明确的任务层级。
- 触控、焦点、状态与动画均服务于理解和确认。

## Colors

色彩以安静、可读和实验中立为目标，避免将任何方案渲染为更“先进”或更值得选择。

### Primary

- **常青主色**：用于页面标题带、已选方案、主按钮、关键图标及深色模拟画面的骨架。
- **深林基底**：用于模拟画面的背景与高权重文字，保持稳定而非科幻的技术感。
- **雾绿辅助面**：用于中性属性区块、次级信息与不抢眼的交互背景。

### Tertiary

- **研究差异琥珀**：只用于两方案之间确有差异的属性、提示和异常通知；不得暗示风险严重性、识别准确性或方案优劣。
- **异常粉红**：只用于预设事件发生时的短暂监测状态，不能成为日常界面的强调色。

### Neutral

- **暖白页面**：承载整页背景与大面积阅读区域。
- **纯白内容面**：承载方案卡片、说明与确认面板。
- **灰绿辅助文字**：承载标签和辅助说明，保持常规文字对比度。

**The Difference-Only Rule.** 琥珀色的出现必须对应实验中 A/B 的真实属性差异或明确的研究提示；相同的监测方式保持中性表面。

## Typography

**Display Font:** 使用中文系统无衬线栈，避免为研究问卷引入装饰性展示字体。

**Body Font:** 与标题使用同一中文无衬线栈，保证跨 macOS、Windows 和常见中文环境的稳定显示。

**Character:** 字体层级紧凑、清楚，标题靠字号与字重建立层次，正文保持较宽松的行高，适合较长的中文说明。

### Hierarchy

- **Headline**（600，1.5–1.875rem，1.2）：页面标题与方案名称，承担当前任务和选择对象。
- **Title**（600，1.125–1.25rem，1.35）：说明、确认区和详情区标题。
- **Body**（400，0.9375–1rem，1.75）：研究说明、属性解释与通知内容。
- **Label**（500，0.75–0.875rem，1.5）：状态、属性类别、进度与辅助信息。

**The Read-First Rule.** 正文、属性说明和通知不使用过小字号或压缩行高；研究内容优先于装饰性密度。

## Layout

主体容器在桌面上约束在 72rem 内，按“任务说明 → A/B 对比 → 选择确认”垂直展开。两张方案卡在 `lg` 断点并列，在移动端自动转为单列，避免压缩属性正文。

表面使用 12px、16px、20px 和约 28px 的间距节奏：属性在卡片内紧密分组，卡片和问卷区块之间留有更大的呼吸空间。弹窗在大屏居中并保留可滚动内容区，在移动端从底部展开，所有主要按钮至少为 44px 高。

## Elevation & Depth

页面采用少量柔和、向下偏移的环境阴影区分内容面与暖白背景；选中卡片增加一层更明显但不夸张的深绿阴影。阴影不与厚边框叠加为双重层级。深色模拟画面通过色调和内部状态层次建立深度，而非玻璃拟态。

### Shadow Vocabulary

- **内容面**（`0 14px 32px -24px rgba(23, 59, 52, 0.38)`）：用于说明、方案和确认卡片。
- **已选或悬停**（`0 18px 38px -25px rgba(33, 76, 67, 0.58)`）：用于可选方案的确认反馈。
- **弹窗**（`0 28px 80px -28px rgba(11, 30, 25, 0.56)`）：用于有焦点约束的模拟和结果对话框。

## Shapes

控件使用 8px 圆角，属性区块与按钮使用 12px 圆角，问卷大面与方案卡使用 16px 圆角。圆角应传达温和与可接近性，而不把每个文本片段都做成独立胶囊；胶囊只适用于进度、短状态和“不同”标签。

## Components

### Buttons

- **Shape:** 温和矩形（12px），主操作最小高度 48px；关闭操作为 44px 方形。
- **Primary:** 常青主色底配白字，用于“确认选择”和通知详情等提交式动作。
- **Hover / Focus:** 悬停只做色面变化；键盘焦点使用琥珀色外轮廓，保证不依赖颜色微差。
- **Secondary:** 白底深绿描边，用于“查看模拟情景”“返回”和“重新选择”。

### Chips

- **Style:** 小型圆角标签用于进度、预设模拟、系统连接和“不同”。
- **State:** 方案差异标签使用琥珀；其他状态以深绿、灰绿或白色透明层为主。

### Cards / Containers

- **Corner Style:** 方案卡和问卷大面采用 16px；属性区块采用 12px。
- **Background:** 普通属性为雾绿浅面；差异属性为浅琥珀面；方案卡本身为白色。
- **Shadow Strategy:** 卡片仅用单一环境阴影；选择态通过深绿描边、轻微环和更强阴影表达。
- **Internal Padding:** 大面 20–32px，属性区块 16px。

### Inputs / Fields

- **Style:** 单选状态由明确的圆点、文案“已选择”和卡片边界共同表达，任何一项单独缺失时也不丢失状态。
- **Focus:** 卡片支持键盘 Enter/Space，浏览器焦点使用统一琥珀外轮廓。
- **Disabled:** 未选择时，“确认选择”降低色彩与阴影，同时保留可辨识的文字。

### Simulation Dialog

模拟弹窗是唯一的深色信息空间：用真实的监测画布网格、状态线和时间线解释预设事件。它必须提供 Esc 退出、初始焦点、Tab 循环、重播、即时异常和返回问卷，并尊重减少动态效果设置。

## Do's and Don'ts

### Do:

- **Do** 让 A/B 卡片的高度、层级和行动入口保持等权，所有差异从配置数据推导。
- **Do** 使用浅琥珀明确标示不同属性，保持相同监测方式的中性处理。
- **Do** 把模拟事件、时间和风险描述标记为预设模拟，并在方案之间保持一致。
- **Do** 在移动端改为单列，并保持完整的中文正文和至少 44px 的主要触控目标。

### Don't:

- **Don't** 增加价格、准确率、响应速度或任何未给出的方案差异。
- **Don't** 让深色模拟画面扩展成常驻科技后台或科幻控制台。
- **Don't** 用持续闪烁、颜色单独提示或自动播放视频要求参与者理解状态。
- **Don't** 把装饰性阴影、玻璃效果或图标卡片堆叠替代研究内容本身。
