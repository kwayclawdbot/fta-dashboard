import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin funnel analytics data layer. Reads through the SECURITY DEFINER RPCs
 * added in migration 070 (admin_funnel_analytics / admin_funnel_partial_leads),
 * each of which enforces role='admin' internally — so these fetchers are only
 * useful to an admin session, which the (admin) layout already gates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface FunnelStep {
  step: string;
  ord: number;
  sessions: number;
}
export interface FunnelSource {
  source: string;
  sessions: number;
  email_captured: number;
  registered: number;
}
export interface FunnelTotals {
  sessions: number;
  engaged: number;
  email_captured: number;
  registered: number;
}
export interface FunnelAnalytics {
  steps: FunnelStep[];
  sources: FunnelSource[];
  totals: FunnelTotals;
}
export interface PartialLead {
  id: string;
  email: string;
  phone: string | null;
  sms_optin: boolean;
  status: string;
  answers: Record<string, string>;
  utm_source: string;
  utm_campaign: string | null;
  created_at: string;
  updated_at: string;
}

export const STEP_LABEL: Record<string, string> = {
  landing: "Landing",
  q1: "Q1 · Who's learning",
  q2: "Q2 · Goal",
  q3: "Q3 · Level",
  save: "Email captured",
  result: "Result viewed",
  register: "Registered",
};

export async function fetchFunnelAnalytics(
  db: DB,
  fromIso: string,
  toIso: string,
  funnel = "free_class"
): Promise<FunnelAnalytics> {
  const { data, error } = await db.rpc("admin_funnel_analytics", {
    p_funnel: funnel,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) throw new Error(error.message);
  const d = (data || {}) as Partial<FunnelAnalytics>;
  return {
    steps: d.steps || [],
    sources: d.sources || [],
    totals: d.totals || { sessions: 0, engaged: 0, email_captured: 0, registered: 0 },
  };
}

export async function fetchFunnelPartialLeads(
  db: DB,
  fromIso: string,
  toIso: string,
  funnel = "free_class"
): Promise<PartialLead[]> {
  const { data, error } = await db.rpc("admin_funnel_partial_leads", {
    p_funnel: funnel,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) throw new Error(error.message);
  return (data || []) as PartialLead[];
}

/** Percent of a relative to b (b=0 → 0), rounded. */
export function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}
