import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/require-admin";
import { PRODUCT_SELECT } from "@/lib/shop";

export const dynamic = "force-dynamic";

const EDITABLE = [
  "slug",
  "title",
  "subtitle",
  "description",
  "audience",
  "kind",
  "price_cents",
  "compare_at_cents",
  "cover_image_path",
  "gallery",
  "lulu_pod_package_id",
  "interior_pdf_path",
  "cover_pdf_path",
  "page_count",
  "active",
  "sort",
] as const;

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) out[k] = body[k];
  return out;
}

// GET → all products (incl inactive) + bundle membership.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const { data: products } = await auth.db
    .from("shop_products")
    .select(PRODUCT_SELECT)
    .order("sort", { ascending: true });

  const { data: bundleItems } = await auth.db
    .from("shop_bundle_items")
    .select("bundle_id, product_id, sort")
    .order("sort", { ascending: true });

  return NextResponse.json({ products: products || [], bundleItems: bundleItems || [] });
}

// POST → create or update (upsert by id when present).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = body.id ? String(body.id) : null;
  const patch = pick(body);

  if (!id) {
    if (!patch.slug || !patch.title || patch.price_cents == null)
      return NextResponse.json({ error: "slug, title, price_cents required" }, { status: 400 });
    const { data, error } = await auth.db
      .from("shop_products")
      .insert(patch)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id });
  }

  patch.updated_at = new Date().toISOString();
  const { error } = await auth.db.from("shop_products").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id });
}

// DELETE ?id= → remove a product (cascades bundle_items).
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const { error } = await auth.db.from("shop_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// PUT → replace a bundle's member items. Body { bundle_id, product_ids: [] }.
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as {
    bundle_id?: string;
    product_ids?: string[];
  };
  if (!body.bundle_id || !Array.isArray(body.product_ids))
    return NextResponse.json({ error: "bundle_id + product_ids required" }, { status: 400 });

  await auth.db.from("shop_bundle_items").delete().eq("bundle_id", body.bundle_id);
  if (body.product_ids.length) {
    const rows = body.product_ids.map((pid, i) => ({
      bundle_id: body.bundle_id,
      product_id: pid,
      sort: i,
    }));
    const { error } = await auth.db.from("shop_bundle_items").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
