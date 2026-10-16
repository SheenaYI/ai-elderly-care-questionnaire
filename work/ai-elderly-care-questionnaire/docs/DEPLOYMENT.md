# 部署指南（DEPLOYMENT）

本文档说明如何把「智能养老AI监测系统配置偏好与采纳意愿调查」问卷平台部署到
**Netlify（本项目实际采用）** 与 **Vercel（同样可用，代码已兼容）**。

> 本项目已确定使用 **Netlify**，因此第 3 节是主路径；第 1 节的 Vercel 说明保留，
> 以便日后切换（两个平台的业务代码完全共用，无需改动）。

相关文档：

- 本地开发与环境变量含义：[SETUP.md](./SETUP.md)
- 数据表结构与编码：[DATA_DICTIONARY.md](./DATA_DICTIONARY.md)
- 研究设计审查：[RESEARCH_NOTES.md](./RESEARCH_NOTES.md)

> **本文档不含任何真实密钥或真实项目地址。** 所有示例一律使用
> `<your-project-ref>`、`<your-anon-key>` 等占位符。请勿把真实值写进文档、代码或 Git。

---

## 0. 部署前必须完成的四件事

在把站点放到公网之前，以下四项缺一不可。**未完成时站点只能用于内部试填与演示，
不得用于正式数据收集。**

| 检查项 | 要求 | 依据 |
|---|---|---|
| 伦理审查 | 取得所在单位伦理审查意见（含编号，或"无需编号"的书面意见与日期） | V1.0 第六部分；`[待填写：伦理审批编号]` |
| Pilot 试填 | 先 3–5 人认知访谈，再 20–30 人完整试填，并据此修订 | V1.0 第六部分 |
| 占位字段填写 | `src/data/placeholders.ts` 中 9 个字段全部填写完毕（`isLaunchReady()` 返回 `true`） | SETUP.md 第 6.1 节 |
| 数据库就绪 | `supabase/schema.sql`（或迁移）已执行，表结构、约束与 RLS 策略均已生效 | DATA_DICTIONARY.md |

**在伦理审查与 Pilot 完成之前，本站点不得作为正式发放渠道。**
站点的 `index.html` 已设置 `<meta name="robots" content="noindex, nofollow">`，
不会被搜索引擎收录，但这**不是**合规替代品。

---

## 1. 环境变量总览

平台的环境变量设置（Vercel 的 Environment Variables / Netlify 的 Environment variables）
分为两类，**务必分清**。

### 1.1 PUBLIC：会进入浏览器产物（`VITE_` 前缀）

Vite 在**构建时**把 `VITE_` 开头的变量内联进前端 JavaScript。
因此这些值任何访问者都能读到，**不能放任何秘密**。

