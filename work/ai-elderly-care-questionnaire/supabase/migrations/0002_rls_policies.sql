-- ═══════════════════════════════════════════════════════════════════════════
-- 0002_rls_policies.sql — 第 2 步：行级安全（Row Level Security）
-- 智能养老AI监测系统配置偏好与采纳意愿调查 · 研究数据库
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 前置条件：必须先执行 0001_init.sql（本文件引用其中的表与函数）。
--
-- ── 权限模型总览（谁能在什么条件下读到什么） ────────────────────────────────
--
--   anon（匿名前端 / 任何拿到 anon key 的人）
--     → 没有任何策略 ⇒ 读不到任何一行、也写不了任何一行。
--       这正是本研究的核心安全假设：**参与者端永不直连数据库**，
--       问卷数据只能通过服务端接口（service_role）写入。
--
--   authenticated（用邮箱密码登录 Supabase Auth 的研究人员）
--     → 只有当 JWT 中的 email 出现在 public.research_admins 白名单时
--       （由 public.is_research_admin() 判定）才可读取。
--     → 全部研究数据表为**只读**；仅 research_config 与
--       questionnaire_versions 允许写入（研究运行管理需要）。
--
--   service_role（只在服务端环境变量中，绝不进入前端）
--     → 具备 BYPASSRLS 属性，不受这些策略限制；
--       问卷写入与 CSV 导出都由它完成。
--
-- ── 两个关键实现细节 ──────────────────────────────────────────────────────
--   1. public.is_research_admin() 是 SECURITY DEFINER，以表属主身份读取
--      research_admins，因此不会触发"策略 → 表 → 策略"的无限递归。
--   2. 本文件**故意不使用** FORCE ROW LEVEL SECURITY：表属主（postgres）
--      必须是 RLS 的例外，否则 submit_survey() 这份 SECURITY DEFINER 函数
--      自己会被策略挡住而无法写入数据。
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 对每一张表开启 RLS
-- ───────────────────────────────────────────────────────────────────────────
-- 只要开启了 RLS 且没有任何策略，默认就是"全拒绝"（default deny）。
-- 因此 anon 不需要任何"拒绝策略"——**不要**为 anon 创建任何策略。

alter table public.research_admins       enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.research_config       enable row level security;
alter table public.participants          enable row level security;
alter table public.dce_choices           enable row level security;
alter table public.profile_ratings       enable row level security;
alter table public.comprehension_checks  enable row level security;
alter table public.simulation_events     enable row level security;
alter table public.survey_responses      enable row level security;
alter table public.survey_sessions       enable row level security;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. research_admins —— 白名单本身
-- ───────────────────────────────────────────────────────────────────────────
-- 只有已是管理员的人能看到白名单（用于后台核对谁有权限）。
-- 不提供 INSERT / UPDATE / DELETE 策略：新增管理员必须通过
-- service_role（服务端）或 Supabase SQL Editor 完成，
-- 避免任何一位管理员自行提权（把自己或他人加进白名单）。

drop policy if exists research_admins_select_admins on public.research_admins;
create policy research_admins_select_admins on public.research_admins
  for select to authenticated
  using (public.is_research_admin());
comment on policy research_admins_select_admins on public.research_admins is
  '保护对象：白名单本身。仅已登录且已在白名单内的管理员可查看名单；匿名 anon 无策略、无权限。';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. questionnaire_versions —— 版本登记
-- ───────────────────────────────────────────────────────────────────────────
-- 管理员可读、可登记新版本、可停用旧版本；不允许 DELETE（保留版本历史，
-- 否则历史数据的外键与可追溯性会被破坏）。

drop policy if exists questionnaire_versions_select_admins on public.questionnaire_versions;
create policy questionnaire_versions_select_admins on public.questionnaire_versions
  for select to authenticated
  using (public.is_research_admin());
comment on policy questionnaire_versions_select_admins on public.questionnaire_versions is
  '保护对象：问卷版本登记。仅白名单管理员可读。';

drop policy if exists questionnaire_versions_insert_admins on public.questionnaire_versions;
create policy questionnaire_versions_insert_admins on public.questionnaire_versions
  for insert to authenticated
  with check (public.is_research_admin());
comment on policy questionnaire_versions_insert_admins on public.questionnaire_versions is
  '保护对象：问卷版本登记。仅白名单管理员可登记新版本；anon 完全无法写入。';

drop policy if exists questionnaire_versions_update_admins on public.questionnaire_versions;
create policy questionnaire_versions_update_admins on public.questionnaire_versions
  for update to authenticated
  using (public.is_research_admin())
  with check (public.is_research_admin());
comment on policy questionnaire_versions_update_admins on public.questionnaire_versions is
  '保护对象：问卷版本登记。仅白名单管理员可停用/修改版本说明，用于控制是否继续接收该版本数据。';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. research_config —— 研究运行配置
-- ───────────────────────────────────────────────────────────────────────────
-- 管理员可读写（例如记录当前处于 Pilot 还是正式发放阶段）。
-- 此处存放的只能是**非敏感的运行信息**：绝不存放密钥、密码或参与者数据。

