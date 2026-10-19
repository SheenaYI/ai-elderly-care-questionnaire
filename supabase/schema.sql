-- ═══════════════════════════════════════════════════════════════════════════
-- schema.sql — 研究数据库完整结构（单文件版）
-- 智能养老AI监测系统配置偏好与采纳意愿调查
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 适用场景：
--   * 在 Supabase 控制台 → SQL Editor 中**一次性粘贴执行**，即可完成建库；
--   * 或用于本地/自建 PostgreSQL 快速搭一份结构相同的库。
--
-- 本文件 = migrations/0001_init.sql + 0002_rls_policies.sql + 0003_grants.sql
--          （按顺序拼接，内容完全一致，便于对照审查）。
--   * 0001 结构：表 / 约束 / 索引 / analysis_long 视图 / submit_survey 函数 / 种子数据
--   * 0002 行级安全：RLS 开启 + 仅面向 authenticated 白名单管理员的策略
--   * 0003 权限：对 anon 全面 REVOKE，只给 service_role 与白名单管理员最小权限
--
-- 使用建议：
--   * 用 Supabase CLI 管理版本时，请**只**执行 migrations/ 下的三个文件
--     （supabase db push），不要重复执行本文件（本文件内容与之相同）。
--   * 本文件所有语句都是幂等的，重复执行不会报错，但 IF NOT EXISTS
--     不会修改已存在表的列定义；列变更必须另建迁移文件。
--
-- 安全要点（详见 supabase/README.md）：
--   * anon（匿名前端）对任何表都没有权限，也读不到任何一行；
--     参与者端永不直连数据库，问卷数据只能经服务端 submit_survey() 写入。
--   * authenticated 只有在 research_admins 白名单中才可读取研究数据（只读）。
--   * service_role key 只能存放在服务端环境变量，绝不进入前端代码。
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — 初始迁移（initial migration）
-- 智能养老AI监测系统配置偏好与采纳意愿调查 · 研究数据库结构
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 本文件是**初始迁移**（第 1 步，共 3 步），只包含"结构"：
--   表（tables） → 约束（constraints） → 索引（indexes）
--   → 长表视图 analysis_long → 写入函数 submit_survey → 种子数据（seeds）
--
-- 执行顺序（必须按此顺序，缺一不可）：
--   0001_init.sql        结构（本文件）
--   0002_rls_policies.sql 行级安全（RLS）与管理员判定函数
--   0003_grants.sql       权限授予/回收（GRANT / REVOKE）
--
-- 安全模型（与 0002 / 0003 配合，务必阅读 supabase/README.md）：
--   * anon（匿名前端）对所有表**无任何权限**；问卷数据只能由服务端
--     （service_role）通过 submit_survey() 写入。前端永不直连本库。
--   * authenticated（邮箱密码登录的研究人员）只有**只读**权限，
--     且必须出现在 research_admins 白名单中。
--   * service_role 只出现在服务端环境变量中，绝不进入前端代码。
--
-- 说明：全部语句都是幂等的（IF NOT EXISTS / CREATE OR REPLACE / DROP VIEW IF EXISTS），
--       便于研究者在 Supabase SQL Editor 中重跑修正。但 IF NOT EXISTS **不会**
--       修改已存在表的列定义；后续任何列变更必须新建迁移文件（0004_...）。
--
-- ⚠️ 本文不含任何真实密钥，只含结构；请勿在此写入参与者数据。
-- ═══════════════════════════════════════════════════════════════════════════

-- gen_random_uuid()：PostgreSQL 13+ 内置；低版本由 pgcrypto 提供。
create extension if not exists pgcrypto;


-- ───────────────────────────────────────────────────────────────────────────
-- 0. 研究管理员白名单
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.research_admins (
  email      text primary key,
  created_at timestamptz not null default now(),
  note       text not null default ''
);

comment on table public.research_admins is
  '研究管理员邮箱白名单。只有此表内的邮箱（Supabase Auth 登录后 JWT 中的 email）才能读取研究数据。初始数据必须由项目负责人手工插入。';
comment on column public.research_admins.email is
  '管理员登录邮箱。大小写不敏感（比较时统一 lower()），建议统一填小写。';
comment on column public.research_admins.note is
  '备注（姓名/角色/加入原因），便于日后审计谁有数据访问权。';

