-- V2.3 增量迁移。只新增对象，不覆盖旧表、旧 RPC、历史答卷或旧 RLS。
-- 执行前阅读 outputs/V2.3_Supabase操作手册.md；未经负责人确认不要在正式库执行。
begin;

insert into public.questionnaire_versions(id, description, is_active)
values ('V2.3', '双卷：老人三档偏好/授权实验；照护者4道DCE；2配置×8项评分。', false)
on conflict (id) do nothing;

create table if not exists public.survey_v23_submissions (
  participant_id uuid primary key,
  survey_version text not null references public.questionnaire_versions(id) check (survey_version = 'V2.3'),
  respondent_type text not null check (respondent_type in ('elder','caregiver')),
  sample_channel text not null check (sample_channel in ('formal','pilot','test')),
  split_version text check (split_version in ('A','B')),
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  constraint survey_v23_split_matches_type check (
    (respondent_type = 'elder' and split_version is null) or
    (respondent_type = 'caregiver' and split_version is not null)
  ),
  constraint survey_v23_metadata_matches check (
    payload->>'survey_version' = survey_version and
    payload->>'participant_id' = participant_id::text and
    payload->>'respondent_type' = respondent_type and
    payload->>'sample_channel' = sample_channel and
    (payload->>'split_version') is not distinct from split_version
  )
);
comment on table public.survey_v23_submissions is 'V2.3完整原始答卷。一行一份，正式/预测试/功能测试分开标记；原始结构化JSON不丢弃。未提交草稿仅在浏览器，不进入本表。';
create index if not exists survey_v23_filter_idx on public.survey_v23_submissions(survey_version, sample_channel, respondent_type, split_version);

alter table public.survey_v23_submissions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='survey_v23_submissions' and policyname='v23_admin_read') then
    create policy v23_admin_read on public.survey_v23_submissions for select to authenticated using (public.is_research_admin());
  end if;
end $$;
revoke all on public.survey_v23_submissions from anon, authenticated;
grant select on public.survey_v23_submissions to authenticated;
grant all on public.survey_v23_submissions to service_role;

