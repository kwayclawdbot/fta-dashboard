import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToTransfer,
  normalizeDesignState,
  type TransferRow,
} from "@/lib/ownership/shape";
import type {
  TransferCardSummary,
  TransferInbox,
  TransferListItem,
} from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/transfers — the caller's gift inbox.
 *
 * incoming = pending gifts headed to the caller (or, for a parent, to their kid);
 * outgoing = every gift the caller has sent (any status), newest first.
 *
 * Transfer rows are read through the RLS-scoped user client (so the caller only
 * ever sees transfers they're a party to). Card summaries + counterpart display
 * names are then enriched with the admin client — needed because during a transfer
 * the recipient is NOT yet the card owner, so RLS on ownership_cards won't expose
 * the card to them. Only rows the user is already entitled to see are enriched.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("card_transfers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as TransferRow[];
  if (rows.length === 0) {
    return NextResponse.json({ incoming: [], outgoing: [] } as TransferInbox);
  }

  // Split: mine-sent vs headed-to-me (I'm the recipient or a supervising parent).
  const outgoingRows = rows.filter((r) => r.from_user === user.id);
  const incomingRows = rows.filter(
    (r) => r.from_user !== user.id && r.status === "pending"
  );
  const relevant = [...outgoingRows, ...incomingRows];

  // Enrich card summaries + counterpart profiles via the admin client.
  const db = createAdminClient();
  const cardIds = Array.from(new Set(relevant.map((r) => r.card_id)));
  const userIds = Array.from(
    new Set(relevant.map((r) => (r.from_user === user.id ? r.to_user : r.from_user)))
  );

  const [cardsRes, profilesRes] = await Promise.all([
    cardIds.length
      ? db
          .from("ownership_cards")
          .select("id, serial, asset_symbol, asset_name, denomination, status, design_state")
          .in("id", cardIds)
      : Promise.resolve({ data: [] as unknown[] }),
    userIds.length
      ? db.from("profiles").select("id, display_name, username").in("id", userIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const cardMap = new Map<string, TransferCardSummary>();
  for (const c of (cardsRes.data || []) as {
    id: string;
    serial: string;
    asset_symbol: string;
    asset_name: string | null;
    denomination: number | string;
    status: TransferCardSummary["status"];
    design_state: unknown;
  }[]) {
    cardMap.set(c.id, {
      id: c.id,
      serial: c.serial,
      assetSymbol: c.asset_symbol,
      assetName: c.asset_name,
      denomination: typeof c.denomination === "number" ? c.denomination : Number(c.denomination),
      status: c.status,
      designState: normalizeDesignState(c.design_state),
    });
  }

  const profileMap = new Map<string, { displayName: string; username: string | null }>();
  for (const p of (profilesRes.data || []) as {
    id: string;
    display_name: string;
    username: string | null;
  }[]) {
    profileMap.set(p.id, { displayName: p.display_name, username: p.username });
  }

  const toItem = (r: TransferRow): TransferListItem => {
    const counterpartId = r.from_user === user.id ? r.to_user : r.from_user;
    return {
      transfer: rowToTransfer(r),
      card: cardMap.get(r.card_id) ?? null,
      counterpart: profileMap.get(counterpartId) ?? null,
    };
  };

  return NextResponse.json({
    incoming: incomingRows.map(toItem),
    outgoing: outgoingRows.map(toItem),
  } as TransferInbox);
}