-- 大小写不敏感的唯一性：防止 Foo@x.com 与 foo@x.com 同时存在绕过审计。
create unique index if not exists research_admins_email_lower_key
  on public.research_admins (lower(email));


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 问卷版本登记表
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.questionnaire_versions (
  id          text primary key,             -- 例如 'V1.0'
  description text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.questionnaire_versions is
  '问卷版本登记表。服务端提交接口会校验：提交的版本号必须存在于本表且 is_active = true，否则拒绝写入。';
comment on column public.questionnaire_versions.is_active is
  '是否接受新数据。停用旧版本（false）后，旧版本问卷的提交会被服务端拒绝，但历史数据保留。';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. 研究运行配置（自由键值对）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.research_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

comment on table public.research_config is
  '研究运行配置（自由键值对，仅 service_role 与白名单管理员可写）。例如记录正式发放阶段、数据保存期限说明等，不存放任何密钥。';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. 参与者主表
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.participants (
  id                     uuid primary key default gen_random_uuid(),
  participant_id         text not null unique,
  questionnaire_version  text not null
                           references public.questionnaire_versions (id)
                           on update cascade on delete restrict,
  consent_status         text not null check (consent_status in ('pending', 'agreed', 'declined')),
  age_group              text not null check (age_group in ('18-29', '30-44', '45-59', '60-69', '70+')),
  respondent_role        text not null check (respondent_role in
                           ('older_adult', 'current_caregiver', 'prospective_caregiver', 'other')),
  respondent_role_other  text not null default '',
  ai_device_experience   text not null check (ai_device_experience in ('used', 'aware_not_used', 'unaware')),
  caregiving_experience  text not null check (caregiving_experience in ('often', 'sometimes', 'never')),
  assigned_block         text not null check (assigned_block in ('A', 'B')),
  prior_experience       boolean not null default false,
  started_at             timestamptz not null,
  submitted_at           timestamptz,
  total_duration_ms      integer,
  submission_status      text not null default 'draft' check (submission_status in ('draft', 'submitted', 'failed')),
  created_at             timestamptz not null default now()
);

comment on table public.participants is
  '参与者主表：一人一行。participant_id 为前端本地生成的匿名编号，不含任何个人身份信息。';
comment on column public.participants.participant_id is
  '匿名参与者编号（前端生成，8–128 字符）。研究数据的唯一连接键，不含姓名/身份证号。';
comment on column public.participants.questionnaire_version is
  '问卷版本（外键）。用于把 Pilot 数据与正式版数据分开分析，禁止混用。';
comment on column public.participants.assigned_block is
  '随机分配的 DCE 卷别：A 卷 = T01/T02/T03/T07/T08/T11，B 卷 = T04/T05/T06/T09/T10/T12。';
comment on column public.participants.prior_experience is
  '是否在本问卷之前使用过独立"情景体验"页面（用于检验体验先后顺序的影响）。';
comment on column public.participants.submission_status is
  'draft = 服务端已见过但未完成；submitted = 已成功落库；failed = 写入异常。只有 submitted 的数据应进入正式分析。';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. DCE 选择记录（每题一行，左右方案各存一份属性快照）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.dce_choices (
  id                   bigserial primary key,
  participant_id       text not null references public.participants (participant_id) on delete cascade,
  task_id              text not null check (task_id ~ '^T(0[1-9]|1[0-2])$'),
  block_id             text not null check (block_id in ('A', 'B')),
  task_display_order   smallint not null check (task_display_order between 1 and 6),
  left_profile_id      text not null check (left_profile_id ~ '^C[1-8]$'),
  right_profile_id     text not null check (right_profile_id ~ '^C[1-8]$'),
  selected_side        text not null check (selected_side in ('left', 'right')),
  selected_profile_id  text not null check (selected_profile_id ~ '^C[1-8]$'),
  left_x1              smallint not null check (left_x1 in (0, 1)),
  left_x2              smallint not null check (left_x2 in (0, 1)),
  left_x3              smallint not null check (left_x3 in (0, 1)),
  right_x1             smallint not null check (right_x1 in (0, 1)),
  right_x2             smallint not null check (right_x2 in (0, 1)),
  right_x3             smallint not null check (right_x3 in (0, 1)),
  response_duration_ms integer not null check (response_duration_ms >= 0),
  created_at           timestamptz not null default now(),

  constraint dce_choices_participant_task_key unique (participant_id, task_id),
  -- 左右不能是同一配置（两方案必须可比较）
  constraint dce_choices_distinct_alternatives check (left_profile_id <> right_profile_id),
  -- 关键：记录的"选中的配置"必须与"所选一侧"指向的配置一致，
  -- 否则无法还原参与者真正选择了 C1–C8 中的哪一个（条件 logit 的因变量）。
  constraint dce_choices_selected_matches_side check (
    (selected_side = 'left'  and selected_profile_id = left_profile_id) or
    (selected_side = 'right' and selected_profile_id = right_profile_id)
  )
);

comment on table public.dce_choices is
  'DCE 离散选择实验作答：每位参与者在所分配卷别内恰好 6 题。左右两侧属性水平均为快照，便于在配置编码被修订后仍可复现当时的实验材料。';
comment on column public.dce_choices.task_display_order is
  '该题在本卷中的展示次序（1–6）。用于控制题目顺序效应。';
comment on column public.dce_choices.left_profile_id is
  '画面左侧方案对应的配置编码 C1–C8（左右位置是随机化的，可能与 V1.0 任务表的方案A/方案B 顺序不同）。';
comment on column public.dce_choices.selected_profile_id is
  '参与者实际选中的配置编码 C1–C8。条件 logit 的因变量由它推导（见 analysis_long 视图）。';
comment on column public.dce_choices.response_duration_ms is
  '该题作答时长（毫秒），用于剔除不认真作答的样本。';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. 配置感知评价（每人 4 个配置 × 12 个量表题）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.profile_ratings (
  id           bigserial primary key,
  participant_id text not null references public.participants (participant_id) on delete cascade,
  profile_id   text not null check (profile_id ~ '^C[1-8]$'),
  x1           smallint not null check (x1 in (0, 1)),
  x2           smallint not null check (x2 in (0, 1)),
  x3           smallint not null check (x3 in (0, 1)),
  rating_order smallint not null check (rating_order between 1 and 4),
  s1           smallint not null check (s1 between 1 and 5),
  s2           smallint not null check (s2 between 1 and 5),
  s3           smallint not null check (s3 between 1 and 5),
  p1           smallint not null check (p1 between 1 and 5),
  p2           smallint not null check (p2 between 1 and 5),
  p3           smallint not null check (p3 between 1 and 5),
  a1           smallint not null check (a1 between 1 and 5),
  a2           smallint not null check (a2 between 1 and 5),
  a3           smallint not null check (a3 between 1 and 5),
  i1           smallint not null check (i1 between 1 and 5),
  i2           smallint not null check (i2 between 1 and 5),
  i3           smallint not null check (i3 between 1 and 5),
  created_at   timestamptz not null default now(),

  constraint profile_ratings_participant_profile_key unique (participant_id, profile_id),
  constraint profile_ratings_participant_order_key  unique (participant_id, rating_order)
);

comment on table public.profile_ratings is
  '模块四：每个被抽中的配置的 12 题量表评分（S1–S3 安全感 / P1–P3 隐私担忧 / A1–A3 自主感 / I1–I3 采纳意愿），取值 1–5。';
comment on column public.profile_ratings.rating_order is
  '该配置在本问卷中的评价次序（1–4），用于控制评价顺序效应。';
comment on column public.profile_ratings.p1 is
  '⚠️ 计分方向：P1–P3 分数越高表示**隐私担忧越强**，分析时不得反向计分为"隐私满意度"。';


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 理解检查（Q6 / Q7）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.comprehension_checks (
  id                 bigserial primary key,
  participant_id     text not null references public.participants (participant_id) on delete cascade,
  question_id        text not null check (question_id in ('Q6', 'Q7')),
  first_answer       text not null,
  first_answer_index smallint not null check (first_answer_index >= 0),
  is_correct         boolean not null,
  retry_count        smallint not null default 0 check (retry_count >= 0),
  created_at         timestamptz not null default now(),

  constraint comprehension_checks_participant_question_key unique (participant_id, question_id)
);

comment on table public.comprehension_checks is
  '模块二理解检查 Q6/Q7 的**首次**作答记录（答错后重答不覆盖首次结果），用于检查情景理解是否达标。';
comment on column public.comprehension_checks.first_answer is
  '首次作答所选选项的文字标签。由服务端根据 first_answer_index 还原得到，便于直接阅读 CSV。';
comment on column public.comprehension_checks.retry_count is
  '首次答错后重新作答的次数。';
comment on column public.comprehension_checks.is_correct is
  '首次作答是否正确。服务端会重新推导该值，不信任客户端上报。';


-- ───────────────────────────────────────────────────────────────────────────
-- 7. 模拟使用埋点
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.simulation_events (
  id                 bigserial primary key,
  participant_id     text not null references public.participants (participant_id) on delete cascade,
  task_id            text,
  profile_id         text not null check (profile_id ~ '^C[1-8]$'),
  event_type         text not null check (event_type in ('open', 'close', 'complete', 'view_details', 'replay')),
  source             text not null check (source in ('dce', 'experience')),
  event_timestamp_ms integer not null check (event_timestamp_ms >= 0),
  duration_ms        integer check (duration_ms is null or duration_ms >= 0),
  created_at         timestamptz not null default now(),

  constraint simulation_events_task_id_format check (
    task_id is null or task_id ~ '^T(0[1-9]|1[0-2])$'
  )
);

comment on table public.simulation_events is
  '模拟使用行为埋点（打开/关闭/看完/看详情/重播）。用于分析"是否看过某个配置"以及停留时长。';
comment on column public.simulation_events.task_id is
  '若在 DCE 题目中打开模拟则记录题目编号；独立"情景体验"页为空（NULL）。';
comment on column public.simulation_events.event_timestamp_ms is
  '相对问卷开始时间的毫秒偏移（不是绝对时间），保留原始事件顺序。';
comment on column public.simulation_events.duration_ms is
  '停留时长（毫秒），主要由 close 事件携带。';


-- ───────────────────────────────────────────────────────────────────────────
-- 8. 总体评价（Q8–Q10，一人一行）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.survey_responses (
  id             bigserial primary key,
  participant_id text not null unique references public.participants (participant_id) on delete cascade,
  q8             smallint not null check (q8 between 1 and 5),
  q9             text not null check (q9 in
                   ('insufficient_detection', 'privacy_exposure', 'limited_autonomy', 'complex_operation', 'other')),
  q10            text not null default '',
  created_at     timestamptz not null default now()
);

comment on table public.survey_responses is
  '模块五总体评价：Q8 总体采纳意愿（1–5）、Q9 最担心的问题、Q10 开放性建议（可空字符串）。';
comment on column public.survey_responses.q8 is
  '总体采纳意愿，1 = 非常不同意 … 5 = 非常同意。';


-- ───────────────────────────────────────────────────────────────────────────
-- 9. 问卷会话（可多次：草稿/失败重试留痕，仅正式提交进入分析）
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.survey_sessions (
  id                    bigserial primary key,
  participant_id        text not null references public.participants (participant_id) on delete cascade,
  questionnaire_version text not null
                          references public.questionnaire_versions (id)
                          on update cascade on delete restrict,
  prior_experience      boolean not null default false,
  user_agent            text,
  started_at            timestamptz not null,
  submitted_at          timestamptz,
  created_at            timestamptz not null default now()
);

comment on table public.survey_sessions is
  '问卷会话记录（追加式）：同一 participant_id 若发生重试会留下多行，便于审计数据收集过程。';
comment on column public.survey_sessions.user_agent is
  '提交时的 User-Agent（仅用于设备/浏览器兼容性排查，含少量技术信息，不得用于识别个人）。';



-- ───────────────────────────────────────────────────────────────────────────
-- 10. 模块六：自由自选配置（V1.0 之外新增）
-- ───────────────────────────────────────────────────────────────────────────
--
-- 每位参与者一条记录：三个"开关"拼出的理想配置。
-- 与 dce_choices 的区别：DCE 记录的是"被迫权衡时的选择"，本表记录"主动设定的理想"。
-- x1/x2/x3 与 C1–C8 的编码完全一致，因此按 (x1, x2, x3) 可直接 join 到配置表。

create table if not exists public.custom_config_choices (
  id                   bigserial primary key,
  participant_id       text not null unique
                         references public.participants (participant_id) on delete cascade,
  x1                   smallint not null check (x1 in (0, 1)),
  x2                   smallint not null check (x2 in (0, 1)),
  x3                   smallint not null check (x3 in (0, 1)),
  -- 该组合对应的配置编码；8 种组合与 C1–C8 一一对应，正常不会为 NULL，
  -- 允许 NULL 仅为兼容历史数据与显式表达"自定义组合"
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

-- ───────────────────────────────────────────────────────────────────────────
-- 10. 索引：覆盖全部外键 + 常用筛选列
-- ───────────────────────────────────────────────────────────────────────────

create index if not exists participants_assigned_block_idx
  on public.participants (assigned_block);
create index if not exists participants_submission_status_idx
  on public.participants (submission_status);
create index if not exists participants_questionnaire_version_idx
  on public.participants (questionnaire_version);

create index if not exists dce_choices_participant_id_idx on public.dce_choices (participant_id);
create index if not exists dce_choices_block_id_idx      on public.dce_choices (block_id);
create index if not exists dce_choices_task_id_idx       on public.dce_choices (task_id);

create index if not exists profile_ratings_participant_id_idx on public.profile_ratings (participant_id);
create index if not exists profile_ratings_profile_id_idx     on public.profile_ratings (profile_id);

create index if not exists comprehension_checks_participant_id_idx
  on public.comprehension_checks (participant_id);

create index if not exists simulation_events_participant_id_idx
  on public.simulation_events (participant_id);
create index if not exists simulation_events_profile_id_idx
  on public.simulation_events (profile_id);
create index if not exists simulation_events_event_type_idx
  on public.simulation_events (event_type);

-- survey_responses.participant_id 已有 UNIQUE 约束（自带唯一索引），无需重复建索引。
create index if not exists survey_sessions_participant_id_idx
  on public.survey_sessions (participant_id);

create index if not exists custom_config_choices_participant_id_idx
  on public.custom_config_choices (participant_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 11. 长表视图 analysis_long（条件 logit / 混合 logit 分析的输入）
-- ───────────────────────────────────────────────────────────────────────────
--
-- 每个 DCE 题目展开成 2 行（left / right），chosen 标记被选中的那一行。
-- 这样每道题恰好 1 行 chosen = true，可直接用于 clm / mlogit / clogit。
--
-- ⚠️ security_invoker = true 需要 PostgreSQL 15+（Supabase 新项目默认 ≥15）。
--    它的作用是让视图按**查询者**的权限与 RLS 执行，避免 anon 通过视图绕过
--    底表的 RLS。若在更低版本执行，请删除 WITH (security_invoker = true)
--    这一行——底表 RLS 与 0003 中对 anon 的 REVOKE 仍然生效。
--
-- 关于重复执行：这里是 drop + create（而不是 create or replace view），
-- 以便日后调整列定义。若已有其他对象依赖本视图，drop 会失败——
-- 此时请先用 create or replace view 手工替换。

drop view if exists public.analysis_long;

create view public.analysis_long
with (security_invoker = true)
as
select
  c.participant_id,
  p.questionnaire_version,
  c.block_id               as assigned_block,
  c.task_id,
  c.task_display_order,
  alt.alternative,
  alt.profile_id,
  alt.x1,
  alt.x2,
  alt.x3,
  (alt.profile_id = c.selected_profile_id) as chosen,
  c.response_duration_ms
from public.dce_choices c
join public.participants p
  on p.participant_id = c.participant_id
cross join lateral (
  values
    ('left'::text,  c.left_profile_id,  c.left_x1,  c.left_x2,  c.left_x3),
    ('right'::text, c.right_profile_id, c.right_x1, c.right_x2, c.right_x3)
) as alt (alternative, profile_id, x1, x2, x3);

comment on view public.analysis_long is
  'DCE 长表（每题 2 行：left/right）。字段：participant_id, questionnaire_version, assigned_block, task_id, task_display_order, alternative, profile_id, x1/x2/x3, chosen, response_duration_ms。分析前建议先筛选 participants.submission_status = ''submitted'' 与指定 questionnaire_version。';


-- ───────────────────────────────────────────────────────────────────────────
-- 12. 管理员判定函数（供 RLS 策略与后台接口使用）
-- ───────────────────────────────────────────────────────────────────────────
--
-- SECURITY DEFINER：以函数属主（postgres = 表的属主）身份读取 research_admins，
-- 因此可以绕过 research_admins 自身的 RLS，避免"策略里调用策略"的无限递归。
-- search_path 固定，防止被劫持。
--
-- 注意：本函数只回答"当前 JWT 的邮箱是否在白名单里"，不返回任何研究数据。

create or replace function public.is_research_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.research_admins a
    where lower(a.email) = lower(
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
        nullif(current_setting('request.jwt.claim.email', true), '')
      )
    )
  );
$$;

comment on function public.is_research_admin() is
  '当前请求（JWT）的邮箱是否在 research_admins 白名单中。SECURITY DEFINER，只返回 boolean，不泄露任何研究数据。';

-- 供服务端（service_role）在导出接口中校验"某个已登录邮箱是否为管理员"。
-- 只允许 service_role 执行：普通 authenticated 用户不需要、也不允许查询他人邮箱。
create or replace function public.is_research_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.research_admins a
    where lower(a.email) = lower(nullif(btrim(p_email), ''))
  );