create or replace function public.submit_survey_v23(payload jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p_id uuid; p_type text; p_split text; w jsonb; r jsonb; c jsonb; stored jsonb;
  expected_a text; expected_b text; expected_tasks text[]; found_tasks text[];
begin
  if payload->>'survey_version' is distinct from 'V2.3' or payload->>'consent' is distinct from 'true' or payload->>'eligible' is distinct from 'true' then
    raise exception using errcode='22023', message='Invalid survey version, consent or eligibility';
  end if;
  if not exists (select 1 from public.questionnaire_versions where id='V2.3' and is_active) then
    raise exception using errcode='22023', message='V2.3 is not active';
  end if;
  p_id := (payload->>'participant_id')::uuid;
  p_type := payload->>'respondent_type'; p_split := payload->>'split_version';
  if p_type not in ('elder','caregiver') or p_type is null then raise exception using errcode='22023',message='Invalid respondent type'; end if;
  if p_type='caregiver' and payload#>>'{answers,b0}' is distinct from '0' then raise exception using errcode='22023',message='Actual caregiver required'; end if;
  if jsonb_array_length(payload->'rating_plan') is distinct from 2 or jsonb_array_length(payload->'profile_ratings') is distinct from 2 or payload#>>'{rating_plan,0}' = payload#>>'{rating_plan,1}' then
    raise exception using errcode='22023',message='Two distinct ratings required';
  end if;
  -- 每项分数必须存在，绝不把空值填成0。
  for r in select value from jsonb_array_elements(payload->'profile_ratings') loop
    foreach expected_a in array array['s1','s2','p1','p2','a1','a2','i1','i2'] loop
      if (r->'scores'->>expected_a)::integer not between 1 and 5 or r->'scores'->>expected_a is null then
        raise exception using errcode='22023',message='Missing or invalid rating';
      end if;
    end loop;
  end loop;
  w := payload->'weight_allocation';
  if w->>'mode' = 'scores' then
    if w#>>'{scores,security}' is null or w#>>'{scores,privacy}' is null or w#>>'{scores,autonomy}' is null or
       (w#>>'{scores,security}')::integer not between 0 and 100 or
       (w#>>'{scores,privacy}')::integer not between 0 and 100 or
       (w#>>'{scores,autonomy}')::integer not between 0 and 100 or
       (w#>>'{scores,security}')::integer + (w#>>'{scores,privacy}')::integer + (w#>>'{scores,autonomy}')::integer <> 100 then
      raise exception using errcode='22023',message='Weight allocation must total 100';
    end if;
  elsif p_type='elder' and w->>'mode'='ranking_only' then
    if w#>>'{scores,security}' is not null or w#>>'{scores,privacy}' is not null or w#>>'{scores,autonomy}' is not null then
      raise exception using errcode='22023',message='Ranking only must not include scores';
    end if;
  else raise exception using errcode='22023',message='Invalid weight mode'; end if;
  if p_type='elder' then
    if (select array_agg(value order by value) from jsonb_array_elements_text(w->'ranking')) is distinct from array['autonomy','privacy','security'] then
      raise exception using errcode='22023',message='Three distinct ranking entries required';
    end if;
    foreach expected_a in array array['X1','X2','X3'] loop
      if payload->'elder_preferences'->>expected_a is null or payload->'elder_preferences'->>expected_a not in ('0','50','100') then raise exception using errcode='22023',message='Invalid three-level preference'; end if;
    end loop;
    if jsonb_array_length(payload->'dce_choices') is distinct from 0 or jsonb_array_length(payload->'autonomy_choices') is distinct from 6 then raise exception using errcode='22023',message='Invalid elder experiment count'; end if;
    if (select array_agg(value->>'scenario_id' order by value->>'scenario_id') from jsonb_array_elements(payload->'autonomy_choices')) is distinct from array['C4_children','C4_self','C7_children','C7_self','C8_children','C8_self'] then raise exception using errcode='22023',message='Invalid autonomy scenarios'; end if;
  else
    expected_tasks := case p_split when 'A' then array['T01','T02','T07','T08'] when 'B' then array['T04','T05','T06','T10'] end;
    select array_agg(value->>'task_id' order by value->>'task_id') into found_tasks from jsonb_array_elements(payload->'dce_choices');
    if expected_tasks is null or found_tasks is distinct from expected_tasks then raise exception using errcode='22023',message='Invalid split task coverage'; end if;
    for c in select value from jsonb_array_elements(payload->'dce_choices') loop
      expected_a := case c->>'task_id' when 'T01' then 'C1' when 'T02' then 'C5' when 'T07' then 'C3' when 'T08' then 'C3' when 'T04' then 'C2' when 'T05' then 'C2' when 'T06' then 'C2' when 'T10' then 'C3' end;
      expected_b := case c->>'task_id' when 'T01' then 'C3' when 'T02' then 'C6' when 'T07' then 'C5' when 'T08' then 'C7' when 'T04' then 'C4' when 'T05' then 'C6' when 'T06' then 'C8' when 'T10' then 'C4' end;
      if c->>'scheme_a_configuration_id' is distinct from expected_a or c->>'scheme_b_configuration_id' is distinct from expected_b or
        not ((c->>'left_configuration_id'=expected_a and c->>'right_configuration_id'=expected_b) or (c->>'left_configuration_id'=expected_b and c->>'right_configuration_id'=expected_a)) or
        c->>'selected_side' not in ('left','right') or
        c->>'selected_configuration_id' is distinct from (case c->>'selected_side' when 'left' then c->>'left_configuration_id' when 'right' then c->>'right_configuration_id' end) then
        raise exception using errcode='22023',message='DCE mapping mismatch';
      end if;
    end loop;
  end if;
  insert into public.survey_v23_submissions(participant_id,survey_version,respondent_type,sample_channel,split_version,started_at,payload)
    values (p_id,'V2.3',p_type,payload->>'sample_channel',p_split,(payload->>'started_at')::timestamptz,payload)
    on conflict(participant_id) do nothing;
  -- 相同答案的网络重试幂等；不同答案不得覆盖已提交答卷。
  select s.payload into stored from public.survey_v23_submissions s where participant_id=p_id;
  if (stored - 'submitted_at' - 'updated_at') is distinct from (payload - 'submitted_at' - 'updated_at') then
    raise exception using errcode='23505',message='Submission already exists with different answers';
  end if;
end $$;
revoke all on function public.submit_survey_v23(jsonb) from public, anon, authenticated;
grant execute on function public.submit_survey_v23(jsonb) to service_role;

-- security_invoker 使查询视图沿用底表 RLS；PG15+（Supabase）支持。
create or replace view public.survey_v23_dce with (security_invoker = true) as
 select s.participant_id, s.survey_version, s.respondent_type, s.sample_channel, s.split_version,
 c->>'task_id' as task_id, (c->>'display_order')::int as display_order,
 c->>'scheme_a_configuration_id' as scheme_a_configuration_id, c->>'scheme_b_configuration_id' as scheme_b_configuration_id,
 c->>'left_configuration_id' as left_configuration_id, c->>'right_configuration_id' as right_configuration_id,
 c->>'selected_side' as selected_side, c->>'selected_configuration_id' as selected_configuration_id,
 (c->>'response_duration_ms')::int as response_duration_ms
 from public.survey_v23_submissions s cross join lateral jsonb_array_elements(s.payload->'dce_choices') c;

create or replace view public.survey_v23_ratings with (security_invoker = true) as
 select s.participant_id,s.survey_version,s.respondent_type,s.sample_channel,
 r->>'configuration_id' as configuration_id,(r->>'rating_order')::int as rating_order,r->>'wording_version' as wording_version,
 i.key as item_id,(i.value)::int as score
 from public.survey_v23_submissions s cross join lateral jsonb_array_elements(s.payload->'profile_ratings') r
 cross join lateral jsonb_each_text(r->'scores') i;

create or replace view public.survey_v23_answers with (security_invoker = true) as
 select s.participant_id,s.survey_version,s.respondent_type,s.sample_channel,a.key as question_id,a.value as answer
 from public.survey_v23_submissions s cross join lateral jsonb_each(s.payload->'answers') a
 union all
 select s.participant_id,s.survey_version,s.respondent_type,s.sample_channel,c->>'question_id',c
 from public.survey_v23_submissions s cross join lateral jsonb_array_elements(s.payload->'comprehension') c;

revoke all on public.survey_v23_dce,public.survey_v23_ratings,public.survey_v23_answers from anon,authenticated;
grant select on public.survey_v23_dce,public.survey_v23_ratings,public.survey_v23_answers to authenticated,service_role;
commit;

-- 验收后，负责人另行批准开放收集：
-- update public.questionnaire_versions set is_active=true where id='V2.3';
