-- 待研究负责人确认后，由队友在 Supabase SQL Editor 执行；本文件未自动执行。
-- 前置：0005_survey_v23.sql。只修改原 RPC 的排序校验条件。
-- 不改表、历史答卷、函数签名、RLS 或任何 GRANT；CREATE OR REPLACE 保留权限。
-- 修订标识 instrument_revision 存于已有 payload JSONB，无需新增数据库列。
begin;
do $migration$
declare
  function_sql text;
  old_check text := $old$if (select array_agg(value order by value) from jsonb_array_elements_text(w->'ranking')) is distinct from array['autonomy','privacy','security'] then$old$;
  new_check text := $new$if (w->>'mode'='ranking_only' or jsonb_array_length(w->'ranking') > 0) and (select array_agg(value order by value) from jsonb_array_elements_text(w->'ranking')) is distinct from array['autonomy','privacy','security'] then$new$;
begin
  if to_regprocedure('public.submit_survey_v23(jsonb)') is null then
    raise exception '请先审查并执行 0005_survey_v23.sql';
  end if;
  select pg_get_functiondef('public.submit_survey_v23(jsonb)'::regprocedure) into function_sql;
  if strpos(function_sql, new_check) > 0 then
    raise notice '0006 已执行，无需重复修改';
  elsif strpos(function_sql, old_check) > 0 then
    execute replace(function_sql, old_check, new_check);
  else
    raise exception '数据库函数与预期版本不同，已中止。请交研究团队审查，不要强行覆盖。';
  end if;
end;
$migration$;
commit;

-- 执行后只读检查：
-- select pg_get_functiondef('public.submit_survey_v23(jsonb)'::regprocedure);
-- select proname, proacl from pg_proc where oid='public.submit_survey_v23(jsonb)'::regprocedure;