drop policy if exists research_config_select_admins on public.research_config;
create policy research_config_select_admins on public.research_config
  for select to authenticated
  using (public.is_research_admin());
comment on policy research_config_select_admins on public.research_config is
  '保护对象：研究运行配置。仅白名单管理员可读。';

drop policy if exists research_config_insert_admins on public.research_config;
create policy research_config_insert_admins on public.research_config
  for insert to authenticated
  with check (public.is_research_admin());
comment on policy research_config_insert_admins on public.research_config is
  '保护对象：研究运行配置。仅白名单管理员可新增配置项（键值对）。';

drop policy if exists research_config_update_admins on public.research_config;
create policy research_config_update_admins on public.research_config
  for update to authenticated
  using (public.is_research_admin())
  with check (public.is_research_admin());
comment on policy research_config_update_admins on public.research_config is
  '保护对象：研究运行配置。仅白名单管理员可修改配置值。';

drop policy if exists research_config_delete_admins on public.research_config;
create policy research_config_delete_admins on public.research_config
  for delete to authenticated
  using (public.is_research_admin());
comment on policy research_config_delete_admins on public.research_config is
  '保护对象：研究运行配置。仅白名单管理员可删除误建的配置项，不涉及研究数据。';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. 研究数据表 —— 全部只读（SELECT），且仅限白名单管理员
-- ───────────────────────────────────────────────────────────────────────────
-- participants / dce_choices / profile_ratings / comprehension_checks /
-- simulation_events / survey_responses / survey_sessions
--
-- 为什么只给 SELECT：
--   * 写入路径唯一 —— 只能经 submit_survey()（service_role），
--     保证"zod 校验 → 语义校验 → 单事务写入"这条链路不可绕过。
--   * 研究可审计性 —— 管理员无法悄悄改动原始答案；
--     任何数据修正都应通过新的迁移或带记录的脚本完成。

drop policy if exists participants_select_admins on public.participants;
create policy participants_select_admins on public.participants
  for select to authenticated
  using (public.is_research_admin());
comment on policy participants_select_admins on public.participants is
  '保护对象：参与者身份与卷别信息。仅白名单管理员可读；匿名 anon 完全不可读。';

drop policy if exists dce_choices_select_admins on public.dce_choices;
create policy dce_choices_select_admins on public.dce_choices
  for select to authenticated
  using (public.is_research_admin());
comment on policy dce_choices_select_admins on public.dce_choices is
  '保护对象：DCE 原始选择数据。仅白名单管理员可读；写入只经 submit_survey()。';

drop policy if exists profile_ratings_select_admins on public.profile_ratings;
create policy profile_ratings_select_admins on public.profile_ratings
  for select to authenticated
  using (public.is_research_admin());
comment on policy profile_ratings_select_admins on public.profile_ratings is
  '保护对象：12 题量表评分。仅白名单管理员可读；写入只经 submit_survey()。';

drop policy if exists comprehension_checks_select_admins on public.comprehension_checks;
create policy comprehension_checks_select_admins on public.comprehension_checks
  for select to authenticated
  using (public.is_research_admin());
comment on policy comprehension_checks_select_admins on public.comprehension_checks is
  '保护对象：理解检查首次作答。仅白名单管理员可读；写入只经 submit_survey()。';

drop policy if exists simulation_events_select_admins on public.simulation_events;
create policy simulation_events_select_admins on public.simulation_events
  for select to authenticated
  using (public.is_research_admin());
comment on policy simulation_events_select_admins on public.simulation_events is
  '保护对象：模拟使用埋点。仅白名单管理员可读；写入只经 submit_survey()。';

drop policy if exists survey_responses_select_admins on public.survey_responses;
create policy survey_responses_select_admins on public.survey_responses
  for select to authenticated
  using (public.is_research_admin());
comment on policy survey_responses_select_admins on public.survey_responses is
  '保护对象：总体评价（Q8–Q10，含开放文本）。仅白名单管理员可读；写入只经 submit_survey()。';

drop policy if exists survey_sessions_select_admins on public.survey_sessions;
create policy survey_sessions_select_admins on public.survey_sessions
  for select to authenticated
  using (public.is_research_admin());
comment on policy survey_sessions_select_admins on public.survey_sessions is
  '保护对象：问卷会话/重试审计记录（含 User-Agent）。仅白名单管理员可读；写入只经 submit_survey()。';


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 自检（执行后可在 SQL Editor 中运行以下查询核对）
-- ───────────────────────────────────────────────────────────────────────────
--   -- 6.1 每张表是否都开启了 RLS？（应全部为 true）
--   select relname, relrowsecurity
--     from pg_class
--    where relnamespace = 'public'::regnamespace and relkind = 'r'
--    order by relname;
--
--   -- 6.2 是否存在任何面向 anon 的策略？（应为 0 行）
--   select tablename, policyname, roles
--     from pg_policies
--    where schemaname = 'public' and 'anon' = any (roles);
--
--   -- 6.3 策略清单
--   select tablename, policyname, cmd, roles from pg_policies
--    where schemaname = 'public' order by tablename, policyname;
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 0002_rls_policies.sql 结束。下一步：0003_grants.sql（GRANT / REVOKE）。
-- ═══════════════════════════════════════════════════════════════════════════