$$;

comment on function public.is_research_admin_email(text) is
  '判断给定邮箱是否为研究管理员。仅 service_role 可执行（见 0003_grants.sql）。';


-- ───────────────────────────────────────────────────────────────────────────
-- 13. 原子写入函数 submit_survey(payload jsonb)
-- ───────────────────────────────────────────────────────────────────────────
--
-- 服务端接口 api/submit-survey.ts 只调用这一个函数：
--     supabase.rpc('submit_survey', { payload })
--
-- 为什么必须是单一函数：
--   * PostgREST 的每次 REST 调用都是独立事务；本函数在一次函数调用（= 一个事务）
--     内完成 7 张表的写入。任何一步失败 → 整个问卷回滚，不会留下"半份数据"。
--   * 函数内先做重复提交检查并对 participants 行加锁（FOR UPDATE），
--     并发下由 participants.participant_id 唯一约束兜底 → 只有一份正式数据。
--
-- 入参 payload 的键与前端 SurveySubmission 一致（camelCase），另有两个服务端补充键：
--     comprehension[].firstAnswer  服务端根据选项索引还原出的选项文字
--     userAgent                    提交请求的 User-Agent
--
-- 安全：SECURITY DEFINER + search_path 固定；执行权限只授予 service_role
--       （见 0003_grants.sql），anon/authenticated 无法调用。

