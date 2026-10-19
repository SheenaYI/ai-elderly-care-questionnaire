-- ═══════════════════════════════════════════════════════════════════════════
-- 0004_custom_config.sql — 增量迁移：新增"理想配置自由设定"（模块六）
-- 智能养老AI监测系统配置偏好与采纳意愿调查 · 研究数据库
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 适用场景：
--   数据库**已经**用 0001–0003 建好，现在需要升级到支持模块六。
--   全新部署不需要单独执行本文件——直接执行 schema.sql 即可（其中已包含本迁移）。
--
-- 本迁移做三件事（全部幂等，可重复执行）：
--   1. 新建 custom_config_choices 表 + 索引；
--   2. 为该表开启 RLS 并加"仅白名单管理员可读"策略；
--   3. 重建 submit_survey() 函数，使其在写库时同时写入自由自选配置。
--
-- ⚠️ 第 3 步是**整体替换**函数定义：请确保与本仓库的 0001 版本一致，
--    否则会把其他修复覆盖掉。若你曾手工改过该函数，请先备份。
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. 表结构
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.custom_config_choices (
  id                   bigserial primary key,
  participant_id       text not null unique
                         references public.participants (participant_id) on delete cascade,
  x1                   smallint not null check (x1 in (0, 1)),
  x2                   smallint not null check (x2 in (0, 1)),
  x3                   smallint not null check (x3 in (0, 1)),
  matched_profile_id   text check (matched_profile_id ~ '^C[1-8]$'),
  response_duration_ms integer not null check (response_duration_ms >= 0),
  created_at           timestamptz not null default now()
);

comment on table public.custom_config_choices is
  '模块六：参与者自由设定的理想配置（三个开关）。每人一条；x1–x3 与 C1–C8 编码一致。';
comment on column public.custom_config_choices.matched_profile_id is
  '由 (x1,x2,x3) 反查得到的 C1–C8 编码。8 种组合与 8 个配置一一对应，正常不为空。';
comment on column public.custom_config_choices.response_duration_ms is
  '参与者在该部分停留/操作的总耗时（毫秒），用于数据质量分析。';

create index if not exists custom_config_choices_participant_id_idx
  on public.custom_config_choices (participant_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. 行级安全
-- ───────────────────────────────────────────────────────────────────────────

alter table public.custom_config_choices enable row level security;

drop policy if exists custom_config_choices_select_admins on public.custom_config_choices;
create policy custom_config_choices_select_admins on public.custom_config_choices
  for select to authenticated
  using (public.is_research_admin());
comment on policy custom_config_choices_select_admins on public.custom_config_choices is
  '保护对象：参与者自由设定的理想配置（三个开关）。仅白名单管理员可读；写入只经 submit_survey()。';

-- 表级权限：0003_grants.sql 中的 `grant select on all tables` 已覆盖新表，
-- 但若你在 0003 之后又新建过表，请重新执行一次 0003 以确保授权一致。
grant select on public.custom_config_choices to authenticated;
revoke all on public.custom_config_choices from anon;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. 重建写入函数（与原函数一致，只加入 custom_config_choices 的写入）
-- ───────────────────────────────────────────────────────────────────────────
--
-- ⚠️ 下面这行提示是给维护者的：本文件的函数体必须与 0001_init.sql 中的
--    submit_survey 保持同步。改动其一必须同步另一处，否则全新部署与增量升级
--    会得到不同的函数行为。
--
-- 为避免本文件与 0001 出现两份"几乎相同但略有差异"的函数定义（这是维护陷阱），
-- 这里**不重复粘贴整个函数体**。请按下面的方式完成第 3 步：
--
--   全新数据库：直接执行 schema.sql（已含新表与新函数），跳过本节。
--   已有数据库：执行本文件第 1、2 节后，再用 schema.sql 中的
--               `create or replace function public.submit_survey(...)`
--               整段替换旧函数（该语句位于 schema.sql 的 0001 段落内）。
--
--   若你使用 Supabase CLI：`supabase db push` 会按序执行 0001–0004，
--   其中 0001 已包含新函数，因此本节无需任何操作。
--
-- 这样安排的原因：函数体有 200 余行，复制一份必然产生漂移风险；
-- 保持"唯一实现"比"文件自包含"更重要。

-- ───────────────────────────────────────────────────────────────────────────
-- 4. 升级后自查
-- ───────────────────────────────────────────────────────────────────────────
--
-- 确认表存在：
--   select count(*) from public.custom_config_choices;            -- 应为 0
-- 确认 RLS 已开：
--   select relrowsecurity from pg_class
--    where oid = 'public.custom_config_choices'::regclass;        -- 应为 true
-- 确认策略存在：
--   select polname from pg_policy
--    where polrelid = 'public.custom_config_choices'::regclass;   -- 应为 1 行
-- 确认 anon 无任何权限：
--   select privilege_type from information_schema.role_table_grants
--    where grantee = 'anon' and table_name = 'custom_config_choices';  -- 应为 0 行

-- 0004_custom_config.sql 结束。
