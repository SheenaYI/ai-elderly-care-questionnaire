# 数据库初始化与安全说明（Supabase）

> 需要**按步骤操作**的建库教程、协作分工、验收清单与导出流程，请见
> [`docs/SUPABASE_SETUP.md`](../docs/SUPABASE_SETUP.md)。本文偏技术参考（结构、事务语义、自检 SQL）。

智能养老AI监测系统配置偏好与采纳意愿调查 · 研究数据库

本目录只包含**数据库结构与安全策略**，不含任何真实密钥，也不含任何参与者数据。

---

## 1. 文件清单

| 文件 | 作用 | 何时使用 |
| --- | --- | --- |
| `schema.sql` | 完整结构（单文件）= 下面三个迁移按顺序拼接 | 在 Supabase SQL Editor 中一次性粘贴执行（最省事） |
| `migrations/0001_init.sql` | 初始迁移：表 / 约束 / 索引 / `analysis_long` 视图 / `submit_survey()` 函数 / 种子数据 | 用 Supabase CLI 或 psql 做版本化管理时 |
| `migrations/0002_rls_policies.sql` | 开启 RLS + 全部策略（仅面向白名单管理员）+ `is_research_admin()` | 紧跟 0001 |
| `migrations/0003_grants.sql` | GRANT / REVOKE：对 anon 全面回收权限，`submit_survey` 只给 service_role | 紧跟 0002 |

> **不要重复执行**：CLI 用户只用 `migrations/`（`schema.sql` 内容与之相同）。
> SQL Editor 用户只用 `schema.sql`。
> 所有语句都写成幂等（`IF NOT EXISTS` 等），但幂等语句**不会修改已存在表的列**；
> 今后任何列变更都要新建 `0004_xxx.sql`。

---

## 2. 创建 Supabase 项目

1. 登录 <https://supabase.com> → **New project**。
2. 填写项目名（例如 `ai-elderly-care-research`）、数据库密码（**保存到密码管理器**，
   不要提交进 Git）、区域建议选择离研究对象最近的区域（例如 Singapore / Tokyo）。
3. 等待项目就绪后，在 **Project Settings → API** 页面记录两个值：
   - `Project URL` → 环境变量 `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` key → 环境变量 `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → **只**填到服务端环境变量 `SUPABASE_SERVICE_ROLE_KEY`（见第 6、7 节）
4. 记住 Project Reference（形如 `abcdefghijklmnop`），CLI 需要用到。

---

## 3. 建库：两条路径选一条

### 路径 A（推荐，零安装）：SQL Editor 执行 `schema.sql`

1. 打开 Supabase 控制台 → **SQL Editor** → **New query**。
2. 把 `supabase/schema.sql` 全文粘贴进去 → **Run**。
3. 成功后再运行一次"自检"（见第 7 节）。
4. 如果报 `syntax error near "security_invoker"`，说明该项目的 PostgreSQL 低于 15：
   在 `schema.sql` 中删除 `with (security_invoker = true)` 这一行（在视图定义处）
   后重跑；RLS 与 REVOKE 仍然提供完整保护（Supabase 新项目默认 PG 15+，一般不会遇到）。
5. 若把 `schema.sql` 用在**本地或自建 PostgreSQL** 上：`0003_grants.sql` 开头会检查
   `anon / authenticated / service_role` 三个角色，缺失时自动创建（Supabase 上该步骤为空操作）。
   自建环境还需要按 PostgREST 的 `db-anon-role`、JWT 密钥等配置把这三个角色接入自己的认证体系。

### 路径 B（可版本化）：Supabase CLI 执行 migrations

```bash
# 一次性准备
npm i -g supabase            # 或使用 npx supabase
supabase login
supabase link --project-ref <你的 project-ref>

# 执行迁移（按文件名顺序 0001 → 0002 → 0003）
supabase db push
```

或者用 psql 直连（数据库连接串在 Project Settings → Database 中）：

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_rls_policies.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_grants.sql
```

`0001_init.sql` 会顺带把问卷版本 `V1.0` 登记到 `questionnaire_versions`。
**收集数据前必须确认该行存在且 `is_active = true`**，否则服务端会拒绝写入。

```sql
select * from public.questionnaire_versions;   -- 应有一行 V1.0 / is_active = true
```

---

## 4. 开启 Supabase Auth（邮箱 + 密码）并创建管理员

1. 控制台 → **Authentication → Providers → Email**：
   - 打开 **Enable email provider**；
   - **关闭 "Allow new users to sign up"（禁止公开注册）**。
     本项目只有研究团队少数几个账号，必须由负责人手工创建，
     否则任何人都能注册一个 `authenticated` 账号来试探数据。
   - 建议关闭 **Confirm email**（内部账号），或按团队规范保留。