create or replace function public.submit_survey(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_participant_id text;
  v_version        text;
  v_block          text;
  v_status         text;
  v_dce            jsonb;
  v_ratings        jsonb;
  v_comprehension  jsonb;
  v_events         jsonb;
  v_overall        jsonb;
  v_identity       jsonb;
  v_custom         jsonb;
begin
  -- ── 0. 取出标量字段并把数组字段安全归一化 ───────────────────────────────
  v_identity       := case when jsonb_typeof(payload -> 'identity')       = 'object' then payload -> 'identity'       else '{}'::jsonb end;
  v_overall        := case when jsonb_typeof(payload -> 'overall')        = 'object' then payload -> 'overall'        else '{}'::jsonb end;
  v_dce            := case when jsonb_typeof(payload -> 'dceChoices')     = 'array'  then payload -> 'dceChoices'     else '[]'::jsonb end;
  v_ratings        := case when jsonb_typeof(payload -> 'profileRatings') = 'array'  then payload -> 'profileRatings' else '[]'::jsonb end;
  v_comprehension  := case when jsonb_typeof(payload -> 'comprehension')  = 'array'  then payload -> 'comprehension'  else '[]'::jsonb end;
  v_events         := case when jsonb_typeof(payload -> 'simulationEvents') = 'array' then payload -> 'simulationEvents' else '[]'::jsonb end;
  v_custom         := case when jsonb_typeof(payload -> 'customConfig')      = 'object' then payload -> 'customConfig'      else 'null'::jsonb end;

  v_participant_id := nullif(btrim(payload ->> 'participantId'), '');
  v_version        := nullif(btrim(payload ->> 'questionnaireVersion'), '');
  v_block          := nullif(btrim(payload ->> 'assignedBlock'), '');

  -- ── 1. 最小完整性守卫（服务端已用 zod 校验过；此处给出清晰的数据库错误） ──
  if v_participant_id is null then
    raise exception 'participantId is required' using errcode = '22023';
  end if;
  if v_version is null then
    raise exception 'questionnaireVersion is required' using errcode = '22023';
  end if;
  if v_block is null or v_block not in ('A', 'B') then
    raise exception 'assignedBlock must be A or B' using errcode = '22023';
  end if;
  if v_identity ->> 'ageGroup' is null
     or v_identity ->> 'respondentRole' is null
     or v_identity ->> 'aiDeviceExperience' is null
     or v_identity ->> 'caregivingExperience' is null then
    raise exception 'identity (Q2-Q5) is incomplete' using errcode = '22023';
  end if;
  if v_overall ->> 'q8' is null or v_overall ->> 'q9' is null then
    raise exception 'overall (Q8/Q9) is incomplete' using errcode = '22023';
  end if;
  if payload ->> 'startedAt' is null or payload ->> 'submittedAt' is null then
    raise exception 'startedAt/submittedAt is required' using errcode = '22023';
  end if;
  -- 模块六为必填（V1.0 之外新增，见 docs/RESEARCH_NOTES.md E 节）
  if v_custom ->> 'X1' is null
     or v_custom ->> 'X2' is null
     or v_custom ->> 'X3' is null then
    raise exception 'customConfig (X1/X2/X3) is required' using errcode = '22023';
  end if;

  -- ── 2. 问卷版本必须已登记且处于启用状态 ─────────────────────────────────
  if not exists (
    select 1 from public.questionnaire_versions qv
    where qv.id = v_version and qv.is_active
  ) then
    raise exception 'questionnaire version % is not registered or not active', v_version
      using errcode = '22023';
  end if;

  -- ── 3. 重复提交检查（行锁 + 唯一约束双保险） ─────────────────────────────
  select p.submission_status
    into v_status
    from public.participants p
   where p.participant_id = v_participant_id
     for update;

  if v_status = 'submitted' then
    -- 23505 = unique_violation → 服务端映射为 HTTP 409
    raise exception 'duplicate submission for participant %', v_participant_id
      using errcode = '23505';
  end if;

  -- ── 4. 主表：新建，或覆盖同 participant_id 的 draft/failed 记录 ──────────
  insert into public.participants (
    participant_id, questionnaire_version, consent_status,
    age_group, respondent_role, respondent_role_other,
    ai_device_experience, caregiving_experience,
    assigned_block, prior_experience,
    started_at, submitted_at, total_duration_ms, submission_status
  ) values (
    v_participant_id,
    v_version,
    coalesce(nullif(payload ->> 'consentStatus', ''), 'agreed'),
    v_identity ->> 'ageGroup',
    v_identity ->> 'respondentRole',
    coalesce(v_identity ->> 'respondentRoleOther', ''),
    v_identity ->> 'aiDeviceExperience',
    v_identity ->> 'caregivingExperience',
    v_block,
    coalesce((payload ->> 'priorExperience')::boolean, false),
    (payload ->> 'startedAt')::timestamptz,
    (payload ->> 'submittedAt')::timestamptz,
    nullif(payload ->> 'totalDurationMs', '')::integer,
    'submitted'
  )
  on conflict (participant_id) do update set
    questionnaire_version = excluded.questionnaire_version,
    consent_status        = excluded.consent_status,
    age_group             = excluded.age_group,
    respondent_role       = excluded.respondent_role,
    respondent_role_other = excluded.respondent_role_other,
    ai_device_experience  = excluded.ai_device_experience,
    caregiving_experience = excluded.caregiving_experience,
    assigned_block        = excluded.assigned_block,
    prior_experience      = excluded.prior_experience,
    started_at            = excluded.started_at,
    submitted_at          = excluded.submitted_at,
    total_duration_ms     = excluded.total_duration_ms,
    submission_status     = excluded.submission_status;

  -- ── 5. 子表：先清空同一参与者的旧行（重试场景），再整批写入 ──────────────
  -- survey_sessions 例外：保留历史行（追加式审计），不做删除。
  delete from public.dce_choices         where participant_id = v_participant_id;
  delete from public.profile_ratings     where participant_id = v_participant_id;
  delete from public.comprehension_checks where participant_id = v_participant_id;
  delete from public.simulation_events   where participant_id = v_participant_id;
  delete from public.survey_responses    where participant_id = v_participant_id;
  delete from public.custom_config_choices where participant_id = v_participant_id;

  -- 6.1 DCE 选择
  insert into public.dce_choices (
    participant_id, task_id, block_id, task_display_order,
    left_profile_id, right_profile_id, selected_side, selected_profile_id,
    left_x1, left_x2, left_x3, right_x1, right_x2, right_x3, response_duration_ms
  )
  select
    v_participant_id,
    item ->> 'taskId',
    item ->> 'blockId',
    (item ->> 'taskDisplayOrder')::smallint,
    item ->> 'leftProfileId',
    item ->> 'rightProfileId',
    item ->> 'selectedSide',
    item ->> 'selectedProfileId',
    (item -> 'leftProfileAttributes'  ->> 'X1')::smallint,
    (item -> 'leftProfileAttributes'  ->> 'X2')::smallint,
    (item -> 'leftProfileAttributes'  ->> 'X3')::smallint,
    (item -> 'rightProfileAttributes' ->> 'X1')::smallint,
    (item -> 'rightProfileAttributes' ->> 'X2')::smallint,
    (item -> 'rightProfileAttributes' ->> 'X3')::smallint,
    (item ->> 'responseDurationMs')::integer
  from jsonb_array_elements(v_dce) as arr(item);

  -- 6.2 配置感知评价（12 个量表题按列展开）
  insert into public.profile_ratings (
    participant_id, profile_id, x1, x2, x3, rating_order,
    s1, s2, s3, p1, p2, p3, a1, a2, a3, i1, i2, i3
  )
  select
    v_participant_id,
    item ->> 'profileId',
    (item ->> 'X1')::smallint,
    (item ->> 'X2')::smallint,
    (item ->> 'X3')::smallint,
    (item ->> 'ratingOrder')::smallint,
    (item -> 'scores' ->> 'S1')::smallint,
    (item -> 'scores' ->> 'S2')::smallint,
    (item -> 'scores' ->> 'S3')::smallint,
    (item -> 'scores' ->> 'P1')::smallint,
    (item -> 'scores' ->> 'P2')::smallint,
    (item -> 'scores' ->> 'P3')::smallint,
    (item -> 'scores' ->> 'A1')::smallint,
    (item -> 'scores' ->> 'A2')::smallint,
    (item -> 'scores' ->> 'A3')::smallint,
    (item -> 'scores' ->> 'I1')::smallint,
    (item -> 'scores' ->> 'I2')::smallint,
    (item -> 'scores' ->> 'I3')::smallint
  from jsonb_array_elements(v_ratings) as arr(item);

  -- 6.3 理解检查（first_answer 由服务端补充；缺失时退回选项序号字符串）
  insert into public.comprehension_checks (
    participant_id, question_id, first_answer, first_answer_index, is_correct, retry_count
  )
  select
    v_participant_id,
    item ->> 'questionId',
    coalesce(nullif(item ->> 'firstAnswer', ''), 'option_' || (item ->> 'firstAnswerIndex')),
    (item ->> 'firstAnswerIndex')::smallint,
    coalesce((item ->> 'isCorrect')::boolean, false),
    coalesce((item ->> 'retryCount')::smallint, 0)
  from jsonb_array_elements(v_comprehension) as arr(item);

  -- 6.4 模拟使用埋点
  insert into public.simulation_events (
    participant_id, task_id, profile_id, event_type, source,
    event_timestamp_ms, duration_ms
  )
  select
    v_participant_id,
    nullif(item ->> 'taskId', ''),           -- JSON null / 缺省 都会得到 NULL
    item ->> 'profileId',
    item ->> 'eventType',
    item ->> 'source',
    (item ->> 'eventTimestampMs')::integer,
    (item ->> 'durationMs')::integer          -- JSON null → NULL
  from jsonb_array_elements(v_events) as arr(item);

  -- 6.5 总体评价（一人一行）
  insert into public.survey_responses (participant_id, q8, q9, q10)
  values (
    v_participant_id,
    (v_overall ->> 'q8')::smallint,
    v_overall ->> 'q9',
    coalesce(v_overall ->> 'q10', '')
  )
  on conflict (participant_id) do update set
    q8  = excluded.q8,
    q9  = excluded.q9,
    q10 = excluded.q10;

  -- 6.5 自由自选配置（模块六）
  -- 仅当三个水平齐全时写入；服务端 zod 校验已保证其存在（必填）。
  if v_custom ->> 'X1' is not null
     and v_custom ->> 'X2' is not null
     and v_custom ->> 'X3' is not null then
    insert into public.custom_config_choices (
      participant_id, x1, x2, x3, matched_profile_id, response_duration_ms
    ) values (
      v_participant_id,
      (v_custom ->> 'X1')::smallint,
      (v_custom ->> 'X2')::smallint,
      (v_custom ->> 'X3')::smallint,
      nullif(v_custom ->> 'matchedProfileId', ''),
      coalesce((v_custom ->> 'responseDurationMs')::integer, 0)
    );
  else
    -- 缺失即视为数据不完整，整笔事务回滚（不允许"半个问卷"入库）
    raise exception 'customConfig (X1/X2/X3) is required' using errcode = '22023';
  end if;

  -- 6.6 问卷会话（追加式，不删除历史）
  insert into public.survey_sessions (
    participant_id, questionnaire_version, prior_experience,
    user_agent, started_at, submitted_at
  ) values (
    v_participant_id,
    v_version,
    coalesce((payload ->> 'priorExperience')::boolean, false),
    nullif(payload ->> 'userAgent', ''),
    (payload ->> 'startedAt')::timestamptz,
    (payload ->> 'submittedAt')::timestamptz
  );

  -- ── 7. 返回最小回执（不含研究数据，便于服务端确认写入） ──────────────────
  return jsonb_build_object(
    'participantId', v_participant_id,
    'questionnaireVersion', v_version,
    'submissionStatus', 'submitted',
    'dceChoices', jsonb_array_length(v_dce),
    'profileRatings', jsonb_array_length(v_ratings),
    'simulationEvents', jsonb_array_length(v_events)
  );
end;
$$;

comment on function public.submit_survey(jsonb) is
  '在一次事务内写入一份完整问卷（participants + dce_choices + profile_ratings + comprehension_checks + simulation_events + survey_responses + survey_sessions）。仅 service_role 可执行；重复提交抛 23505。';


-- ───────────────────────────────────────────────────────────────────────────
-- 14. 种子数据
-- ───────────────────────────────────────────────────────────────────────────

insert into public.questionnaire_versions (id, description, is_active)
values
  ('V1.0', '初版问卷（模块一至模块五 + DCE A/B 卷各 6 题 + 每人 4 个配置评价）。', true),
  ('V1.1', '在 V1.0 基础上新增模块六「理想配置自由设定」（三个系统设置开关）。', true)
on conflict (id) do nothing;

-- 提示：research_config 为自由键值表，本文件不预置任何键，避免与代码中的常量产生
--       两套"事实来源"。研究者可按需插入，例如：
--       insert into public.research_config (key, value) values ('data_retention_note', '原始数据保存 5 年后删除');

-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════

-- 0001_init.sql 结束。下一步：0002_rls_policies.sql（RLS 与策略）。

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
alter table public.custom_config_choices  enable row level security;


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
-- 模块六：自由自选配置（V1.0 之外新增）
-- ───────────────────────────────────────────────────────────────────────────
-- 与研究数据表同等保护：仅白名单管理员可读；写入只经 submit_survey()。

drop policy if exists custom_config_choices_select_admins on public.custom_config_choices;
create policy custom_config_choices_select_admins on public.custom_config_choices
  for select to authenticated
  using (public.is_research_admin());
comment on policy custom_config_choices_select_admins on public.custom_config_choices is
  '保护对象：参与者自由设定的理想配置（三个开关）。仅白名单管理员可读；写入只经 submit_survey()。';


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
-- ═══════════════════════════════════════════════════════════════════════════

-- 0002_rls_policies.sql 结束。下一步：0003_grants.sql（GRANT / REVOKE）。

-- ═══════════════════════════════════════════════════════════════════════════
-- 0003_grants.sql — 第 3 步：权限（GRANT / REVOKE）
-- 智能养老AI监测系统配置偏好与采纳意愿调查 · 研究数据库
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 前置条件：必须先执行 0001_init.sql 与 0002_rls_policies.sql。
--
-- 为什么不只靠 RLS：
--   RLS 决定"能看到哪些行"，GRANT 决定"能不能碰这张表"。
--   Supabase 默认会把 public schema 下**新建对象**的权限授予 anon/authenticated，
--   所以只写 RLS 策略仍然存在"未来某个新表忘了开 RLS 就被匿名读取"的风险。
--   本文件做三件事：
--     1) 立刻回收 anon 与 authenticated 在现有对象上的全部权限；
--     2) 只把需要的最小权限重新授出去（authenticated 只读 + 两张管理表可写）；
--     3) 修改**默认权限**，让今后新建的表/序列默认对 anon 关闭（默认拒绝）。
--
-- 参与者端不访问数据库：anon 不需要任何表权限。
-- 问卷写入与 CSV 导出由 service_role 完成（它具备 BYPASSRLS）。
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 0. 兼容自建 PostgreSQL：确保角色存在
-- ───────────────────────────────────────────────────────────────────────────
-- Supabase 项目里 anon / authenticated / service_role 已经存在，
-- 因此下面的 DO 块在 Supabase 上是**无操作**（只做一次 pg_roles 查询）。
-- 只有在本地或自建 PostgreSQL 上执行 schema.sql 时才会创建它们
--（自建环境还需按 PostgREST 的 db-anon-role / JWT 配置把角色接到自己的认证体系）。
-- 注意：给 service_role 附加 BYPASSRLS 需要超级用户权限；自建环境请以
--       postgres（超级用户）身份执行，否则请手工 `alter role service_role bypassrls;`。

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 收回 anon / authenticated 在现有对象上的全部权限
-- ───────────────────────────────────────────────────────────────────────────
-- 注意："ALL TABLES IN SCHEMA" 同时涵盖表和视图（含 public.analysis_long）。

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 方案 schema 本身仍需 USAGE（否则报错信息会变成 schema 级拒绝，
-- 不利于排查；真正的数据防护来自上面的表级 REVOKE 与 RLS）。
grant usage on schema public to anon, authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. authenticated（白名单研究人员）：只读 + 两张管理表可写
-- ───────────────────────────────────────────────────────────────────────────
-- RLS 策略（0002）会进一步把可读行限制在"本人是白名单管理员"。

