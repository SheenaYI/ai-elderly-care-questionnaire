# Supabase 部署与协作操作手册

《智能养老AI监测系统配置偏好与采纳意愿调查》的数据后端操作指南。

**适用读者**：负责建库、部署、测试与数据导出的人员。
**不需要**事先了解 PostgreSQL 或 Supabase。

> 本文是**操作手册**（按步骤点）。数据库结构的技术细节见
> [`supabase/README.md`](../supabase/README.md)，字段含义见
> [`docs/DATA_DICTIONARY.md`](./DATA_DICTIONARY.md)，部署整体流程见
> [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)。

---

## 目录

1. [开始之前：先理解三件事](#1-开始之前先理解三件事)
2. [最快路径（10 分钟）](#2-最快路径10-分钟)
3. [部署教程：从零建库](#3-部署教程从零建库)
4. [已有旧库？升级到 V1.1](#4-已有旧库升级到-v11)
5. [Netlify 环境变量配置](#5-netlify-环境变量配置)
6. [协作步骤：谁做什么](#6-协作步骤谁做什么)
7. [测试步骤：验收清单](#7-测试步骤验收清单)
8. [导出步骤：拿数据](#8-导出步骤拿数据)
9. [常见问题与排错](#9-常见问题与排错)（含 9.12 无部署额度时的本地验证）
10. [安全红线与权限管理](#10-安全红线与权限管理)

---

## 1. 开始之前：先理解三件事

### 1.1 数据库和网页是两件独立部署的东西

| 部署对象 | 托管在哪 | 谁来部署 |
|---|---|---|
| **数据库** | Supabase | 任意一个人建一次即可 |
| **网页 + 后端接口** | Netlify | Netlify 账号持有者 |

两者通过 **4 个环境变量**连接。数据库可以一个人建，网页继续由另一个人部署。

### 1.2 有两种数据模式，搞混会白收数据

| 模式 | 触发条件 | 数据去哪 |
|---|---|---|
| **Demo 模式** | 未配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | **只留在参与者自己的浏览器**，收不回来 |
| **真实模式** | 已配置上述变量 + 服务端两把变量 | 写入 Supabase |

> ⚠️ **Demo 模式下参与者会看到"完成"，但数据没有上传**。页面会明确提示，
> 但正式收集前必须确认已切成真实模式（首页不再显示黄色 Demo 提示）。
> 生产环境请把 `VITE_ALLOW_DEMO_MODE=false`。

### 1.3 参与者不需要账号，只有研究者需要

- **参与者**：匿名填写，系统生成随机编号（UUID），不登录。
- **研究者**：用邮箱 + 密码登录 `/admin` 后台，且邮箱必须在**白名单**里。

白名单是数据库侧的表 `research_admins`。不在其中的人，**即使注册并登录成功，
也读不到任何一行数据**——这是数据库层（RLS）强制的，不是前端隐藏。

---

## 2. 最快路径（10 分钟）

如果你只想尽快跑通：

1. Supabase 新建项目（区域选 Singapore / Tokyo）
2. **SQL Editor** → 粘贴整个 `supabase/schema.sql` → **Run**
3. **Authentication** → 启用 Email、**关闭公开注册** → 手动创建你的管理员账号
4. **SQL Editor** 执行：`insert into public.research_admins (email) values ('你的邮箱');`
5. Netlify → **Environment variables** 加 4 个变量（见第 5 节）
6. Netlify → **Deploys → Clear cache and deploy site**
7. 打开网站：不再显示 Demo 提示 → 填完问卷提交 → 到 Supabase 的 `participants` 表确认有记录
8. 打开 `/admin` 登录 → 导出 `participants.csv`

下面每一节是这些步骤的详细展开。

---

## 3. 部署教程：从零建库

### 步骤 1：创建 Supabase 项目

1. 打开 <https://supabase.com>，用 GitHub 或邮箱注册/登录
2. 点 **New project**
3. 填写：

   | 字段 | 填什么 | 说明 |
   |---|---|---|
   | Organization | 默认即可 | 个人账号会自动建一个 |
   | Name | `aiecq-test` | **建议名字带 test**，避免误认为生产库 |
   | Database Password | 自己生成强密码 | 存进密码管理器；日常操作基本用不到它 |
   | Region | **Southeast Asia (Singapore)** 或 **Northeast Asia (Tokyo)** | 离国内近，延迟低 |
   | Plan | Free | 测试阶段够用 |

4. 点 **Create new project**，等 1–2 分钟完成初始化

> 💡 Free 计划的项目如果**长期无访问会被暂停**。测试期间如果隔了几周没用，
> 打开控制台可能需要点一下 **Restore**。正式收集数据前请留意这一点。

### 步骤 2：建表（一次粘贴即可）

1. 左侧菜单 → **SQL Editor** → **New query**
2. 打开本仓库的 `supabase/schema.sql`，**全选 → 复制 → 粘贴**到编辑器
3. 点右下角 **Run**（或 `Cmd/Ctrl + Enter`）

**关于这个脚本**

- 它包含全部 4 个迁移（`0001`–`0004`）的内容，**不需要改任何内容**
- 完全幂等（`IF NOT EXISTS` / `CREATE OR REPLACE`），失败后修好可重跑
- 会顺带注册问卷版本 `V1.0` 与 `V1.1`——**这两个版本号是提交时的校验条件**，
  缺了会导致提交被拒

**验证成功**：左侧 **Table Editor** 应能看到 **11 张表**：

```
research_admins          questionnaire_versions   research_config
participants             dce_choices              profile_ratings
comprehension_checks     simulation_events        survey_responses
survey_sessions          custom_config_choices
```

其中 7 张是研究数据表，`custom_config_choices` 是模块六「理想配置自由设定」。

### 步骤 3：开启登录，关闭公开注册

1. 左侧 **Authentication** → **Sign In / Providers** → **Email**
2. 启用 **Email** 登录
3. **务必关闭 "Allow new users to sign up"**

> 为什么：即使有人自行注册，他也进不了白名单、读不到数据；但不留这个口子更安全，
> 也避免垃圾账号。

### 步骤 4：创建管理员账号

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. 填写研究人员的**邮箱**与**密码**
3. **勾选 "Auto Confirm User"**（否则需要收邮件确认才能登录）

> 建议：每位研究者**一个独立账号**，不要共用。这样出问题时能定位到人。
> 是否给多人账号，见第 6 节与第 10 节的建议。

### 步骤 5：把人加入管理员白名单

这是**最后一道门**，也是新手最容易漏的一步。

回到 **SQL Editor** → 新建查询，把邮箱换成步骤 4 里的那个：

```sql
insert into public.research_admins (email)
values ('your-email@example.com');
```

**说明**

- 比对**不区分大小写**，大小写写错不影响
- 可以一次加多个：

  ```sql
  insert into public.research_admins (email)
  values
    ('a@example.com'),
    ('b@example.com')
  on conflict (email) do nothing;
  ```

- **移除权限**（离组、实习结束等）：

  ```sql
  delete from public.research_admins where lower(email) = lower('b@example.com');
  ```

  移除后**立即生效**——数据库每次查询都会实时核对白名单，不缓存。

### 步骤 6：抄下 4 个值

打开 **Project Settings → API**，记录以下内容：

| 名称 | 长什么样 | 敏感性 |
|---|---|---|
| **Project URL** | `https://abcdefgh.supabase.co` | 公开 |
| **anon public** | `eyJ...`（很长） | **公开**，安全性由 RLS 保证 |
| **service_role** | `eyJ...`（也很长） | **⚠️ 绝密** |

> ⚠️ **anon 和 service_role 长得几乎一样，务必看清标签**。拿错的表现：
> - 把 `anon` 当 `service_role` 用 → 提交失败（没有写权限）
> - 把 `service_role` 放进前端 → **等于把整库钥匙贴在网上**

---

## 4. 已有旧库？升级到 V1.1

**什么情况下需要看这一节**：你之前已经按 `0001`–`0003` 建过库，
现在要支持模块六（理想配置自由设定）。

**全新部署不需要**——`schema.sql` 已包含全部内容。

### 升级步骤

1. **确认当前版本**。在 SQL Editor 执行：

   ```sql
   select id, is_active from public.questionnaire_versions order by id;
   ```

   如果**只有 `V1.0`**，说明是旧库，继续往下。

2. **执行增量迁移**：打开 `supabase/migrations/0004_custom_config.sql`，
   全选粘贴 → **Run**。它会：
   - 新建 `custom_config_choices` 表
   - 开启 RLS 并加"仅白名单可读"策略
   - 对 `anon` 撤权

3. **更新写入函数**。`0004` 刻意**没有**重复粘贴 200 余行的函数体（避免两份实现漂移）。
   请用 `schema.sql` 中 `create or replace function public.submit_survey(...)`
   那一整段，替换旧函数——**整段替换，不要只改一部分**。

4. **注册新版本号**（关键，漏了会导致提交被拒）：

   ```sql
   insert into public.questionnaire_versions (id, description, is_active)
   values ('V1.1', '在 V1.0 基础上新增模块六「理想配置自由设定」', true)
   on conflict (id) do nothing;
   ```

   保留 `V1.0` 不动——已有数据需要它来溯源。

5. **自查**：

   ```sql
   -- 表存在（应为 0）
   select count(*) from public.custom_config_choices;

   -- RLS 已开（应为 true）
   select relrowsecurity from pg_class
    where oid = 'public.custom_config_choices'::regclass;

   -- 策略存在（应为 1 行）
   select polname from pg_policy
    where polrelid = 'public.custom_config_choices'::regclass;

   -- anon 无任何权限（应为 0 行）
   select privilege_type from information_schema.role_table_grants
    where grantee = 'anon' and table_name = 'custom_config_choices';
   ```

### 用 Supabase CLI 管理版本时

如果你会用 `supabase db push`，直接按顺序推送 `0001`→`0004` 即可，
不需要手动执行 `schema.sql`（内容等价）。

---

## 5. Netlify 环境变量配置

### 5.1 构建设置：**通常什么都不用设**

很多人会问："为什么 Build command 和 Publish directory 要我自己填？"
**答案是不用填** —— 本仓库已经在 `netlify.toml` 里声明了，Netlify 会自动读取。

```toml
# netlify.toml（仓库根目录，已随代码提交）
[build]
  command = "npm run build"
  publish = "dist"
```

Netlify 官方文档的两条规则决定了这一点：

1. **`netlify.toml` 里的设置会覆盖 UI 里的同名设置**
   —— 所以即使在 UI 里留空或填错，实际构建仍以文件为准。
2. **如果仓库里只有站点本身、且位于仓库根目录，Netlify 会自动识别构建设置**
   —— 本仓库正是这种情况（`package.json`、`index.html`、`vite.config.ts` 都在根上），
   会自动识别为 Vite 项目，默认就是 `npm run build` + `dist`。

**所以正确的做法是：保持默认，不要手动改。**

| 设置项 | 建议值 | 说明 |
|---|---|---|
| Base directory | **（留空）** | 根目录时默认就是仓库根 |
| Build command | 留空 / 默认 | `netlify.toml` 会提供 |
| Publish directory | 留空 / 默认 | `netlify.toml` 会提供 |

#### ⚠️ 唯一需要检查的情况：残留的旧 Base directory

如果你这个 Netlify 站点是**在项目搬到根目录之前**创建的，
UI 里可能残留了旧路径 `work/ai-elderly-care-questionnaire`。

**为什么必须清空它**：Base directory 决定 Netlify 去哪找 `package.json` 与
`netlify.toml`。如果它指向一个**已不存在的目录**，
Netlify 会先在那里失败，根本读不到根目录的 `netlify.toml`，于是：

- 构建失败（`package.json` 找不到），或
- 发布目录为空 → **全站 404**

**检查方法**：

**Project configuration → Developer settings → Continuous deployment → Build settings**

- 若 Base directory **是空的** → 不用做任何事 ✅
- 若显示 `work/ai-elderly-care-questionnaire` 或其他旧路径 → **清空它**，保存，然后重新部署

> 补充说明：如果你的站点**是从没配过 Base directory 的新建站点**，
> 那么连这一步都不用检查，直接跳到 5.2。

#### 什么情况下才需要手动填

| 情况 | 需要做什么 |
|---|---|
| 站点源码**不在**仓库根目录（例如在子目录） | 设 Base directory 指向该子目录 |
| 用了 monorepo（多个前端共存一个仓库） | 设 Base directory / Package directory |
| 想用**不同的**构建命令（本仓库不需要） | 在 UI 填，但会被 `netlify.toml` 覆盖——应改文件而非 UI |

本仓库不属于以上任何一种，所以**不需要手动配置**。

### 5.2 加 4 个环境变量

**Site configuration → Environment variables → Add a variable**，逐个添加：

| 变量名 | 值 | 作用域 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://你的ref.supabase.co` | All / Production |
| `VITE_SUPABASE_ANON_KEY` | anon public key | All / Production |
| `SUPABASE_URL` | `https://你的ref.supabase.co` | All / Production |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | All / Production |

**必须理解的规则**

- `VITE_` 开头 → 会被**打包进浏览器代码**，任何访客都能看到 → **只能放公开信息**
- 不带 `VITE_` → 只在 Netlify Functions 服务端可见 → service_role 放这里
- **绝不能**写 `VITE_SUPABASE_SERVICE_ROLE_KEY`——那等于把整库钥匙发给每个访客

### 5.3 重新部署

环境变量**改完不会自动生效**，必须重新部署：

**Deploys → Trigger deploy → Clear cache and deploy site**

---

## 6. 协作步骤：谁做什么

### 6.1 推荐分工

| 角色 | 负责 | 需要持有的凭据 |
|---|---|---|
| **A：数据库负责人**（1 人） | 建 Supabase 项目、跑 schema、建管理员、维护白名单、备份 | Supabase 项目 Owner |
| **B：部署负责人**（1 人） | 配 Netlify 环境变量、触发部署、验收 | `service_role` key |
| **C：数据分析者**（可多人） | 拿导出的 CSV 做分析 | 白名单账号（只读）**或**仅 CSV |

**核心理由**：`service_role` 能绕过全部权限，只应交给实际配置部署的那一个人。
其他人一律走"登录 + 白名单"这条路——这样移除权限只需删一行，
而且**立即生效**（service_role 不受白名单约束，给了就收不回，只能轮换密钥）。

### 6.2 交接清单：A 交给 B 什么

按敏感度排序：

| 内容 | 传递方式 | 能否进 Git |
|---|---|---|
| Project URL | 微信/邮件均可 | ✅ 可以（公开） |
| **anon public key** | 微信/邮件均可 | ✅ 可以（公开） |
| **service_role key** | ⚠️ **密码管理器共享** / 当面 / 阅后即焚 | ❌ **绝对不行** |

> 建议用 1Password / Bitwarden 的"共享条目"功能，或当面口头+临时消息。
> **不要**发在微信群、QQ 群、公开仓库、Issue、截图里。

### 6.3 团队协作的三个约定

1. **一个测试库，一个生产库**
   - 测试：`aiecq-test`，随便折腾，可清库
   - 生产：`aiecq-prod`，**开始收数据后不得清库**
   - 切换方式：改 Netlify 环境变量指向另一个项目，重新部署

2. **每人独立账号，不共用**
   - 便于追溯；离组时精确移除

3. **导出统一由 1 人负责（可选但推荐）**
   - 当前导出接口**没有记录"谁导出了什么"**。多人导出时事后无法追溯。
   - 如果需要，可以新增审计日志表（可作为后续增强项）。

### 6.4 如果另一个人要独立测试（不动生产库）

他可以自己建一个 Supabase 项目，按第 3 节走一遍，然后：

- **只测前端**：本地 `npm run dev`，在 `.env` 里填自己项目的两个 `VITE_` 变量
- **测完整链路**：需要 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`，
  但 Netlify 环境变量是**全站共享**的，改它会影响到线上站点

> 因此建议：独立测试用**本地 `netlify dev`**（或直接在本地跑接口），
> 不要在共享的 Netlify 站点上反复切数据库。

---

## 7. 测试步骤：验收清单

> ⚠️ **这套 SQL 未经真实 PostgreSQL 运行验证过**（开发环境无可用数据库）。
> 因此第一次执行后，请**逐项**完成下面的验收。任何一项失败，请记录
> 完整报错信息（含 SQL 错误码）以便修正。

### 7.1 环境检查

| # | 操作 | 期望结果 | 失败通常意味着 |
|---|---|---|---|
| 1 | 打开网站首页 | **不再显示**黄色"Demo 模式"提示 | `VITE_` 变量没配对，或没重新部署 |
| 2 | 打开 `/admin` | 出现**登录框**（而不是"后台尚未配置"） | 同上 |

### 7.2 提交链路

| # | 操作 | 期望结果 | 佐证 |
|---|---|---|---|
| 3 | 完整填一遍问卷（含模块六）并提交 | 显示「**您的回答已成功提交。**」 | 不是 Demo 提示 |
| 4 | Supabase → Table Editor → `participants` | 出现 1 条 `submission_status = submitted` | 主表写入 |
| 5 | 看 `dce_choices` | 恰好 **6 条** | 选择题落库 |
| 6 | 看 `profile_ratings` | 恰好 **4 条**，各自 12 个评分列都有值 | 量表落库 |
| 7 | 看 `comprehension_checks` | 恰好 **2 条**（Q6、Q7） | 理解检查落库 |
| 8 | 看 `custom_config_choices` | 恰好 **1 条**，`x1/x2/x3` 和 `matched_profile_id` 都有值 | 模块六落库 |
| 9 | 看 `survey_responses` | 恰好 **1 条**，`q8`/`q9` 有值 | 总体评价落库 |
| 10 | 看 `survey_sessions` | 至少 1 条 | 会话记录 |

### 7.3 防重复与校验

| # | 操作 | 期望结果 |
|---|---|---|
| 11 | 同一份问卷**再提交一次** | 返回"该问卷已提交过"，**不产生新记录** |
| 12 | 刷新页面后看是否还有未完成草稿 | 提交成功后草稿已清理，不应恢复 |

### 7.4 权限（最重要）

| # | 操作 | 期望结果 | 说明 |
|---|---|---|---|
| 13 | `/admin` 用**白名单账号**登录 | 能看到统计面板 | Auth + 白名单 + RLS 都通 |
| 14 | **退出登录**再访问 `/admin` | 显示"需要登录"，**看不到任何数据** | 匿名被拒 |
| 15 | 用一个**不在白名单**的账号登录 | 显示"无访问权限"，**看不到任何数据** | 白名单生效 |
| 16 | 浏览器直接访问 Supabase REST（可跳过） | 返回空/无权限 | anon 无表权限 |

### 7.5 其他

| # | 操作 | 期望结果 |
|---|---|---|
| 17 | 在 `/experience` 打开模拟视频区域 | 视频缺失时显示**占位界面**，页面其余功能正常 |
| 18 | 手机打开网站 | 内容单列、顶部菜单可展开、无横向滚动 |
| 19 | 问卷中途刷新 | 进度保留，**卷别/题目顺序/左右位置不变** |

> 第 19 项是数据质量的关键：随机化结果一旦生成就写入草稿，
> 刷新、返回上一题都**不会重新随机**。

---

## 8. 导出步骤：拿数据

导出有**两条路**，按需选择。

### 8.1 方式一：Supabase 控制台手动导出（零代码，推荐入门）

适合"我只想拿一份 CSV 去分析"。

1. 打开 Supabase → **Table Editor**
2. 在左侧表列表里选中要导出的表（如 `participants`）
3. 右上角点击 **Export** → **CSV**
4. 浏览器直接下载

**各表用途速查**

| 表 | 内容 |
|---|---|
| `participants` | 参与者基本信息、卷别、提交状态、填写时长 |
| `dce_choices` | 6 道 DCE 选择题（含实际左右配置与所选配置） |
| `profile_ratings` | 4 配置 × 12 量表评分 |
| `comprehension_checks` | 理解检查首次作答 |
| `simulation_events` | 是否打开模拟、停留时长 |
| `survey_responses` | Q8–Q10 |
| `custom_config_choices` | 模块六自由自选配置 |

> 局限：需要**逐表下载**，且**没有自动合并**、没有长表格式。

### 8.2 方式二：管理后台导出（推荐正式分析）

适合"我要做条件 Logit / 需要合并宽表"。

1. 打开 `/admin`，用白名单账号登录
2. 页面底部 **数据导出（CSV）**，有 6 个按钮：

| 文件名 | 内容 | 何时用 |
|---|---|---|
| `participants.csv` | 参与者主表 | 看样本结构与完成率 |
| `dce_choices.csv` | DCE 选择题原始记录 | 核对作答细节 |
| `profile_ratings.csv` | 量表评分 | 算信度、做回归 |
| `custom_config.csv` | 模块六自选配置 | 分析"理想 vs 实际" |
| `analysis_long.csv` | **DCE 长表**（每题 2 行，含 `chosen`） | **条件 Logit / 混合 Logit 的直接输入** |
| `merged_analysis.csv` | 每人一行的宽表 | 描述统计、快速浏览 |

**技术特点**

- 编码为 **UTF-8 带 BOM**，Excel 直接双击打开中文不乱码
- 符合 RFC4180（字段全部加引号，内部引号转义）
- 以 `=`、`+`、`-`、`@` 开头的内容会被前缀处理，**防止公式注入**
- 已自动鉴权：无登录或不在白名单 → 401/403

### 8.3 分析前的必读提醒

1. **按版本分开**：`participants.questionnaire_version` 区分 `V1.0` / `V1.1`。
   **不要把两个版本的数据混在一起分析**——V1.1 多了模块六。
2. **只留已提交**：筛选 `submission_status = 'submitted'`（草稿不算）。
3. **隐私担忧方向**：`P1`–`P3` 分数越高表示**担忧越强**，**不要**反向计分为"隐私满意度"。
4. **每人多条记录**：一位参与者贡献 6 条选择 + 4 份评分，
   **不是独立样本**。做回归时要聚类稳健标准误，或用混合模型。
5. **照护者 ≠ 老人本人**：按 `respondent_role` 分组报告，
   不要把照护者的偏好等同于老人本人的偏好。

详细字段含义见 [`docs/DATA_DICTIONARY.md`](./DATA_DICTIONARY.md)。

---

## 9. 常见问题与排错

### 9.1 网站显示 Demo 模式

| 可能原因 | 排查 |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 没填 | Netlify → Environment variables 检查 |
| 填了但**没重新部署** | 改完必须 Trigger deploy |
| 变量名拼错 | 必须是 `VITE_SUPABASE_URL`，不能是 `VITE_SUPABASE_SERVICE_ROLE_KEY` |
| 值带了引号或空格 | 去掉引号，前后不要有空格 |

### 9.2 提交时报"未配置数据库连接"（HTTP 503）

服务端变量缺失。检查 Netlify 里是否有 **`SUPABASE_URL`** 与
**`SUPABASE_SERVICE_ROLE_KEY`**（**不带 `VITE_`**），并重新部署。

### 9.3 提交时报"问卷版本不匹配"

代码版本（`V1.1`）与数据库登记不一致。

```sql
select id, is_active from public.questionnaire_versions;
```

确认 `V1.1` 存在且 `is_active = true`。若缺失，按第 4 节步骤 4 补上。

### 9.4 提交时报"未在数据库中登记"

同上——`questionnaire_versions` 里没有对应版本号。

### 9.5 `/admin` 登录失败："邮箱或密码不正确"

**先分清两件事**：能不能**登录**（认证）与能不能**看数据**（授权）是两道独立的门。

| 阶段 | 依赖什么 | 失败时的提示 |
|---|---|---|
| ① 认证（Email + 密码） | Supabase **Authentication → Users** 中是否存在该账号、**邮箱是否已确认** | "邮箱或密码不正确" |
| ② 授权（白名单） | 数据表 `research_admins` 中是否有该邮箱 | "无访问权限" |

**所以"已加入白名单"不能解释登录失败**——白名单只在登录成功之后才起作用。

按顺序排查：

1. **邮箱是否已确认**（最常见原因）
   Supabase → **Authentication → Users** → 看该用户行的 **Email Confirmed** 列。
   若未确认：
   - 直接点该用户右侧的菜单 → 手动确认邮箱，**或**
   - 删除后重建，创建时**勾选 "Auto Confirm User"**

2. **密码是否一致**
   忘记密码可在同一处重置：用户行右侧菜单 → **Reset password**。

3. **是否启用了邮箱登录**
   Supabase → **Authentication → Sign In / Providers → Email** 是否启用。
   若未启用，登录时会提示"该项目未启用邮箱密码登录"。

4. **登录过于频繁**
   多次失败会触发限流，等待约一分钟再试。

5. **前端能否连到 Supabase**
   若提示"无法连接到 Authentication 服务"，检查 `VITE_SUPABASE_URL` 是否填对。

> 排查小技巧：登录失败时浏览器控制台会打印
> `[admin-signin] code=<错误码> status=<状态码>`（**只含错误码，不含邮箱、密码或 token**）。
> 例如 `code=email_not_confirmed` 就直指第 1 条。

**只有登录成功后才轮到白名单。** 登录成功但看到"无访问权限"，才去查 9.6。

### 9.5a ⚠️ 最常见的填错：URL 多带了 `/rest/v1`

Supabase 的 API 页面会显示好几段地址，容易复制错：

| 页面上的名字 | 值 | 能用吗 |
|---|---|---|
| **Project URL** | `https://<ref>.supabase.co` | ✅ **只能用这个** |
| RESTful endpoint | `https://<ref>.supabase.co/rest/v1` | ❌ 不能 |
| GraphQL endpoint | `https://<ref>.supabase.co/graphql/v1` | ❌ 不能 |

**为什么带后缀会坏**：`supabase-js` 的 `createClient` 会在 base URL **后面直接拼接**
各服务路径（源码里写死）：

```js
this.authUrl    = `${_supabaseUrl}/auth/v1`
this.storageUrl = `${_supabaseUrl}/storage/v1`
```

于是：

```
正确  https://abc.supabase.co        →  https://abc.supabase.co/auth/v1        ✅
错误  https://abc.supabase.co/rest/v1 →  https://abc.supabase.co/rest/v1/auth/v1 ❌ 404/401
```

**后果**：登录会失败，而旧版界面把它显示成"邮箱或密码不正确"——
于是你会一直怀疑密码，实际是 URL 填错了。

**现在的处理**：

1. 前端：诊断脚本会直接报"URL 带了服务路径后缀，必须去掉"
2. 服务端：`api/` 的两个接口会**自动剥掉路径与末尾斜杠**，只保留
   `https://<ref>.supabase.co`，避免把配置错误变成难以定位的运行时故障

**建议**：四个变量里的两个 URL 都改成不带后缀的形态，保持一致。

### 9.5b 邮箱已确认，登录仍失败：其余可能

按发生概率排序。**前两条最容易被误判成"密码错误"**。

| # | 可能原因 | 如何确认 | 处理 |
|---|---|---|---|
| 1 | **URL 与 anon key 不属于同一个项目** | 诊断脚本会报"anon key 被该项目拒绝" | 到 Project Settings → API，确认两者同属一个项目 |
| 2 | **anon key 复制不完整 / 误用 service_role** | 同上；或 key 长度明显偏短 | 重新完整复制 anon public |
| 3 | **项目被暂停**（免费项目长期无访问） | 诊断脚本报 5xx | 控制台执行 Restore |
| 4 | **未启用邮箱密码登录** | 脚本会读 `/auth/v1/settings` 的 `external.email` | Authentication → Providers → 启用 Email |
| 5 | **密码确实不对** | 其余情况 | 用户行菜单 → Reset password |
| 6 | **邮箱输入有前后空格 / 大小写差异** | 手动核对 | 复制粘贴时去掉空格 |
| 7 | **登录被限流** | 提示"过于频繁" | 等约 1 分钟 |
| 8 | **账号被禁用** | `code=user_banned` | 取消禁用 |

**为什么前两条最坑**：它们发生在认证之前，密码根本没被检查，
但旧版界面把所有失败都显示成"邮箱或密码不正确"，排查方向会完全跑偏。
现在这两种情况会明确提示"连接被拒绝：URL 与 anon key 可能不匹配"。

**最快的确认方式**（不需要部署、不需要浏览器）：

```bash
node scripts/check-supabase.mjs 你的邮箱
```

脚本会依次验证：配置格式 → 项目存活 → **anon key 是否被该项目接受** →
是否启用邮箱登录 → 登录 → 白名单，并逐项给出结论。

### 9.6 `/admin` 显示"无访问权限"

| 原因 | 解决 |
|---|---|
| 邮箱没加白名单 | 执行 `insert into public.research_admins (email) values ('...')` |
| 邮箱打错（拼写） | `select * from public.research_admins;` 核对 |
| 大小写 | 不影响（比对不区分大小写） |

### 9.7 `/admin` 显示"后台尚未配置"

前端 `VITE_` 变量缺失 → 浏览器拿不到 Supabase 客户端配置。
按 9.1 排查。

### 9.8 导出返回 401 / 403

| 状态码 | 含义 | 解决 |
|---|---|---|
| 401 | 未登录或 token 过期 | 重新登录 `/admin` |
| 403 | 已登录但不在白名单 | 加白名单 |
| 503 | 服务端变量缺失 | 配 `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

### 9.9 导出 CSV 中文乱码

本系统导出已带 UTF-8 BOM，正常不会乱码。
若用 Supabase 控制台导出后乱码，用 Excel 的"数据 → 从文本/CSV"导入并选 UTF-8。

### 9.10 项目被暂停

Free 计划长期无访问会暂停。控制台点 **Restore project** 即可，数据不丢。

### 9.11 想重新测一次同一份问卷

参与者编号存在浏览器里，`participant_id` 会被复用 → 二次提交被拒（防重复）。

清空本地状态：浏览器开发者工具 → **Application → Local Storage** →
删除 `aiecq:` 开头的键，刷新页面即生成新编号。

---

## 9.12 没有部署额度 / 没有 Netlify 时，如何在本地验证

**结论：Supabase 接入、登录、完整问卷流程都可以在本地验证，不需要任何部署。**

### 9.12.1 一次性诊断脚本（最快定位登录问题）

仓库内提供了 `scripts/check-supabase.mjs`，绕过网页直接向 Supabase 验证：

```bash
# 1. 先建 .env（已加入 .gitignore，不会被提交）
cp .env.example .env
#    然后编辑 .env，填入真实的：
#      VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
#      SUPABASE_SERVICE_ROLE_KEY（可选，用于校验白名单）

# 2. 运行诊断（密码会隐藏输入，不打印、不保存）
node scripts/check-supabase.mjs 你的邮箱
```

它会依次检查并给出结论：

| 步骤 | 检查内容 | 失败时提示 |
|---|---|---|
| 1 | `.env` 是否存在、值是否仍是占位符、URL 格式 | 明确指出哪一项要改 |
| 2 | 能否连到 Supabase 认证服务 | 区分"网络不通"与"配置错误" |
| 3 | 用该邮箱 + 密码登录 | 按 `code` 区分：邮箱未确认 / 限流 / 未启用邮箱登录 / 账号禁用 / 凭据错误 |
| 4 | 是否在 `research_admins` 白名单 | 给出可直接执行的 `insert` 语句 |

> 这是排查"登录失败"最省时的办法——**不需要部署、不需要打开浏览器开发者工具**。

### 9.12.2 在本地跑完整网站（含后端接口）

只跑 `npm run dev` 时，**`/api/*` 不会被转发**，提交会失败。要用 Netlify CLI：

```bash
npx netlify-cli dev        # 首次会提示登录并按需 link 站点
```

- 前端：`http://localhost:8888`
- Functions：同一端口下的 `/api/submit-survey`、`/api/admin/export`
- 环境变量：CLI 会读取 `.env`；若站点已 link，也可 `npx netlify-cli env:pull`

访问 `http://localhost:8888/admin` 即可测试登录与管理后台。

### 9.12.3 只想验证问卷流程（不需要后端）

即使什么变量都不配，问卷也能完整填写——因为会进入 **Demo 模式**，提交时明确提示"数据未上传云端"。

```bash
npm run dev   # http://localhost:5173
```

适合检查：页面渲染、移动端布局、DCE 随机化是否稳定、模块六开关、返回上一题是否重新随机。

### 9.12.4 部署额度用尽时的选择

| 选择 | 说明 |
|---|---|
| **等额度恢复** | 免费额度按周期重置，代码不受影响 |
| **改用 Vercel** | 仓库已自带 `vercel.json`，`api/` 就是 Vercel 函数，**无需改代码**；只需把 4 个环境变量填到 Vercel |
| **只在本地验证** | 调试阶段完全够用；正式发放前再解决托管 |

> 若切换到 Vercel：`netlify/` 目录不会被使用，`api/` 直接被识别为 Serverless Functions；
> 路由、`vercel.json` 的 SPA 重写均已就绪。

## 10. 安全红线与权限管理

### 10.1 三条绝对不能破的规则

1. **`service_role` key 不进前端、不进 Git、不进截图、不进聊天群**
2. **绝不写 `VITE_SUPABASE_SERVICE_ROLE_KEY`**（`VITE_` 前缀会把值打包进浏览器）
3. **不要关闭 RLS**，也不要给 `anon` 加任何表权限

### 10.2 权限模型（一句话版）

| 角色 | 能做什么 |
|---|---|
| `anon`（匿名访客） | **什么都做不了**——无策略、无授权 |
| `authenticated`（已登录的研究者） | 只有在白名单里才能**读**研究数据；**不能改也不能删** |
| `service_role`（服务端） | 全部权限，只存在于 Netlify 环境变量 |

**注意**：白名单里**没有分级**——所有管理员权限相同，都能看到全部原始数据、
都能导出。所以「谁能进白名单」本身就是数据治理决策。

### 10.3 白名单管理操作

```sql
-- 查看当前谁能访问
select email, note, created_at from public.research_admins order by created_at;

-- 添加
insert into public.research_admins (email, note)
values ('new@example.com', '2026 级组员，负责数据分析');

-- 移除（立即生效）
delete from public.research_admins where lower(email) = lower('leave@example.com');
```

> 建议在 `note` 里写明角色与加入时间，方便日后审计。

### 10.4 怀疑密钥泄露时

1. Supabase → **Project Settings → API** → **Rotate** `service_role`
2. 立刻在 Netlify 更新 `SUPABASE_SERVICE_ROLE_KEY`
3. 重新部署
4. 检查数据库是否有异常记录

> 轮换后旧密钥立即失效。与此同时 `anon` key 可以不轮换（它是公开的），
> 但如果你怀疑的是 `anon` 被滥用，检查 RLS 策略是否被改动。

### 10.5 备份

Free 计划提供每日自动备份（保留期有限）。**正式收集数据期间**建议定期手动导出：

- 用 `/admin` 的 `merged_analysis.csv` 定期存档
- 或用 Supabase 控制台 **Database → Backups** 查看可用备份

---

## 附：相关文档

| 文档 | 内容 |
|---|---|
| [`supabase/README.md`](../supabase/README.md) | 数据库技术细节、事务语义、自检 SQL |
| [`docs/DATA_DICTIONARY.md`](./DATA_DICTIONARY.md) | 全表字段字典、编码表、分析注意事项 |
| [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) | Vercel / Netlify 部署全流程、上线验证清单 |
| [`docs/RESEARCH_NOTES.md`](./RESEARCH_NOTES.md) | 研究设计审查、模块六的变更记录与撤回步骤 |
| [`docs/SETUP.md`](./SETUP.md) | 本地开发、项目结构、测试说明 |