2. 控制台 → **Authentication → Users → Add user → Create new user**：
   填写研究人员的邮箱与强密码（可勾选 Auto Confirm）。
3. 把**同一个邮箱**写入白名单表（大小写不敏感，建议统一小写）：

```sql
insert into public.research_admins (email, note)
values ('pi@example.edu.cn', '课题负责人')
on conflict (email) do nothing;

select * from public.research_admins;
```

> 登录成功 ≠ 能看数据。**只有白名单内的邮箱**才能读到研究数据；
> 其他已登录账号会被 RLS 策略挡在外面（返回 0 行）。
> 因此"创建 Auth 用户"和"写入 research_admins"两步都要做，缺一不可。

4. 研究人员用邮箱+密码登录后，通过后台导出接口下载数据：

```
GET /api/admin/export?dataset=merged
Authorization: Bearer <Supabase Auth access_token>
```

`dataset` 可选：`participants` | `dce_choices` | `profile_ratings` | `analysis_long` | `merged`。
返回 CSV（带 UTF-8 BOM，Excel 直接打开不乱码）。

---

## 5. 数据模型速览（分析用）

| 表 / 视图 | 粒度 | 说明 |
| --- | --- | --- |
| `participants` | 1 行 / 人 | 匿名编号、问卷版本、卷别 A/B、身份信息（Q2–Q5）、起止时间 |
| `dce_choices` | 1 行 / 题（每人 6 行） | 左右方案配置编码 + 属性快照 + 选中项 + 作答时长 |
| `profile_ratings` | 1 行 / 配置（每人 4 行） | 12 个量表题 S1–S3 / P1–P3 / A1–A3 / I1–I3（1–5） |
| `comprehension_checks` | 1 行 / 题（每人 2 行） | Q6/Q7 **首次**作答是否正确 + 重答次数 |
| `simulation_events` | 1 行 / 事件 | 打开/关闭/看完/看详情/重播，含毫秒时间戳与停留时长 |
| `survey_responses` | 1 行 / 人 | Q8 总体意愿（1–5）、Q9 最担心的问题、Q10 开放建议 |
| `survey_sessions` | 追加式 | 每次提交尝试留痕（含 User-Agent），用于过程审计 |
| `analysis_long` | 1 行 / （题 × 方案）= 每人 12 行 | **DCE 长表**，含 `chosen`，条件 logit / 混合 logit 直接可用 |

DCE 长表用法示例：

```sql
-- 每道题恰好一行 chosen = true，可用于 clogit / mlogit
select participant_id, task_id, alternative, profile_id, x1, x2, x3, chosen
  from public.analysis_long
 where participant_id = 'P-xxxxxxxx'
 order by task_id, alternative;

-- 只分析已正式提交、且属于 V1.0 的数据
select l.*
  from public.analysis_long l
  join public.participants p on p.participant_id = l.participant_id
 where p.submission_status = 'submitted'
   and p.questionnaire_version = 'V1.0';
```

**记分方向提醒**：`P1–P3` 分数越高表示**隐私担忧越强**，不得反向计分为"隐私满意度"。

---

## 6. 环境变量：谁放哪里

| 变量 | 放哪里 | 是否公开 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 前端构建环境 | 公开（项目 URL） |
| `VITE_SUPABASE_ANON_KEY` | 前端构建环境 | 公开（受 RLS 约束，泄露也不等于泄露数据） |
| `VITE_SUBMIT_ENDPOINT` | 前端构建环境 | 公开（默认 `/api/submit-survey`） |
| `VITE_QUESTIONNAIRE_VERSION` | 前端构建环境 | 公开（默认 `V1.0`） |
| `VITE_ALLOW_DEMO_MODE` | 前端构建环境 | 公开（**生产环境必须为 `false`**） |
| `SUPABASE_URL` | 服务端（Vercel / Netlify Secrets） | 私有 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端（Vercel / Netlify Secrets） | **最高机密** |
| `RESEARCH_ADMIN_ALLOWLIST` | 服务端（可选，额外白名单） | 私有 |

模板见项目根目录 `.env.example`（只含占位符，真实值永远不要提交到 Git）。

---

## 7. 绝不放进前端的清单（务必逐条检查）

以下内容**永远**不能出现在 `src/`、`public/`、任何 `VITE_` 变量、
浏览器可见的配置文件或前端日志里：

