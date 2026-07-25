-- 134_membership_lead_source.sql
--
-- Cheat Code Club $99/mo membership checkout (marketing-site guest checkout)
-- upserts its buyers into marketing_leads with source='membership' so they
-- surface in the CRM alongside the funnel/challenge cohorts. Widen the source
-- CHECK to admit that value. Narrow, additive cross-module add — existing values
-- are unaffected. (consent_source is unconstrained free text; 'club_membership'
-- needs no schema change.)
alter table marketing_leads drop constraint if exists marketing_leads_source_check;
alter table marketing_leads add constraint marketing_leads_source_check
  check (source in ('csv', 'facebook', 'manual', 'referral', 'free_class', 'challenge', 'membership'));
