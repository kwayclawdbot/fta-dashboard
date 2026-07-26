-- 137 — Server-side kid wall for the Stock Screener data.
--
-- The screener UI already hides itself from young kids (the nav never surfaces
-- it, and ScreenerSurface renders a restricted view when age_group='kids' /
-- role='child'), but the underlying tables were readable by ANY authenticated
-- member — so a kid could reach the full ~11.5k-ticker universe by hitting
-- /screener directly or querying screener_metrics via PostgREST. The page now
-- redirects kids server-side; this migration closes the data door to match.
--
-- viewer_is_kid() mirrors src/lib/register.ts deriveRegister precedence exactly
-- (age_group → role → legacy track → default adult) so teens and adults are
-- unaffected and keep full screener access.

create or replace function public.viewer_is_kid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case p.age_group
      when 'kids'   then 'kids'
      when 'teens'  then 'teens'
      when 'adults' then 'adults'
      else null
    end,
    case p.role
      when 'child' then 'kids'
      when 'teen'  then 'teens'
      else null
    end,
    case p.track
      when 'kids'  then 'kids'
      when 'teens' then 'teens'
      else null
    end,
    'adults'
  ) = 'kids'
  from profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.viewer_is_kid() to authenticated;

-- Re-scope the screener read policies: authenticated, but not young kids. A
-- viewer with no profile row (edge case) coalesces to non-kid → still allowed,
-- matching deriveRegister's default-to-adult behaviour.
drop policy if exists "Read screener metrics" on screener_metrics;
create policy "Read screener metrics" on screener_metrics
  for select to authenticated using (not coalesce(public.viewer_is_kid(), false));

drop policy if exists "Read screener meta" on screener_meta;
create policy "Read screener meta" on screener_meta
  for select to authenticated using (not coalesce(public.viewer_is_kid(), false));