- ❌ `SUPABASE_SERVICE_ROLE_KEY`（拥有它 = 绕过全部 RLS，可直接读写/删除全部研究数据）
- ❌ 数据库密码、`DATABASE_URL`、Connection Pooler 连接串
- ❌ Supabase `JWT secret`、`anon` 之外的后台密钥、任何 Personal Access Token
- ❌ 管理员邮箱名单、导出接口的内部实现细节
- ❌ 参与者的原始答案（不得在 console / 日志 / 前端状态里输出研究数据）

前端只允许拥有 `VITE_SUPABASE_ANON_KEY`（公开密钥，安全性由 RLS 保证）。
本项目参与者端的数据提交**不直连数据库**，而是走 `/api/submit-survey`
（服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 调用 `submit_survey()`）。

> 如果发现某个 `VITE_` 变量里出现了 `service_role`，视为安全事故：
> 立即在 Supabase 控制台 **Project Settings → API → Rotate** 轮换该密钥，
> 并检查所有历史构建产物与前端仓库提交记录。

---

## 8. 初始化后自检（建议逐条执行）

```sql
-- 8.1 每张表是否都开启了 RLS？应全部为 true
select relname, relrowsecurity
  from pg_class
 where relnamespace = 'public'::regnamespace and relkind = 'r'
 order by relname;

-- 8.2 是否存在面向 anon 的策略？必须为 0 行
select tablename, policyname, roles
  from pg_policies
 where schemaname = 'public' and 'anon' = any (roles);

-- 8.3 anon 是否还有任何表级权限？必须为 0 行
select table_name, privilege_type
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public';

-- 8.4 authenticated 的权限清单（应只有 SELECT，外加 research_config /
--     questionnaire_versions 的写权限）
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privs
  from information_schema.role_table_grants
 where grantee = 'authenticated' and table_schema = 'public'
 group by table_name order by table_name;

-- 8.5 版本已登记
select * from public.questionnaire_versions;

-- 8.6 长表视图可用（以 postgres 身份执行）
select * from public.analysis_long limit 5;
```

用 anon key 验证"真的读不到"（把结果与预期对比）：

```bash
curl -s "$SUPABASE_URL/rest/v1/participants?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# 预期：permission denied for table participants （而不是返回数据）
```

用匿名身份调用写入函数，预期同样被拒绝：

```bash
curl -s "$SUPABASE_URL/rest/v1/rpc/submit_survey" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"payload":{}}'
# 预期：permission denied for function submit_survey
```

---

## 9. `submit_survey()` 的事务语义（研究数据完整性）

服务端接口 `api/submit-survey.ts` 只调用一个数据库函数：

```
supabase.rpc('submit_survey', { payload })
```

该函数（`SECURITY DEFINER`，`search_path` 固定为 `public, pg_temp`）在**一个事务**内完成：

1. 校验必填字段（participantId / 问卷版本 / 卷别 / 身份信息 / Q8-Q9 / 时间戳）；
2. 校验问卷版本已在 `questionnaire_versions` 登记且 `is_active = true`；
3. 对 `participants` 中同 `participant_id` 的行加锁（`FOR UPDATE`）并检查
   是否已经 `submitted` —— 是则抛出 `23505`（服务端映射为 HTTP 409）；
4. 写入 / 更新 `participants`（重复提交的草稿会被覆盖，不会产生第二份正式数据）；
5. 清空同一参与者的旧子表行（重试场景）后整批写入
   `dce_choices`、`profile_ratings`、`comprehension_checks`、
   `simulation_events`、`survey_responses`；
6. 追加一行 `survey_sessions`（**不删除历史**，保留提交过程审计）。

任何一步失败 → **整份问卷回滚**，不会留下"半份数据"。
因此研究数据只有两种状态：完整写入，或完全没有。

---

## 10. 备份、导出与研究伦理

- **备份**：控制台 → Database → Backups（付费计划提供 PITR）。正式发放期间建议开启。
- **导出**：后台接口 `/api/admin/export?dataset=...`（CSV，UTF-8 BOM），
  或控制台 → Table Editor → Export CSV，或 `psql \copy`。
  导出文件属于**原始研究数据**，应存放在加密磁盘/受控目录，不要放进任何 Git 仓库。
- **问卷版本**：Pilot 与正式版务必使用不同的 `questionnaire_version`，
  分析时按该字段分组，禁止混合统计。
- **删除请求**：`participant_id` 是匿名编号，本身无法定位到个人；
  若知情同意书承诺了"可退出/删除"，删除时按 `participant_id`
  手工删除 `participants` 行即可（子表通过 `ON DELETE CASCADE` 自动清理）。
- **最小权限**：新增管理员写入 `research_admins`；离组人员及时删除其白名单
  与 Auth 账号（`delete from public.research_admins where email = '...'`）。
- **不要**为图方便把 `service_role` key 交给任何前端页面或第三方分析工具。
