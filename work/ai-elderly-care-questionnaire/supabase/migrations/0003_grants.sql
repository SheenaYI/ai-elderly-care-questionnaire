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
-- 0003_grants.sql 结束。数据库初始化完成，继续阅读 supabase/README.md。
-- ═══════════════════════════════════════════════════════════════════════════
