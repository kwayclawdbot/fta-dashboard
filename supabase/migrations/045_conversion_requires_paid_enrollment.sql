-- 045 — conversion = active PAID enrollment (not merely "has a profile")
--
-- A free tier is being added (free-class funnel: source 'free_class' signups
-- create real auth users + profiles immediately). Those must NOT auto-convert.
-- "Converted" now means: the lead's email belongs to a family with an ACTIVE
-- enrollment in a paid program (fic or fta). A lead that has a profile but no
-- paid enrollment is escalated to 'engaged' at most (they showed intent by
-- creating an account) — never 'converted'.

create or replace function admin_marketing_sync_conversions()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_ids uuid[] := '{}'; v_count int := 0; v_engaged int := 0;
begin
  perform _mkt_require_admin();

  for r in
    select l.id as lead_id, l.stage as cur_stage, p.id as profile_id,
           exists (
             select 1 from enrollments e
             where e.family_id = p.family_id
               and e.program in ('fic','fta')
               and e.status = 'active'
           ) as paid
    from marketing_leads l
    join profiles p on lower(p.email) = lower(l.email::text)
    where l.stage not in ('converted','unsubscribed')
  loop
    if r.paid then
      update marketing_leads set
        stage = 'converted', converted_profile_id = r.profile_id,
        last_activity_at = now(), updated_at = now()
      where id = r.lead_id;
      insert into marketing_lead_events (lead_id, type, meta)
      values (r.lead_id, 'converted', jsonb_build_object('profile_id', r.profile_id, 'auto', true, 'reason', 'active_paid_enrollment'));
      v_ids := v_ids || r.lead_id; v_count := v_count + 1;
    elsif r.cur_stage in ('new','contacted') then
      -- has an account but no paid enrollment (e.g. free_class): cap at engaged.
      update marketing_leads set
        stage = 'engaged', last_activity_at = now(), updated_at = now()
      where id = r.lead_id;
      insert into marketing_lead_events (lead_id, type, meta)
      values (r.lead_id, 'stage_changed', jsonb_build_object('from', r.cur_stage, 'to', 'engaged', 'auto', true, 'reason', 'has_account_no_paid_enrollment'));
      v_engaged := v_engaged + 1;
    end if;
  end loop;

  return jsonb_build_object('converted', v_count, 'ids', to_jsonb(v_ids), 'engaged', v_engaged);
end; $$;
grant execute on function admin_marketing_sync_conversions() to authenticated;
