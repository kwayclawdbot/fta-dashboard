-- 044 — fix admin_marketing_segment_leads
--
-- The 043 definition ordered by t.last_activity_at but that column was not
-- selected into the subquery `t`, raising 42703 (column does not exist) — which
-- broke the campaign builder's live recipient count. Add last_activity_at to
-- the projection so the ordering resolves. Behavior otherwise unchanged.

create or replace function admin_marketing_segment_leads(p_segment jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_stages text[]; v_tags text[]; v_result jsonb;
begin
  perform _mkt_require_admin();
  v_stages := case when jsonb_typeof(p_segment->'stages') = 'array'
                   then array(select jsonb_array_elements_text(p_segment->'stages')) else '{}'::text[] end;
  v_tags := case when jsonb_typeof(p_segment->'tags') = 'array'
                 then array(select jsonb_array_elements_text(p_segment->'tags')) else '{}'::text[] end;
  select coalesce(jsonb_agg(row_to_json(t) order by t.last_activity_at desc), '[]'::jsonb)
  into v_result
  from (
    select l.id, l.email::text as email, l.first_name, l.last_name, l.phone,
           l.stage, l.tags, l.last_activity_at
    from marketing_leads l
    where l.stage <> 'unsubscribed'
      and (array_length(v_stages,1) is null or l.stage = any(v_stages))
      and (array_length(v_tags,1) is null or l.tags && v_tags)
  ) t;
  return v_result;
end; $$;
grant execute on function admin_marketing_segment_leads(jsonb) to authenticated;