grant select on all tables in schema public to authenticated;

-- 研究运行管理需要写入的两张表（均由 RLS 策略再校验白名单身份）
grant insert, update, delete on public.research_config        to authenticated;
grant insert, update          on public.questionnaire_versions to authenticated;
-- 说明：questionnaire_versions 不给 DELETE —— 版本历史必须保留，
--       否则历史数据的外键与"哪份问卷属于哪个版本"的可追溯性会被破坏。
-- research_admins 不给任何写权限 —— 新增管理员必须走 service_role 或 SQL Editor。


-- ───────────────────────────────────────────────────────────────────────────
-- 3. service_role（仅服务端使用，绝不进入前端）
-- ───────────────────────────────────────────────────────────────────────────
-- service_role 具备 BYPASSRLS，但仍需要表级 GRANT 才能读写。

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. 函数执行权限
-- ───────────────────────────────────────────────────────────────────────────
-- 4.1 submit_survey()：唯一的写入通道，只允许 service_role 调用。
--     若允许 anon/authenticated 调用，任何人都能凭 anon key 直接写研究数据，
--     绕过服务端的版本校验、重复提交检查与语义校验。

revoke execute on function public.submit_survey(jsonb) from public, anon, authenticated;
grant  execute on function public.submit_survey(jsonb) to service_role;

