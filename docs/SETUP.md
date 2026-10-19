# 本地开发指南（SETUP）

本文档说明如何在本地运行、构建与修改「智能养老AI监测系统配置偏好与采纳意愿调查」问卷平台。

项目定位：面向学术研究（大学生创新创业训练计划科研项目）的问卷与离散选择实验（DCE）平台。
**当前状态：原型开发中，尚未完成伦理审查与 Pilot 试填，不得用于正式数据收集。**

相关文档：

- 数据表结构与编码规则：[DATA_DICTIONARY.md](./DATA_DICTIONARY.md)
- **Supabase 建库与协作**：[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- 部署（Netlify / Vercel）：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 研究设计审查与待确认事项：[RESEARCH_NOTES.md](./RESEARCH_NOTES.md)

---

## 1. 环境要求

| 项目 | 要求 | 说明 |
|---|---|---|
| Node.js | **18 或更高**（建议 20 LTS） | Vite 5 / Vitest 2 的最低要求为 Node 18 |
| npm | 9 或更高 | 随 Node 一起安装 |
| 浏览器 | 支持 ES2022 的现代浏览器 | Chrome / Edge / Safari / Firefox 近两年版本 |
| 可选 | Supabase 项目 | 只有在需要「真实数据提交模式」时才需要；不配置则以 Demo 模式运行 |

本文档编写时本机实测版本：Node `v26.8.1`、npm `11.19.0`。

不需要安装任何全局依赖，也不需要 Docker。

---

## 2. 安装依赖

在项目根目录执行：

```bash
npm install
```

### 本机已知问题：npm 全局缓存权限异常

本机（开发机）的 npm 全局缓存目录存在权限问题，直接执行 `npm install` 可能失败并提示
`EACCES` / `permission denied`（缓存目录不可写）。**不要**用 `sudo npm install` 解决，
而是把缓存改到项目内的本地目录：

```bash
npm install --cache "$PWD/.npm-cache"
```

说明：

- `--cache` 只改变本次安装使用的缓存目录，不修改全局 npm 配置。
- 项目根目录下的 `.npm-cache/` 就是该方案的产物，**不需要提交到 Git**。
- 后续每次 `npm install` / `npm ci` 都建议带上同一个 `--cache` 参数，否则会再次命中全局缓存。
- 如果只是想临时绕过而不想污染项目目录，也可以使用 `npm install --cache /tmp/npm-cache`。

---

## 3. 常用命令

| 命令 | 作用 | 说明 |
|---|---|---|
| `npm run dev` | 启动开发服务器 | 默认地址 `http://localhost:5173`，支持热更新（HMR） |
| `npm run build` | 生产构建 | 先执行 `tsc --noEmit` 类型检查，再执行 `vite build`，产物在 `dist/` |
| `npm run build:only` | 只构建、不做类型检查 | 只用于排查构建问题；**正式发布一律用 `npm run build`** |
| `npm run preview` | 本地预览生产构建 | 需先执行 `npm run build`；用于上线前自检 |
| `npm test` | 运行测试（单次） | `vitest run`，测试文件位于 `tests/**/*.test.ts` |
| `npm run test:watch` | 监听模式运行测试 | 开发时使用 |
| `npm run typecheck` | 只做 TypeScript 类型检查 | `tsc --noEmit`，检查范围含 `src`、`api`、`tests` |

### 关于测试

`vitest.config.ts` 配置为：

- 测试环境：`jsdom`（`environmentOptions.jsdom.url = http://localhost/`），因为包含页面渲染测试
- 初始化文件：`tests/setup.ts`（设置 `IS_REACT_ACT_ENVIRONMENT`、替换 jsdom 未实现的
  `window.scrollTo`、每个测试后清理 DOM 与 `localStorage`）
- 匹配范围：`tests/**/*.test.ts`

现有十一个测试文件（当前共 241 个断言，全部通过）：

| 测试文件 | 覆盖内容 |
|---|---|
| `tests/dceTasks.test.ts` | C1–C8 配置编码、T01–T12 任务配对、A/B 分卷、设计完整性自查、配置使用均衡 |
| `tests/questionnaireData.test.ts` | 问卷文本与模块一/二/四/五内容、三个实验属性、模拟脚本受控、待配置占位字段 |
| `tests/randomization.test.ts` | 确定性随机数发生器、洗牌、分卷、题序与左右位置随机化、4 配置平衡分配及非法方案识别 |
| `tests/validation.test.ts` | 提交载荷结构校验（Zod）、研究语义校验、理解检查一致性、提交前完成度、属性快照 |
| `tests/rendering.test.ts` | 公共页面、问卷步骤、路由表、管理后台安全渲染行为、模拟组件渲染 |
| `tests/heroOrbitGeometry.test.ts` | 首页主视觉几何一致性：圆心共用、三节点等距且夹角 120°、标签不压节点、三维度样式等权 |
| `tests/adminSignIn.test.ts` | 研究后台登录：错误码分类（邮箱未确认/限流/未启用邮箱登录/账号禁用/网络）与凭据错误统一措辞 |
| `tests/customConfig.test.ts` | 模块六自由自选配置：8 种组合反查、必填校验、伪造编码被拒、开关交互与草稿持久化 |
| `tests/netlifyAdapter.test.ts` | Netlify 适配层端到端：405/503/429/413/400/401/403/204、请求体与体积守卫、查询参数、client IP 限流分桶、含中文响应头规范化、出错兜底不泄露细节 |
| `tests/videoFallback.test.ts` | 演示视频缺失 / SPA 回退返回 HTML / 网络失败时均退化为占位界面，不崩溃 |
| `tests/store.test.ts` | 草稿持久化与恢复、随机化在会话中稳定（刷新/返回不重随机）、逐题记录与回改、理解检查保留首次结果、草稿与已提交区分、模拟埋点上限 |

### 部署平台与「一份业务逻辑」（Netlify 适配层）

本项目部署在 **Netlify**。但服务端逻辑只有一份，位于 `api/`（Vercel 风格
`(req, res)`），Netlify 通过一层薄适配复用它们：

```text
netlify/functions/
  _lib/adapter.ts       Request → Vercel 风格 req/res → Response
  submit-survey.ts      import ../../api/submit-survey 后包一层
  admin-export.ts       import ../../api/admin/export   后包一层
```

改后端逻辑时**只改 `api/` 下的文件**，不要在 `netlify/functions/` 里重复实现。
真实路径映射由 `public/_redirects` 提供（`/api/submit-survey` → 函数），
前端请求的 URL 因此在 Netlify 与 Vercel 上完全一致。

本地跑测试时注意：`tests/netlifyAdapter.test.ts` 中的导出鉴权用例会真的向
`SUPABASE_URL` 校验 token，而测试里用的是假域名，所以那几条用例要等网络超时
（每条显式声明 20s 超时）。这是**故意**的——正是为了验证"鉴权失败时失败关闭、
不泄露任何数据"，而不是给它打桩。

### 测试环境的一个坑：localStorage 被 Node 遮蔽

在 Node 22+ 上，Node 自己提供了一个**实验性的全局 `localStorage`**。即使测试环境是 jsdom，
`window.localStorage` 也可能取到 Node 那个未启用的实现，并打印：

```
ExperimentalWarning: localStorage is not available because --localstorage-file was not provided
```

后果是草稿持久化的代码路径不会被真正执行（`isBrowser()` 判断失败），
相关测试会"静默通过但什么都没测到"。

因此 `tests/setup.ts` 显式注入了一个符合 `Storage` 接口的**内存实现**，
覆盖 `window.localStorage`、`window.sessionStorage` 与 `globalThis.localStorage`，
并在每个用例后清空。如果你新增了依赖本地存储的测试，请直接使用它，不要自己 mock。

其中 `checkDesignIntegrity()`（位于 `src/data/dceTasks.ts`）是设计完整性的核心自查函数；
随机化模块还提供 `validateTaskDisplayPlan()`、`validateRatingPlan()`、
`auditRatingAllocation()`。**修改任何研究内容后必须重跑 `npm test`。**

---

## 4. 项目结构

实际目录结构（不含 `node_modules/`、`.npm-cache/`、`dist/`）：

```text
<仓库根目录>/                     # 应用已在仓库根目录，Netlify 无需设置 Base directory
├── api/                         # 服务端接口（Vercel Serverless Functions，自动识别）
│   ├── submit-survey.ts         #   POST /api/submit-survey — 问卷的唯一写入通道
│   ├── admin/export.ts          #   GET  /api/admin/export — 需登录 + 白名单的 CSV 导出
│   └── _lib/                    #   服务端共享代码预留目录（以 _ 开头，不暴露为路由）
├── netlify/                     # Netlify 平台适配（业务逻辑仍在 api/，此处只是薄封装）
│   └── functions/
│       ├── _lib/adapter.ts     #   Request → Vercel 风格 req/res → Response
│       ├── submit-survey.ts    #   包一层 api/submit-survey
│       └── admin-export.ts     #   包一层 api/admin/export
├── docs/                        # 项目文档
│   ├── SETUP.md                 #   本文件
│   ├── SUPABASE_SETUP.md        #   Supabase 建库 / 协作 / 验收 / 导出 操作手册
│   ├── DATA_DICTIONARY.md       #   数据字典
│   ├── DEPLOYMENT.md            #   部署指南
│   ├── RESEARCH_NOTES.md        #   研究设计审查（与 V1.0 原文对照的核对记录）
│   └── source/                  #   V1.0 问卷原始文件（.docx 及其文本转录）
├── public/                      # 直接拷贝到产物根目录的静态资源
│   └── videos/                  #   模拟事件视频（fall-demo.mp4，缺失时降级为占位）
├── src/
│   ├── app/                     # 应用装配层
│   │   ├── router.tsx           #   路由表（/、/experience、/about、/privacy、/questionnaire、/admin）
│   │   └── store.ts             #   Zustand 问卷状态 + 草稿持久化 + 随机化稳定性
│   ├── components/              # 与业务无关的通用组件
│   │   ├── layout/              #   AppShell、SiteNav（桌面左侧导航 / 移动端顶部抽屉）、SiteFooter、PageHeader、PageContainer、ScrollToTop
│   │   ├── home/                #   HeroOrbit：首页主视觉（居家养老 + 三个研究维度 + 粒子环绕）
│   │   └── ui/                  #   Button、Card、Badge、ProgressBar、PendingField
│   ├── data/                    # 研究内容的唯一来源（页面不得硬编码题目文本）
│   │   ├── profiles.ts          #   属性定义、C1–C8 配置、统一前提
│   │   ├── dceTasks.ts          #   T01–T12 任务表、A/B 分卷、设计完整性自查
│   │   ├── questionnaire.ts     #   Q1–Q10、理解检查、问卷版本号
│   │   ├── scales.ts            #   12 个量表题（S1–S3/P1–P3/A1–A3/I1–I3）
│   │   └── placeholders.ts      #   待研究团队填写的字段（占位符）
│   ├── features/                # 按功能划分的业务模块
│   │   ├── questionnaire/       #   知情同意、情景说明、总体评价、复查、完成页
│   │   ├── dce/                 #   DCE 方案对比与选择
│   │   ├── ratings/             #   配置感知评价（4 配置 × 12 题）
│   │   ├── simulation/          #   情景体验与模拟事件（含 VideoPreview 降级）
│   │   └── admin/               #   研究管理后台（懒加载，不进入参与者首屏包）
│   ├── lib/
│   │   ├── config.ts            #   运行时环境配置 + detectDataMode()
│   │   ├── storage.ts           #   localStorage 草稿持久化
│   │   ├── submission.ts        #   提交客户端（Demo / 真实提交）
│   │   ├── cn.ts                #   className 合并工具
│   │   ├── randomization/       #   分卷、题序、左右位置、4 配置分配（纯函数 + 可复现种子）
│   │   ├── supabase/client.ts   #   浏览器端 Supabase 客户端（仅 anon 公钥，供管理后台登录）
│   │   └── validation/schemas.ts#   Zod 校验规则（前后端共用）
│   ├── pages/                   # 页面组件（Home / Experience / About / Privacy / Questionnaire / NotFound）
│   ├── styles/index.css         # Tailwind 入口 + 可访问性基线
│   ├── types/index.ts           # 全局领域类型（与 V1.0 命名一致的编码定义）
│   ├── main.tsx                 # 前端入口
│   └── vite-env.d.ts            # import.meta.env 的类型声明
├── supabase/
│   ├── schema.sql               # 单文件完整结构（SQL Editor 一次性执行）
│   ├── migrations/              # 0001_init / 0002_rls_policies / 0003_grants
│   └── README.md                # 建库步骤、安全模型、自检查询、事务语义
├── tests/                       # Vitest：dceTasks / questionnaireData / randomization / validation / rendering
├── .env.example                 # 环境变量模板（只含占位符，可提交）
├── index.html                   # Vite HTML 模板（语言 zh-CN，noindex）
├── package.json
├── tailwind.config.js           # 主题色（森林绿 / 鼠尾草绿 / 奶油白 / 香槟金）与阅读字号
├── postcss.config.js
├── tsconfig.json                # 路径别名 @/* → ./src/*
├── vite.config.ts               # 别名、开发端口 5173、构建输出 dist/
└── vitest.config.ts             # 测试匹配 tests/**/*.test.ts，environment: node
```

---

## 5. 环境变量

### 5.1 `VITE_` 前缀意味着「公开、会进入浏览器」

Vite 会把所有以 `VITE_` 开头的环境变量**在构建时内联进前端 JavaScript 产物**。
这意味着：

- 任何以 `VITE_` 开头的变量，访问网站的任何人都可以在浏览器里读到。
- `VITE_` 变量**不是秘密**，不能用来放密钥。
- 反过来，只有服务端代码（`api/` 目录下的 Serverless Function）才能读取**不带** `VITE_` 前缀的
  环境变量，这些变量只存在于平台（Vercel / Netlify）的环境变量设置中。

因此本项目的划分是：

- 前端只用 Supabase 的**公开**配置：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
  anon 公钥本身是公开的，安全性由数据库的 Row Level Security（RLS）策略保证，而不是靠隐藏密钥。
- `service_role` key、数据库密码、管理员密钥**绝不能**出现在前端，也**绝不能**加 `VITE_` 前缀。

### 5.2 前端可用的环境变量

定义位置：`src/lib/config.ts`；类型声明位置：`src/vite-env.d.ts`。

| 变量名 | 公开性 | 默认值 | 作用 | 未配置时的行为 |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | 公开 | 无 | Supabase 项目 URL | 与 anon key 任一缺失即进入 Demo 模式 |
| `VITE_SUPABASE_ANON_KEY` | 公开 | 无 | Supabase anon 公钥（受 RLS 约束） | 同上 |
| `VITE_SUBMIT_ENDPOINT` | 公开 | `/api/submit-survey` | 提交接口路径 | 使用默认值 |
| `VITE_QUESTIONNAIRE_VERSION` | 公开 | `V1.0` | 运行时读取的问卷版本号 | 使用默认值 |
| `VITE_ALLOW_DEMO_MODE` | 公开 | 仅开发环境为 `true` | 是否允许在无后端时以 Demo 模式"提交" | 生产环境应保持 `false`（或不设置）；只有在本地演示时才设为字符串 `'true'`，未设置且非开发环境时会拒绝 Demo 提交 |

### 5.3 Demo 模式与真实提交模式

应用通过 `src/lib/config.ts` 的 `detectDataMode()` 判断当前模式：

```text
detectDataMode():
  同时存在 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY  → 'supabase'（真实数据提交模式）
  否则                                                  → 'demo'（Demo 模式）
```

两种模式的差别：

| 维度 | Demo 模式 | 真实数据提交模式 |
|---|---|---|
| 触发条件 | Supabase 公开配置缺失 | 两个 `VITE_SUPABASE_*` 均已配置 |
| 界面提示来源 | `dataModeNotice()` → "Demo 模式（数据不会保存到云端）" | `dataModeNotice()` → "真实数据提交模式" |
| 提交行为 | **不发送任何网络请求**；数据只留在提交者本机浏览器 | `POST` 到 `VITE_SUBMIT_ENDPOINT`（默认 `/api/submit-survey`） |
| 数据是否落库 | 否。这是关键区别，界面文案必须如实说明 | 是，由服务端校验后写入 Supabase |
| 额外开关 | 还要求 `VITE_ALLOW_DEMO_MODE === 'true'` 或处于开发环境（`import.meta.env.DEV`） | 不适用 |

**重要：** Demo 模式永远不能显示"已成功提交到服务器"。`src/lib/submission.ts` 在 Demo 模式下
返回的提示文案明确写着"数据**仅保留在您本人的浏览器中，未上传到云端数据库**"。
任何改动都不得把这个区别抹掉。如果生产环境未配置 Supabase 且未开启 `VITE_ALLOW_DEMO_MODE`，
提交会被拒绝并提示联系研究团队完成配置——这是**有意设计**，防止把演示数据当成真实研究数据。

### 5.4 本地配置方式

权威模板是项目根目录的 **`.env.example`**（只含占位符，可以提交到 Git）。
本地开发时复制为 `.env.local`（已被 `.gitignore` 忽略，不会提交）：

```dotenv
# 公开变量：会进入浏览器产物，不得放任何密钥
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUBMIT_ENDPOINT=/api/submit-survey
VITE_QUESTIONNAIRE_VERSION=V1.0
VITE_ALLOW_DEMO_MODE=false

# 服务端专用（本地跑 api/ 下的函数时才需要）
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

不配置 `.env.local` 时，`npm run dev` 会正常工作并处于 Demo 模式，适合界面开发与内部试填。

### 5.5 服务端专用变量（不在前端使用）

以下变量只允许配置在部署平台的环境变量/Secrets 中，
由 `api/submit-survey.ts` 与 `api/admin/export.ts` 通过 `process.env` 读取：

| 变量名 | 公开性 | 作用 |
|---|---|---|
| `SUPABASE_URL` | 服务端专用 | 服务端读写数据库使用的项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **绝密** | 服务端写入与导出使用；绕过 RLS，泄露等同于数据库被完全接管 |
| `RESEARCH_ADMIN_ALLOWLIST` | 服务端专用（可选） | 逗号分隔的管理员邮箱。**仅作补充说明用途**；真正的权限判定始终以数据库 `research_admins` 白名单为准 |

服务端行为要点（已在 `api/submit-survey.ts` 中实现）：

- 只接受 `POST`，其他方法返回 `405`。
- 请求体超过 256 KB、或命中内存令牌桶限流时直接拒绝。
- 用 `src/lib/validation/schemas.ts` 做结构校验与研究语义校验，**不信任客户端结论**。
- 问卷版本必须同时满足：等于代码常量 `QUESTIONNAIRE_VERSION`，
  且已在数据库 `questionnaire_versions` 中登记并 `is_active = true`。
- **服务端环境变量缺失时返回 `503` + `mode: 'demo'`**，明确说明"未写入云端数据库"，
  绝不伪装成功。

部署平台中的变量清单与放置位置见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

---

## 6. 如何修改研究内容

研究内容的唯一来源是 `src/data/` 与 `src/lib/`。**页面组件不得硬编码题目文本、
属性文案或配置取值。** 要修改研究内容，按下表找到对应文件：

| 想修改什么 | 改哪个文件 | 具体位置 / 说明 |
|---|---|---|
| 三个属性的名称与水平文案 | `src/data/profiles.ts` | `ATTRIBUTE_DEFINITIONS`（面向参与者的 `title`、水平的 `label`/`description`） |
| 统一前提说明 | `src/data/profiles.ts` | `UNIFIED_PREMISES`（基础能力、任务框定、统一前提列表、自主控制说明） |
| C1–C8 的 (X1,X2,X3) 取值 | `src/data/profiles.ts` | `PROFILES`。**禁止修改**，见第 7 节 |
| DCE 任务的 A/B 配对与卷别 | `src/data/dceTasks.ts` | `DCE_TASK_SOURCE`（T01–T12 的 `block` / `profileA` / `profileB` / `structureType`）。**禁止修改**，见第 7 节 |
| DCE 题干与选择提问 | `src/data/dceTasks.ts` | `DCE_TASK_PROMPT`、`DCE_CHOICE_QUESTION`、`SIMULATION_DISCLAIMER` |
| 每卷题数、每人评价的配置数 | `src/data/dceTasks.ts` | `TASKS_PER_BLOCK`（=6）、`PROFILES_PER_PARTICIPANT`（=4） |
| 属性编码的顺序 | `src/types/index.ts` | `ATTRIBUTE_KEYS`（= `['X1','X2','X3']`，顺序即展示顺序） |
| 问卷开头说明、Q1–Q10 文本与选项 | `src/data/questionnaire.ts` | `OPENING_STATEMENT`、`Q1_CONSENT`、`Q2_*`…`Q10_QUESTION`、`Q9_CONCERNS` |
| 情景说明与理解检查题（Q6、Q7） | `src/data/questionnaire.ts` | `SCENARIO_STATEMENT`、`COMPREHENSION_QUESTIONS`（含正确答案与答错解释） |
| **问卷版本号** | `src/data/questionnaire.ts` | `QUESTIONNAIRE_VERSION` |
| 12 个量表题文本 | `src/data/scales.ts` | `SCALE_ITEMS` |
| 构念划分与计分方向 | `src/data/scales.ts` | `CONSTRUCTS` |
| 5 点 Likert 选项标签 | `src/data/scales.ts` | `LIKERT_OPTIONS`、`LIKERT_SCALE_PROMPT` |
| 模拟事件时间线与视频路径 | `src/features/simulation/simulationScript.ts` | `SIMULATION_EVENT`、`TIMELINE_STEPS`、`SIMULATION_VIDEO_PATH` |
| 待研究团队填写的字段（机构、伦理编号、联系人、保存期限等） | `src/data/placeholders.ts` | 修改各字段的 `value` 并置 `pending: false`，见下 |
| 提交数据的校验规则 | `src/lib/validation/schemas.ts` | 前后端共用；服务端提交接口直接 import 本文件 |
| 随机化与平衡分配规则 | `src/lib/randomization/index.ts` | 分卷、题序、左右交换、4 配置分配 |
| 主题色与正文字号 | `tailwind.config.js`、`src/styles/index.css` | 面向中老年参与者的可访问性基线，慎改 |

### 6.1 填写「待研究团队填写」的字段

`src/data/placeholders.ts` 中的字段默认 `value: null`，界面会显示 `[待填写：…]` 占位样式。
研究团队确认后，把 `value` 填成实际内容即可（`pending` 由 `field()` 辅助函数根据 `value`
是否为空自动计算，不需要手工改）：

```ts
export const ETHICS_APPROVAL = field(
  'ethicsApproval',
  '伦理审批编号',
  '[待填写：伦理审批编号]',
  '填写所在单位伦理审查委员会的审批编号。…',
  '研究团队提供的审批编号', // ← 填入实际值
)
```

当前待填写字段共 9 项：所属学校或研究单位、研究负责人、研究联系人、联系人邮箱、
伦理审批编号、预计填写时间、数据保存期限、可访问数据的人员范围、退出与数据删除申请方式。

- `ALL_CONFIGURABLE_FIELDS` 汇总全部字段，供页脚与管理后台"上线前检查"使用。
- `pendingFields()` 返回尚未填写的字段；`isLaunchReady()` 判断是否全部填写完成。
- **严禁编造**其中任何信息。特别是"预计填写时间"必须由研究团队完成内部试填（Pilot）后，
  依据实测时长中位数填写。

### 6.2 修改研究内容后必须做的事

1. **升级 `QUESTIONNAIRE_VERSION`**（见第 7 节）。
2. 运行 `npm run typecheck` 与 `npm test`。
3. 确认 `checkDesignIntegrity()` 仍然通过（每卷 6 题、差分矩阵秩 = 3、属性水平平衡、
   12 题每题恰好 2 个属性变化、8 个配置使用均衡）。
4. 若修改了 DCE 任务表，还必须确认每卷仍同时包含"同向变化"与"替代权衡"两类题目。

---

## 7. 修改研究设计的强制流程（重要）

本节是给开发者与研究助理的硬性约束，不是建议。

1. **任何研究设计变更都必须先得到研究团队的书面确认**，再动代码。
   - 依据：`work/RESEARCH_NOTES.md` 的"原则"一节，以及 V1.0 文件本身。
   - 该文件已复制到 [RESEARCH_NOTES.md](./RESEARCH_NOTES.md)。

2. **绝不允许在未获确认的情况下修改 C1–C8 的 (X1,X2,X3) 取值**
   （`src/data/profiles.ts` 的 `PROFILES`）。

3. **绝不允许在未获确认的情况下修改 T01–T12 的 A/B 配对或卷别归属**
   （`src/data/dceTasks.ts` 的 `DCE_TASK_SOURCE`）。
   - 特别提示：V1.0 的 6 道"同向变化"题存在完全支配关系，是否替换是**研究决策**，
     不是工程细节，相关分析见 RESEARCH_NOTES.md 的 B1 节。
   - V1.0 原文明确要求：替换任务时"不能只替换单题"，修改后必须重新检查矩阵秩与属性平衡。

4. **每一次研究内容变更都必须提高版本号。**
   修改位置：`src/data/questionnaire.ts` 的 `QUESTIONNAIRE_VERSION`。

   为什么必须升级：该版本号会随提交载荷一起入库
   （`participants.questionnaire_version`、`survey_sessions.questionnaire_version`），
   是 Pilot 数据与正式数据分离的唯一依据。
   同时要注意**两道版本校验**都必须满足：
   `src/lib/validation/schemas.ts` 使用 `z.literal(QUESTIONNAIRE_VERSION)` 校验提交载荷；
   `api/submit-survey.ts` 还会确认该版本已在数据库 `questionnaire_versions` 中登记
   且 `is_active = true`。因此提升版本号时必须同时在数据库登记新版本，
   否则所有提交都会被拒绝。

   建议命名：草案阶段 `V1.1-draft`、Pilot 阶段 `V1.1-pilot`、正式发放 `V1.1`。
   不要把不同版本的问卷数据混在一起分析。

5. **不得修改量表题目的措辞、顺序编号**（`src/data/scales.ts` 的 `SCALE_ITEMS`）。

6. **不得改写理解检查题及其正确答案**（`src/data/questionnaire.ts` 的 `COMPREHENSION_QUESTIONS`）。

7. **不得把"隐私担忧"（P1–P3）反向计分为"隐私满意度"。**
   P1–P3 分数越高表示隐私担忧越强，这是本研究的既定记分方向。

8. 如果发现代码与 V1.0 原文不一致，**以 V1.0 原文为准**，并把问题记录到
   RESEARCH_NOTES.md，而不是直接改代码。

---

## 8. 本地数据、隐私与安全注意事项

- 匿名参与者标识由 `src/lib/storage.ts` 的 `createParticipantId()` 在本机生成
  （优先 `crypto.randomUUID()`），**不含任何个人身份信息**。
- 草稿保存在浏览器 `localStorage`，键名：
  - `aiecq:draft:v1` — 问卷草稿
  - `aiecq:submitted:v1` — 本机已成功提交记录（防重复提交的第一道防线）
  - `aiecq:prior-experience:v1` — 是否在正式问卷前使用过"情景体验"页面
- `saveDraft()` 只写入 `savedAt`，不写任何"已提交"标记；只有服务端确认成功后才标记已提交并
  清理本地答题数据。不要把草稿误当作已提交数据。
- 代码不向浏览器控制台打印任何研究数据。
- 真实提交只允许经由服务端接口（默认 `/api/submit-survey`）：前端**不直接**写数据库，
  由服务端做权威校验、版本检查和重复提交检查。不要在页面里直接 `insert` 数据。
- **数据库侧对匿名前端完全关闭**：`supabase/migrations/0003_grants.sql` 已把 `anon`
  在 `public` schema 下所有对象上的权限 `REVOKE` 干净，且没有任何面向 `anon` 的 RLS 策略。
  也就是说，任何拿到 anon 公钥的人用 PostgREST 直接查表都会得到 `permission denied`，
  而不是数据。参与者端只调用 `/api/submit-survey` 这一个写入入口。
- 导出接口 `/api/admin/export` 需要 `Authorization: Bearer <Supabase Auth access_token>`，
  且该邮箱必须在数据库 `research_admins` 白名单内；匿名访问返回 `401`，非白名单返回 `403`。
- 不得在仓库中提交包含真实参与者数据的导出文件。仓库 `.gitignore` 已忽略 `exports/`、
  `*.csv`、`data-export/`、`participants*.json` 等路径。

---

## 9. 常见问题

### `npm install` 报 `EACCES` / 缓存权限错误

见第 2 节：改用 `npm install --cache "$PWD/.npm-cache"`。不要使用 `sudo`。

### `npm run dev` 提示 5173 端口被占用

Vite 会自动尝试下一个可用端口，并在终端打印实际地址。也可以在 `vite.config.ts` 的
`server.port` 中改端口，或在命令后加 `--port 5174`。

### `npm run build` / `npm run typecheck` 报类型错误

`npm run build` 先执行 `tsc --noEmit`，类型错误会阻止构建与部署。
请在本地跑 `npm run typecheck` 定位并修好，**不要**改成 `npm run build:only` 绕过。

### `npm test` 失败或提示没有测试文件

`npm test` 会运行 `tests/` 下的 11 个测试文件（当前 241 个断言），全部应为通过。
如果提示找不到测试文件，说明 `tests/` 被清空或工作目录不对（必须在项目根目录执行）。
如果某个测试失败，通常意味着研究数据被改动而设计校验未通过
（例如矩阵秩不再等于 3、属性水平失衡），**这属于研究设计问题，不是测试问题**。

### 提交时提示"当前未配置数据提交后端，且本环境不允许 Demo 模式提交"

这是预期行为：既没有配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，
也没有设置 `VITE_ALLOW_DEMO_MODE=true`。请配置 Supabase 公开变量（见
[DEPLOYMENT.md](./DEPLOYMENT.md)），而不是在前端代码里放开限制。

### 提交时提示"服务器未配置数据库连接"

即 `/api/submit-survey` 返回了 `503` + `mode: 'demo'`：服务端的
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 未配置。这与前端是否配置无关，
需要在部署平台补齐**服务端**变量并重新部署。

### 页面显示 `[待填写：…]`

这是设计行为：研究团队尚未确认的字段会显式标注为占位符，不会编造内容。
填写方式见第 6.1 节。

### 模拟视频区域显示"模拟事件视频（占位）"

把获得授权的 MP4 放到 `public/videos/fall-demo.mp4` 即可。
`src/features/simulation/VideoPreview.tsx` 会先用 `HEAD` 请求探测文件是否存在，
缺失时降级为占位界面，**不会**导致页面报错。视频为本地静态资源，不加载任何外部媒体源，
也不会请求摄像头权限。