| 变量名 | 是否必需 | 示例值 | 说明 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | 真实提交必需 | `https://<your-project-ref>.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | 真实提交必需 | `<your-anon-key>` | anon 公钥；本身公开，安全性由 RLS 保证 |
| `VITE_SUBMIT_ENDPOINT` | 可选 | `/api/submit-survey` | 默认值即为此，通常无需设置 |
| `VITE_QUESTIONNAIRE_VERSION` | 可选 | `V1.0` | 必须与 `src/data/questionnaire.ts` 的 `QUESTIONNAIRE_VERSION` 一致 |
| `VITE_ALLOW_DEMO_MODE` | 可选 | 生产环境**留空** | 设为字符串 `true` 才允许"无后端时提交"。生产环境**不要**设置 |

**重要：`VITE_` 变量是构建期内联的。** 修改它们之后必须**重新部署**（Redeploy），
只重启服务或刷新页面不会生效。

### 1.2 SERVER-ONLY：只存在于服务端，绝不进入浏览器

这些变量由 `api/submit-survey.ts` 与 `api/admin/export.ts` 通过 `process.env` 读取，
只配置在平台的环境变量设置中。

| 变量名 | 是否必需 | 说明 | 秘密等级 |
|---|---|---|---|
| `SUPABASE_URL` | 服务端必需 | 服务端读写数据库使用的项目 URL | 低（与公开 URL 通常相同） |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端必需 | 绕过 RLS 的密钥，用于服务端写入与导出 | **绝密** |
| `RESEARCH_ADMIN_ALLOWLIST` | 可选 | 逗号分隔的管理员邮箱。**仅作补充说明用途**；真正的权限判定始终以数据库 `research_admins` 白名单为准 | 私有 |

**权威模板是项目根目录的 `.env.example`**（只含占位符，可提交到 Git）。
上表与该模板一致；若两者出现差异，以 `.env.example` 为准。

### 1.3 安全红线（逐条执行，不要"灵活处理"）

1. **`SUPABASE_SERVICE_ROLE_KEY` 绝不能加 `VITE_` 前缀。**
   一旦写成 `VITE_SUPABASE_SERVICE_ROLE_KEY`，该密钥会被构建进前端产物并公开发布，
   等同于把数据库的完全控制权交给任何访问者。**这是本项目最严重的一类事故。**

2. **`.env`、`.env.local`、`.env.*` 绝不提交到 Git。**
   仓库 `.gitignore` 已包含 `.env`、`.env.*`，并保留 `!.env.example` 例外。
   密钥只允许存在于平台的环境变量设置中。

3. **不要在前端代码中读取不带 `VITE_` 前缀的变量。**
   前端读不到它们（会得到 `undefined`），而且任何试图"让前端也能读到"的改造
   都会导致密钥泄露。前端只用 anon 公钥。

4. **不要把 service_role key 打印到日志、错误信息或前端提示中。**
   `src/lib/config.ts` 与 `src/lib/supabase/client.ts` 明确不读取、不打印、不记录任何密钥值；
   新增代码必须保持这一约束。

5. **环境变量作用域选择：** 生产密钥建议只授予 Production（必要时含 Preview），
   不要授予会被 Fork PR 触发的预览环境。

6. **密钥泄露后的处置：** 立即在 Supabase 控制台轮换（rotate）该密钥，
   更新平台环境变量并重新部署；同时检查数据库审计日志。
   删除前端代码并不会使已发布的密钥失效。

---

## 2. 主方案：部署到 Vercel

### 2.1 连接 GitHub 仓库

1. 把代码推送到 GitHub 仓库（默认分支建议 `main`）。
2. 登录 Vercel，选择 **Add New → Project**。
3. 在 **Import Git Repository** 中授权并选择该仓库。
4. Vercel 会自动识别 Vite 项目。确认构建设置（下表），然后点 **Deploy**。

之后的每一次推送都会自动生成新部署；Pull Request 会生成预览部署（Preview Deployment）。

### 2.2 构建设置

| 设置项 | 取值 | 说明 |
|---|---|---|
| Framework Preset | `Vite` | 通常可自动识别 |
| Build Command | `npm run build` | 等价于 `tsc --noEmit && vite build`，**包含类型检查** |
| Output Directory | `dist` | 与 `vite.config.ts` 的 `build.outDir` 一致 |
| Install Command | `npm install` | 平台环境通常无本机缓存权限问题，无需 `--cache` |
| Node.js Version | `20.x` 或更高（≥18） | 项目要求 Node 18+；建议固定为 20.x LTS |

注意：`npm run build` 会先跑 `tsc --noEmit`。**类型检查失败会导致部署失败，这是有意的**
——不要把构建命令改成 `npm run build:only` 来绕过类型错误。

### 2.3 SPA 重写（React Router 必需）

前端使用 `react-router-dom` 的 `BrowserRouter`（见 `src/main.tsx`），
路由包括 `/`、`/experience`、`/about`、`/privacy`、`/questionnaire`、
`/questionnaire/:step`、`/admin`、`/404`。

如果没有重写规则，用户直接访问 `https://<your-domain>/about` 或刷新该页会得到 404。
仓库根目录**已包含** `vercel.json`，内容如下（可直接使用）：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/questionnaire/:step", "destination": "/index.html" },
    { "source": "/questionnaire", "destination": "/index.html" },
    { "source": "/experience", "destination": "/index.html" },
    { "source": "/about", "destination": "/index.html" },
    { "source": "/privacy", "destination": "/index.html" },
    { "source": "/admin", "destination": "/index.html" },
    { "source": "/404", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    { "source": "/api/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-store" }] }
  ]
}
```

**为什么使用"逐条列出前端路由"而不是 `"/(.*)"` 兜底？**

兜底写法（`{"source": "/(.*)", "destination": "/index.html"}`）会把
**真实存在的静态文件**也重写成 `index.html`，最典型的受害者是：

- `/videos/fall-demo.mp4` —— 研究团队的演示视频，被重写后视频永远加载不出来
  （`VideoPreview` 会退化为占位界面）；
- `/assets/*.js`、`/assets/*.css` —— 构建产物，一旦被重写页面直接白屏。

逐条列出路由可以完全避免这类问题：只有明确列出的前端路由才回退到 `index.html`，
静态资源与 `api/` 函数都按文件系统正常命中。

> 注意：请**不要**同时使用 `routes` 与 `rewrites` / `redirects` / `headers`，Vercel 不允许混用。
> 本仓库只使用 `rewrites` + `headers`。

> 若改用 Netlify：无需任何业务代码改动。`netlify/functions/` 已提供适配层，
> `netlify.toml` 与 `public/_redirects` 已提供 API 转发与 SPA 回退，
> 详见第 3 节（含 Base directory 这个最容易踩的坑）。



无论采用哪种写法，部署后都必须验证 `/api/submit-survey` 仍然返回**函数的响应**
而不是被回退成 `index.html`——见第 4 节验证清单第 15 项。

### 2.4 Serverless Functions 的位置与识别方式

- 服务端接口位于项目根目录的 **`api/`** 目录。Vercel 会自动把该目录下的文件识别为
  Serverless Functions，**无需任何额外配置**。
- 文件路径直接映射为 URL：

  | 文件 | 路由 | 方法 | 作用 |
  |---|---|---|---|
  | `api/submit-survey.ts` | `/api/submit-survey` | `POST` | 问卷提交（唯一写入通道），前端默认 `VITE_SUBMIT_ENDPOINT` 即指向它 |
  | `api/admin/export.ts` | `/api/admin/export` | `GET` | 研究数据 CSV 导出，需登录 + 白名单 |

- 以 `_` 开头的文件/目录**不会被暴露为路由**，因此
  `api/_lib/` 预留给服务端共享代码（校验、数据库客户端等）。
- 前端**不直接写数据库**：提交统一走 `/api/submit-survey`，由服务端做权威校验、
  版本检查与重复提交检查。这是 `src/lib/submission.ts` 的既定设计。

两个接口文件都使用了 `service_role` 客户端，因此**必须**在服务端环境变量中配置
`SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`，否则接口会返回 `503`（提交）或 `503`（导出）。

### 2.5 在 Vercel 添加环境变量

路径：**Project → Settings → Environment Variables**。

按第 1 节的两张表逐项添加（或直接照 `.env.example` 抄），并正确选择 Environments：

| 变量名 | Environments | 类别 |
|---|---|---|
| `VITE_SUPABASE_URL` | Production, Preview, Development | PUBLIC |
| `VITE_SUPABASE_ANON_KEY` | Production, Preview, Development | PUBLIC |
| `VITE_SUBMIT_ENDPOINT` | 可不设置（有默认值） | PUBLIC（可选） |
| `VITE_QUESTIONNAIRE_VERSION` | Production, Preview | PUBLIC（可选） |
| `VITE_ALLOW_DEMO_MODE` | **生产环境设为 `false` 或不设置** | PUBLIC（可选） |
| `SUPABASE_URL` | Production, Preview | SERVER-ONLY |
| `SUPABASE_SERVICE_ROLE_KEY` | Production（必要时 Preview） | SERVER-ONLY（绝密） |
| `RESEARCH_ADMIN_ALLOWLIST` | 可不设置 | SERVER-ONLY（可选） |

添加或修改 `VITE_*` 变量后，**必须重新部署**才能生效（构建期内联）。

### 2.6 Supabase 侧准备

1. 创建 Supabase 项目，记录 Project URL、anon 公钥（公开）以及 service_role key（绝密）。
   区域建议选离研究对象最近的区域（例如 Singapore / Tokyo）。
2. 建库（二选一，**不要重复执行**）：
   - 控制台 → **SQL Editor** → 粘贴执行 `supabase/schema.sql`（单文件版，最省事）；
   - 或用 Supabase CLI / `psql` 按顺序执行
     `supabase/migrations/0001_init.sql` → `0002_rls_policies.sql` → `0003_grants.sql`。
   详细步骤见 `supabase/README.md` 第 3 节。
3. 执行后确认：
   - 9 张研究表 + `research_admins` 已创建，`analysis_long` 视图与
     `submit_survey()` 函数已创建；
   - `questionnaire_versions` 中已有 `V1.0` 且 `is_active = true`
     （`schema.sql` 的种子数据会插入，但**必须实际确认**）。
4. **验证 RLS 与权限（不要只看"RLS 已开启"）。** 逐条执行
   `supabase/README.md` 第 8 节的自检查询：
   - 每张表 `relrowsecurity = true`；
   - 面向 `anon` 的策略数为 0；
   - `anon` 的表级权限为 0；
   - 再用 anon key 实际试读，确认返回 `permission denied for table participants`
     （而不是返回数据），并确认匿名调用 `submit_survey` 同样被拒绝。
5. **开启 Auth（邮箱 + 密码）并关闭公开注册。**
   本项目只有研究团队少数几个账号，必须由负责人手工创建。
6. 在 `research_admins` 中插入管理员邮箱（**大小写不敏感，建议统一小写**）：

   ```sql
   insert into public.research_admins (email, note)
   values ('<admin-email>', '课题负责人')
   on conflict (email) do nothing;
   ```

   注意：**"创建 Auth 用户"与"写入 `research_admins`"两步都要做，缺一不可。**
   登录成功不等于能看数据；不在白名单的已登录账号会被 RLS 挡在外面（返回 0 行）。
7. 确认代码常量 `QUESTIONNAIRE_VERSION`（`src/data/questionnaire.ts`）与
   `questionnaire_versions.id` 完全一致。

### 2.7 自定义域名与访问控制

- 建议使用自定义域名，便于长期发放与参与者记忆。
- `index.html` 已设置 `noindex, nofollow`，不会被搜索引擎收录；若在 Vercel 侧需要
  额外阻止抓取，可在 `robots.txt` 中进一步限制（属可选加固）。
- 不建议用 Vercel 的 Deployment Protection（SSO 保护）挡住参与者端：它会让普通参与者
  无法访问。访问控制应放在 `/admin` 路由与数据库 RLS 层，而不是整个站点。
- 若需要限制填写人数或时间窗，应在数据库层实现（例如在 `research_config` 中加开关），
  而不是依赖平台功能。

---

## 3. 部署到 Netlify（本项目采用）

### 3.1 连接仓库与构建设置

路径：**Add new site → Import an existing project**，选择同一 GitHub 仓库。

| 设置项 | 取值 |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `api`（**必须显式配置**，见 3.3） |
| Node version | 20（可通过 `NODE_VERSION` 环境变量或 `.nvmrc` 固定） |

### ⚠️ 最常见的 Netlify 全站 404 原因：Base directory

**本仓库的根目录下没有 `package.json`** —— 应用位于子目录
`work/ai-elderly-care-questionnaire/`。如果 Netlify 从仓库根构建：

1. 找不到 `package.json`，构建产物为空；
2. `publish = "dist"` 指向不存在的目录；
3. 于是**每一个路径**（包括首页 `/`）都返回 Netlify 自己的 "Page not found"。

**正确配置（推荐在 Netlify UI 的 Site configuration → Build & deploy 里设置）：**

| 设置项 | 值 |
|---|---|
| Base directory | `work/ai-elderly-care-questionnaire` |
| Build command | `npm run build` |
| Publish directory | `dist` |

`Base directory` 一旦设置，`Build command` 与 `Publish directory`
都**以该目录为基准**（所以是 `dist`，不是 `work/ai-elderly-care-questionnaire/dist`），
`netlify.toml` 也会从该目录读取。

如果不想设置 Base directory，可改用仓库根构建，此时把 `netlify.toml` 的
`[build]` 换成：

```toml
[build]
  command = "cd work/ai-elderly-care-questionnaire && npm ci && npm run build"
  publish = "work/ai-elderly-care-questionnaire/dist"
```

### SPA 回退：为什么逐条列路由而不是 `/*` 兜底

`netlify.toml` 与 `public/_redirects`（构建时复制到 `dist/_redirects`）**都已提供**
同一套回退规则，互为兜底 —— 即使 Netlify 因 Base directory 配置而忽略了
`netlify.toml`，`public/_redirects` 依然生效。

两者都**逐条列出**前端路由，而不是用 `/*  /index.html  200`：

- 笼统的 `/*` 会把**缺失的静态文件**也改写成 `index.html`。
  例如 `/videos/fall-demo.mp4` 在视频尚未提供时会返回 `200 text/html`，
  而 `VideoPreview` 会因此误判"视频存在"，渲染出坏掉的 `<video>`
  而不是友好的占位界面（这正是 `tests/videoFallback.test.ts` 覆盖的场景）。
- 逐条列出可审计：只有真正的前端路由回退到 SPA 入口。

已用模拟 Netlify `_redirects` 语义的静态服务器验证过（构建产物 + 规则文件）：

| 路径 | 结果 |
|---|---|
| `/`、`/experience`、`/about`、`/privacy` | 200，SPA 入口 |
| `/questionnaire`、`/questionnaire/consent`、`/questionnaire/dce` | 200，SPA 入口 |
| `/admin`、`/404` | 200，SPA 入口 |
| `/assets/nope.js`（不存在的静态文件） | 404（**不会**被改写成 HTML） |
| `/videos/fall-demo.mp4`（尚未提供） | 404（因此正确降级为占位界面） |

建议在项目根目录创建 `netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "api"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3.2 SPA 重定向（React Router 必需）

与 Vercel 同理，必须把未知路径回退到 `index.html`，否则直接访问
`/about`、`/questionnaire`、`/admin` 或刷新页面会 404。

两种等价方式（选其一）：

1. `netlify.toml` 中的 `[[redirects]]`（见 3.1）。
2. 在 `public/` 目录下放置 `_redirects` 文件（Vite 会把 `public/` 原样复制到 `dist/`，
   因此 Netlify 能读到它）：

```text
/api/*   /.netlify/functions/:splat   200
/*       /index.html                  200
```

**规则顺序很重要：** Netlify 按顺序匹配，**第一条命中的规则生效**。
`/api/*` 规则必须写在 `/*` 规则**之前**，否则 API 请求会被回退成 `index.html`。

注意：`status = 200` 表示 rewrite（URL 不变），这与 SPA 的需求一致；
不要用 `301` / `302`。

### 3.3 函数目录与检测方式（与 Vercel 的差异，务必注意）

**Netlify 不会自动识别项目根目录的 `api/`。**
它与 Vercel 的约定不同，因此必须显式处理，二选一：

- **方案 A（推荐，改动最小）：** 在 `netlify.toml` 的 `[functions]` 中把
  `directory` 设为 `api`，并用 `/api/* → /.netlify/functions/:splat` 的 rewrite
  把对外路径映射回去。这样前端默认的 `/api/submit-survey` 依然有效。
- **方案 B：** 把服务端函数移动到 `netlify/functions/`（Netlify 的默认目录），
  并相应调整前端 `VITE_SUBMIT_ENDPOINT`。

**函数签名差异（Netlify 需要额外工作量）：** 本仓库的两个接口文件都是
**Vercel / Node HTTP 风格**——`export default async function handler(req, res)`，
使用 `req.method` / `req.headers` / `req.body`（已自行声明最小类型，因为项目未安装
`@vercel/node`）。Netlify Functions 用的是 Web 标准的 `Request` / `Response`，
签名不同，因此 `api/` 下两个文件不能直接作为 Netlify 函数入口。

**解决方案（已实现）：薄适配层，业务逻辑仍然只有一份。**

```
netlify/functions/
  _lib/adapter.ts        # Request → Vercel 风格 req/res → Response
  submit-survey.ts       # import ../../api/submit-survey 后包一层
  admin-export.ts        # import ../../api/admin/export   后包一层
```

- 以 `_` 开头的目录不会被 Netlify 当作函数入口暴露，因此 `_lib/` 是安全的放置位置。
- Netlify 使用 esbuild 打包，会跟随 import 到 `netlify/functions/` **之外**的
  `api/` 与 `src/`，所以校验、限流、版本检查、重复提交检查、CSV 生成全部复用原实现，
  **不存在两套逻辑漂移的风险**。若日后改回 Vercel，删掉 `netlify/` 与
  `_redirects` 里的 API 规则即可，业务代码零改动。
- 适配层做了三件容易被忽略的事：
  1. **请求体**：读取原始字节后交给 handler 自行解析（handler 同时支持
     string / Buffer / 已解析对象），因此体积守卫读到的是真实字节数。
  2. **客户端 IP**：优先取 Netlify 的 `context.ip`，其次
     `x-nf-client-connection-ip`，再退到 `x-forwarded-for`，用于限流分桶。
  3. **响应头规范化**：`Headers` 只接受 ISO-8859-1，而导出接口会返回含中文的
     `Content-Disposition`；适配层把非 ASCII 字符替换掉，避免构造响应时抛
     `TypeError` 导致导出直接失败（该行为有专门的测试覆盖）。

**已验证**：`tests/netlifyAdapter.test.ts`（20 个用例）以 Netlify 的真实调用方式
（`new Request(...)`）调用包装后的函数，断言真实状态码与响应头，覆盖
405 / 503 / 429 / 413 / 400 / 401 / 403 / 204 以及请求体、查询参数、IP、头部规范化。

### 3.4 在 Netlify 添加环境变量

路径：**Site configuration → Environment variables**。
变量清单与第 1 节完全相同，作用域选择 Production / Deploy previews / Branch deploys。

- `VITE_*` 变量同样是构建期内联，修改后必须 **Trigger deploy → Clear cache and deploy site**。
- `SUPABASE_SERVICE_ROLE_KEY` 同样只配置在 Netlify 环境变量中，
  **绝不加 `VITE_` 前缀，绝不提交到仓库**。
- Netlify Functions 默认能读取站点环境变量；请确认函数的变量作用域包含当前部署上下文。

---

## 4. 部署后验证清单

部署完成后**逐项**执行以下检查。这是上线前的最后一道人肉防线，
每一项都对应代码中的一条设计约束。建议在桌面端与移动端各做一遍。

| # | 检查项 | 操作 | 期望结果 | 依据 |
|---|---|---|---|---|
| 1 | 首页可加载 | 访问站点根路径 `/` | 首页正常渲染，无空白页、无控制台报错；显示研究名称与"开始填写"入口 | `src/app/router.tsx`、`src/pages/HomePage.tsx` |
| 2 | 右侧导航可用 | 在桌面宽度（≥1024px）下观察 | 右侧固定导航显示"参与研究 / 情景体验 / 研究介绍 / 隐私与知情同意"四项，点击均可跳转，当前项高亮 | `NAV_ITEMS`（`src/components/layout/SiteNav.tsx`） |
| 3 | 移动端导航折叠 | 缩小窗口到手机宽度，点击"菜单" | 导航折叠为顶部菜单按钮，点击后弹出抽屉；Esc 可关闭；抽屉打开时背景滚动被锁定 | `SiteNav` 的抽屉逻辑 |
| 4 | 同意拒绝会阻止继续 | 在 `/questionnaire` 的 Q1 选择"不同意（结束）" | 流程停止，不能进入后续模块；界面明确说明未同意即结束，不出现任何继续按钮 | `Q1_CONSENT`、`setConsent()`、`checkCompletion()`（consent 项缺失会列为未完成） |
| 5 | 理解检查会解释错误答案 | 在 Q6/Q7 故意选错 | 立即展示正确解释（Q6：仅限制"接收者能看到什么"，不降低识别能力；Q7：基础检测持续，异常时才启动详细记录），允许重新阅读后继续；数据库仍记录**首次**作答结果 | `COMPREHENSION_QUESTIONS[].explanation`、`recordComprehension()` |
| 6 | A/B 卷只分配一次且刷新稳定 | 进入 DCE 模块，记录卷别（A 或 B）；按 F5 刷新多次 | 卷别始终不变；题目集合与左右位置也不变 | `ensureBlockAndPlan()` + 草稿持久化（`aiecq:draft:v1`） |
| 7 | 恰好 6 道 DCE 题 | 走完整个 DCE 模块 | 进度显示 1–6，共 6 题，不多不少；题目全部属于同一卷别 | `TASKS_PER_BLOCK = 6`、`dceChoicesSchema.length(6)` |
| 8 | 返回上一题不会重新随机 | 做到第 3、4 题后点"上一题"回看 | 已看过的题目仍按原顺序、原左右位置展示，题干与方案不重排 | `dceTaskOrder` 一次写入后只读；随机化函数为纯函数 |
| 9 | 4 配置 × 12 题 | 走完配置感知评价模块 | 共评价 4 个**不同**配置，每个配置 12 个评分题（5 点 Likert）；4 个配置的组成为平衡分配的 4 个，不重复 | `PROFILES_PER_PARTICIPANT = 4`、`SCALE_ITEM_COUNT = 12`、`buildRatingPlan()` |
| 10 | 提交校验 | 故意跳过一个模块（如 Q9 不选）后尝试提交 | 提交被阻止并列出**具体缺失项**（如"总体评价：Q8、Q9 尚未作答"），而不是笼统报错 | `checkCompletion()`、`submissionSchema`、`validateSubmissionSemantics()` |
| 11 | 草稿可恢复 | 填写一部分后关闭标签页，重新打开站点 | 提示存在未完成草稿并可恢复；恢复后已填内容、卷别、题目顺序、左右位置全部保留 | `loadDraft()`、`restore()`、`hasRestoredDraft` |
| 12 | `/admin` 拒绝匿名访问 | 用无痕窗口直接访问 `/admin` | 显示登录界面或被拒绝，**不得**展示任何参与者数据、统计或导出入口 | 懒加载 `AdminPage` + Supabase Auth + RLS |
| 13 | 缺失视频不崩溃 | 在 `/experience` 打开模拟事件视频区域（`public/videos/fall-demo.mp4` 不存在时） | 显示"模拟事件视频（占位）"提示与放置路径说明，页面其余部分功能正常，控制台无未捕获错误 | `VideoPreview.tsx`（先 `HEAD` 探测，失败降级） |
| 14 | 缺失 Supabase 配置显示明确提示 | 暂时移除 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 后重新部署并访问 | 明确显示"Demo 模式（数据不会保存到云端）"及说明，**不得**在任何位置声称数据已保存到服务器；提交时如实说明数据仅留在本机 | `detectDataMode()`、`dataModeNotice()`、`submitSurvey()` |
| 15 | API 路由未被 SPA 重写吞掉 | 对 `/api/submit-survey` 发送一个 `POST`（可用开发工具伪造最小载荷） | 返回 JSON（校验失败信息也算通过），**不是** `index.html` 的 HTML 内容 | 第 2.3 / 3.2 节的重写规则 |
| 16 | 隐私与占位符如实展示 | 访问 `/privacy` 与页脚 | 研究联系人、伦理审批编号、数据保存期限等未确认字段显示为 `[待填写：…]`，未被编造填充 | `src/data/placeholders.ts`、`SiteFooter.tsx` |
| 17 | 深链接与刷新可用 | 直接访问并刷新 `/about`、`/privacy`、`/questionnaire`、`/questionnaire/3` | 全部正常渲染，不出现 404 或空白页 | `vercel.json` / `netlify.toml` 重写规则 |
| 18 | 正式模式下数据真的落库 | 在真实提交模式下完整填写并提交一份测试答卷，然后查库 | `participants`、`survey_sessions`、`survey_responses`、`dce_choices`（6 条）、`profile_ratings`（4 条）、`comprehension_checks`（2 条）均有对应记录，且 `questionnaire_version` 正确 | DATA_DICTIONARY.md 第 2 节 |
| 19 | 导出接口要求登录与白名单 | 无痕窗口直接 `GET /api/admin/export?dataset=merged`；再带一个非白名单账号的 token 试一次 | 无 token 返回 **401**；非白名单账号返回 **403**；白名单账号返回 CSV（UTF-8 BOM，Excel 打开中文不乱码）。任何情况下都不得在未授权时返回数据 | `api/admin/export.ts`、`supabase/README.md` 第 4 节 |
| 20 | 匿名 key 读不到任何数据 | 用 anon 公钥直接请求 PostgREST，例如 `GET <SUPABASE_URL>/rest/v1/participants?select=*` | 返回 `permission denied for table participants`，**不是**数据行 | `supabase/migrations/0003_grants.sql`、`supabase/README.md` 第 8.3 节 |

> 第 1–14 项对应上线自检项，第 15–20 项是部署特有的补充检查。
> **任何一项不通过都不得开始正式数据收集。**

---

## 5. 重新部署、回滚与版本管理

- **常规更新：** 推送到 `main` 即自动部署。Vercel / Netlify 都会保留历史部署，
  可一键回滚到上一个可用版本。
- **修改研究内容的更新：** 必须同时提升 `QUESTIONNAIRE_VERSION`
  （`src/data/questionnaire.ts`），并在 `questionnaire_versions` 中登记新版本、
  把旧版本置为 `is_active = false`。详见 SETUP.md 第 7 节。
- **修改环境变量的更新：** `VITE_*` 是构建期内联，改完必须重新部署；
  服务端变量改动后也需重新部署以让函数读到新值。
- **回滚的数据影响：** 回滚代码**不会**回滚已写入数据库的答卷。
  如果某次部署存在研究设计错误，正确做法是登记新版本号并丢弃该版本区间的数据，
  而不是悄悄回滚后继续收集。

---

## 6. 常见问题

### 部署后直接访问 `/about` 得到 404

缺少 SPA 重写规则。按第 2.3 节（Vercel）或第 3.2 节（Netlify）补齐，
注意 Netlify 的规则顺序。

### 部署成功但 `/api/submit-survey` 或 `/api/admin/export` 返回 `index.html` 的 HTML

重写规则把 API 请求也回退了。Vercel 请确认使用了 `handle: filesystem` 的 `routes` 写法
或确认 `rewrites` 未覆盖函数；Netlify 请确认 `/api/*` 重定向写在 `/*` **之前**。

### 前端提示"未配置数据提交后端"

`VITE_SUPABASE_URL` 或 `VITE_SUPABASE_ANON_KEY` 没有生效。常见原因：
变量只配置在错误的 Environment（如只配了 Development）；或者改完变量没有重新部署。
先确认 `detectDataMode()` 返回 `supabase`（界面显示"真实数据提交模式"）。

### 提交时接口返回 `503`，提示"服务器未配置数据库连接"

前端的 `VITE_*` 配置与接口无关。`503` 表示服务端的
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 缺失（见 `api/submit-survey.ts` 的
`readServerEnv()`）。请在平台补齐**服务端**变量并重新部署。

### 导出接口返回 `401` 或 `403`

- `401`：缺少或无效的 `Authorization: Bearer <Supabase Auth access_token>`。
- `403`：token 有效，但该邮箱**不在** `research_admins` 白名单内。
  按 `supabase/README.md` 第 4 节把邮箱插入白名单（大小写不敏感）。
  注意"创建 Auth 用户"与"写入白名单"是两步，缺一不可。

### `npm run build` 在平台上失败，报 TypeScript 错误

`npm run build` 包含 `tsc --noEmit`，类型错误会阻止部署。请在本地先跑
`npm run typecheck` 修好，不要改成 `build:only` 绕过。

### 生产环境提交后数据显示为 Demo

检查是否误设了 `VITE_ALLOW_DEMO_MODE=true`，或 Supabase 公开变量缺失。
Demo 模式**不会**写入云端；如果这段时间在收集真实数据，这些答卷已经无法找回。

### 管理后台无法登录，或登录后看不到数据

分两步排查：

1. **登录**：确认 Supabase Auth 中已创建管理员账号（Authentication → Users），
   且 `/admin` 使用邮箱密码登录。若前端提示"无权限/不在白名单"，继续第 2 步。
2. **授权**：确认该邮箱已写入数据库 `public.research_admins`
   （`select * from public.research_admins;`）。登录成功**不等于**能读数据——
   RLS 策略要求邮箱在白名单内，否则查询返回 0 行。

**不要**为了排错而临时 `DISABLE ROW LEVEL SECURITY`，也不要把 service_role key
放到前端或临时开放 `anon` 的表权限。

### 如何临时只让部分人访问（例如 Pilot）

优先使用数据库层或应用层的开关（例如在 `research_config` 中设置开关、
或在试点期间不公开链接），而不是给整个站点加平台级登录保护，
以免参与者被挡在门外或后续忘记关闭。