-- 4.2 is_research_admin_email()：后台导出接口用它校验"登录邮箱是否管理员"，
--     只允许服务端调用（普通用户没有理由查询他人是否为管理员）。

revoke execute on function public.is_research_admin_email(text) from public, anon, authenticated;
grant  execute on function public.is_research_admin_email(text) to service_role;

-- 4.3 is_research_admin()：RLS 策略内部需要以 authenticated 身份执行，
--     因此必须授予 authenticated；它只返回 boolean，不泄露任何数据。
--     anon 一律不授予（anon 没有任何策略，用不到该函数）。

revoke execute on function public.is_research_admin() from public, anon;
grant  execute on function public.is_research_admin() to authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. 未来对象默认权限：默认拒绝 anon
-- ───────────────────────────────────────────────────────────────────────────
-- 只对"由当前角色（迁移执行者，通常是 postgres）创建"的对象生效。
-- 这是纵深防御：即使日后新增表忘记写 RLS，anon 也读不到。

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- 注意：默认权限同时把函数执行权从 anon 收回。若今后确实需要让匿名前端
-- 调用某个函数（本研究的设计**不需要**），必须显式 GRANT EXECUTE 并说明理由。


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 自检（执行后可在 SQL Editor 中运行以下查询核对）
-- ───────────────────────────────────────────────────────────────────────────
--   -- 6.1 anon 是否对任何 public 对象还有权限？（应返回 0 行）
--   select table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee = 'anon' and table_schema = 'public';
--
--   -- 6.2 authenticated 的权限清单（应只有 SELECT，外加两张管理表）
--   select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privs
--     from information_schema.role_table_grants
--    where grantee = 'authenticated' and table_schema = 'public'
--    group by table_name order by table_name;
--
--   -- 6.3 函数执行权（submit_survey / is_research_admin_email 只应有 service_role）
--   select p.proname, proacl from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('submit_survey', 'is_research_admin', 'is_research_admin_email');
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════

-- 0003_grants.sql 结束。数据库初始化完成，继续阅读 supabase/README.md。
