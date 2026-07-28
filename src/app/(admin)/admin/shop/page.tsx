"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  RefreshCw,
  Send,
  Package,
  AlertTriangle,
  ExternalLink,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AUDIENCE_LABELS,
  KIND_LABELS,
  ORDER_STATUS_LABELS,
  AWAITING_FULFILLMENT,
  formatUsd,
  type ShopProduct,
  type ShopOrder,
  type ShopAudience,
  type ShopKind,
  type ShopOrderStatus,
} from "@/lib/shop";

const COVER_BUCKET = "community-media";
const PRINT_BUCKET = "print-files";
const AUDIENCES: ShopAudience[] = ["kids", "teens", "adults", "family"];
const KINDS: ShopKind[] = [
  "textbook",
  "guidebook",
  "workbook",
  "lesson_plans",
  "teacher_guide",
  "bundle",
];
const ORDER_STATUSES: ShopOrderStatus[] = [
  "paid",
  "submitted",
  "in_production",
  "shipped",
  "canceled",
  "fulfillment_error",
];

interface BundleItemRow {
  bundle_id: string;
  product_id: string;
  sort: number;
}

interface Draft {
  id: string | null;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  audience: ShopAudience | "";
  kind: ShopKind | "";
  price_dollars: string;
  compare_dollars: string;
  page_count: string;
  pod_package_id: string;
  cover_image_path: string;
  interior_pdf_path: string;
  cover_pdf_path: string;
  active: boolean;
  sort: string;
  bundle_product_ids: string[];
}

function draftFrom(p: ShopProduct, bundleItems: BundleItemRow[]): Draft {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle ?? "",
    description: p.description ?? "",
    audience: (p.audience ?? "") as ShopAudience | "",
    kind: (p.kind ?? "") as ShopKind | "",
    price_dollars: (p.price_cents / 100).toString(),
    compare_dollars: p.compare_at_cents != null ? (p.compare_at_cents / 100).toString() : "",
    page_count: p.page_count != null ? String(p.page_count) : "",
    pod_package_id: p.lulu_pod_package_id ?? "",
    cover_image_path: p.cover_image_path ?? "",
    interior_pdf_path: p.interior_pdf_path ?? "",
    cover_pdf_path: p.cover_pdf_path ?? "",
    active: p.active,
    sort: String(p.sort),
    bundle_product_ids: bundleItems
      .filter((b) => b.bundle_id === p.id)
      .sort((a, b) => a.sort - b.sort)
      .map((b) => b.product_id),
  };
}

function emptyDraft(): Draft {
  return {
    id: null,
    slug: "",
    title: "",
    subtitle: "",
    description: "",
    audience: "",
    kind: "",
    price_dollars: "",
    compare_dollars: "",
    page_count: "",
    pod_package_id: "",
    cover_image_path: "",
    interior_pdf_path: "",
    cover_pdf_path: "",
    active: false,
    sort: "0",
    bundle_product_ids: [],
  };
}

export default function AdminShopPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [bundleItems, setBundleItems] = useState<BundleItemRow[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState<ShopOrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const token = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  }, [supabase]);

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const t = await token();
      return fetch(url, {
        ...init,
        headers: { ...(init?.headers || {}), Authorization: `Bearer ${t}` },
      });
    },
    [token]
  );

  const loadProducts = useCallback(async () => {
    const res = await authFetch("/api/shop/admin/products");
    const json = await res.json();
    setProducts(json.products || []);
    setBundleItems(json.bundleItems || []);
  }, [authFetch]);

  const loadOrders = useCallback(async () => {
    const q = orderFilter === "all" ? "" : `?status=${orderFilter}`;
    const res = await authFetch(`/api/shop/admin/orders${q}`);
    const json = await res.json();
    setOrders(json.orders || []);
  }, [authFetch, orderFilter]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProducts(), loadOrders()]);
      setLoading(false);
    })();
  }, [loadProducts, loadOrders]);

  useEffect(() => {
    if (tab === "orders") loadOrders();
  }, [orderFilter, tab, loadOrders]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      id: editing.id,
      slug: editing.slug.trim(),
      title: editing.title.trim(),
      subtitle: editing.subtitle.trim() || null,
      description: editing.description,
      audience: editing.audience || null,
      kind: editing.kind || null,
      price_cents: Math.round(parseFloat(editing.price_dollars || "0") * 100),
      compare_at_cents: editing.compare_dollars
        ? Math.round(parseFloat(editing.compare_dollars) * 100)
        : null,
      page_count: editing.page_count ? parseInt(editing.page_count, 10) : null,
      lulu_pod_package_id: editing.pod_package_id.trim() || null,
      cover_image_path: editing.cover_image_path || null,
      interior_pdf_path: editing.interior_pdf_path || null,
      cover_pdf_path: editing.cover_pdf_path || null,
      active: editing.active,
      sort: parseInt(editing.sort || "0", 10),
    };
    const res = await authFetch("/api/shop/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner(`Save failed: ${json.error}`);
      setBusy(false);
      return;
    }
    const productId = editing.id || json.id;
    if (editing.kind === "bundle" && productId) {
      await authFetch("/api/shop/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle_id: productId, product_ids: editing.bundle_product_ids }),
      });
    }
    setEditing(null);
    setBusy(false);
    await loadProducts();
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await authFetch(`/api/shop/admin/products?id=${id}`, { method: "DELETE" });
    await loadProducts();
  }

  async function uploadCover(file: File) {
    if (!editing) return;
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `shop/${editing.slug || "product"}-cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setBanner(`Cover upload failed: ${error.message}`);
    } else {
      const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
      setEditing({ ...editing, cover_image_path: data.publicUrl });
    }
    setBusy(false);
  }

  async function uploadPdf(file: File, which: "interior" | "cover") {
    if (!editing) return;
    setBusy(true);
    const path = `${editing.slug || "product"}/${which}-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from(PRINT_BUCKET).upload(path, file, { upsert: true });
    if (error) {
      setBanner(`PDF upload failed: ${error.message}`);
    } else {
      setEditing({
        ...editing,
        [which === "interior" ? "interior_pdf_path" : "cover_pdf_path"]: path,
      } as Draft);
    }
    setBusy(false);
  }

  async function orderAction(orderId: string, action: "submit" | "sync") {
    setBusy(true);
    const res = await authFetch("/api/shop/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action }),
    });
    const json = await res.json();
    setBanner(
      json.reason === AWAITING_FULFILLMENT
        ? "Order is awaiting fulfillment setup (Lulu creds / pod_package_id / PDFs not ready)."
        : json.error
          ? `Error: ${json.error}`
          : `Order → ${ORDER_STATUS_LABELS[json.status as ShopOrderStatus] || json.status}`
    );
    setBusy(false);
    await loadOrders();
  }

  const productById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-soft">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-ink">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Shop</h1>
          <p className="text-sm text-soft">
            Physical books &amp; bundles · Lulu print-on-demand fulfillment
          </p>
        </div>
        {tab === "products" && (
          <button
            onClick={() => setEditing(emptyDraft())}
            className="f0-press f0-focus flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--accent-on)] hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" /> New product
          </button>
        )}
      </div>

      {banner && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-accent hover:text-accent-strong">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {(["products", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? "bg-paper text-accent" : "text-soft hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "products" ? (
        <div className="club-b-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Print-ready</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {products.map((p) => {
                const ready =
                  p.kind === "bundle"
                    ? true
                    : Boolean(p.lulu_pod_package_id && p.interior_pdf_path && p.cover_pdf_path);
                return (
                  <tr key={p.id} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{p.title}</div>
                      <div className="text-xs text-soft">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-ink">{p.kind ? KIND_LABELS[p.kind] : "—"}</td>
                    <td className="px-4 py-3 text-ink">
                      {p.audience ? AUDIENCE_LABELS[p.audience] : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink">{formatUsd(p.price_cents)}</td>
                    <td className="px-4 py-3">
                      {p.kind === "bundle" ? (
                        <span className="text-xs text-soft">n/a (bundle)</span>
                      ) : ready ? (
                        <span className="inline-flex items-center gap-1 text-xs text-soft">
                          <Check className="h-3.5 w-3.5" /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-accent">
                          <AlertTriangle className="h-3.5 w-3.5" /> Needs setup
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          p.active ? "f0-chip-accent text-accent" : "text-soft"
                        }`}
                      >
                        {p.active ? "Live" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(draftFrom(p, bundleItems))}
                          className="rounded p-1.5 text-soft hover:bg-paper hover:text-accent-strong"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="rounded p-1.5 text-soft hover:bg-paper hover:text-accent-strong"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OrdersPanel
          orders={orders}
          filter={orderFilter}
          setFilter={setOrderFilter}
          onAction={orderAction}
          busy={busy}
          productById={productById}
        />
      )}

      {editing && (
        <ProductEditor
          draft={editing}
          setDraft={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
          busy={busy}
          products={products}
          onUploadCover={uploadCover}
          onUploadPdf={uploadPdf}
        />
      )}
    </div>
  );
}

/* ── Orders panel ─────────────────────────────────────────────────────────── */
function OrdersPanel({
  orders,
  filter,
  setFilter,
  onAction,
  busy,
  productById,
}: {
  orders: ShopOrder[];
  filter: ShopOrderStatus | "all";
  setFilter: (s: ShopOrderStatus | "all") => void;
  onAction: (id: string, action: "submit" | "sync") => void;
  busy: boolean;
  productById: Record<string, ShopProduct>;
}) {
  void productById;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`f0-chip f0-press f0-focus px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
              filter === s ? "f0-chip-on" : "text-soft hover:text-ink"
            }`}
          >
            {s === "all" ? "All" : ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand p-8 text-center text-soft">
          No orders yet.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const awaiting = o.error === AWAITING_FULFILLMENT;
            const shipping = (o.shipping as any) || {};
            const addr = shipping.address || {};
            return (
              <div key={o.id} className="club-b-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{o.customer_name || o.email}</span>
                      <span
                        className={`f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          o.status === "shipped"
                            ? "f0-chip-on"
                            : o.status === "fulfillment_error"
                              ? "f0-chip-accent text-accent"
                              : "text-soft"
                        }`}
                      >
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-soft">
                      {o.email} · {formatUsd(o.amount_total)} ·{" "}
                      {new Date(o.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => onAction(o.id, "submit")}
                      className="f0-press f0-focus flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-on)] hover:bg-accent-strong disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" /> Submit to Lulu
                    </button>
                    {o.lulu_job_id && (
                      <button
                        disabled={busy}
                        onClick={() => onAction(o.id, "sync")}
                        className="flex items-center gap-1.5 rounded-lg border border-sand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Sync
                      </button>
                    )}
                  </div>
                </div>

                {awaiting && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Awaiting fulfillment setup — add Lulu credentials, then set each book&apos;s
                    pod_package_id + print PDFs, then Submit to Lulu.
                  </div>
                )}
                {o.error && !awaiting && (
                  <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                    {o.error}
                  </div>
                )}

                <div className="mt-3 grid gap-3 text-xs text-soft sm:grid-cols-2">
                  <div>
                    <div className="mb-1 font-semibold text-soft">Items</div>
                    <ul className="space-y-0.5">
                      {(o.items || []).map((it) => (
                        <li key={it.id}>
                          {it.quantity}× {it.product?.title || it.product_id} —{" "}
                          {formatUsd(it.unit_cents)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-soft">Ship to</div>
                    <div className="flex items-start gap-1.5">
                      <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {shipping.name}
                        {addr.line1 ? `, ${addr.line1}` : ""}
                        {addr.line2 ? `, ${addr.line2}` : ""}
                        {addr.city ? `, ${addr.city}` : ""} {addr.state} {addr.postal_code}{" "}
                        {addr.country}
                      </span>
                    </div>
                    {o.lulu_job_id && (
                      <div className="mt-1 text-soft">Lulu job: {o.lulu_job_id}</div>
                    )}
                    {(o.tracking as any)?.items?.map((t: any, i: number) => (
                      <div key={i} className="mt-1">
                        {t.carrier} {t.tracking_id}{" "}
                        {t.tracking_urls?.[0] && (
                          <a
                            href={t.tracking_urls[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-accent"
                          >
                            track <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Product editor modal ─────────────────────────────────────────────────── */
function ProductEditor({
  draft,
  setDraft,
  onSave,
  onClose,
  busy,
  products,
  onUploadCover,
  onUploadPdf,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
  busy: boolean;
  products: ShopProduct[];
  onUploadCover: (f: File) => void;
  onUploadPdf: (f: File, which: "interior" | "cover") => void;
}) {
  const isBundle = draft.kind === "bundle";
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const field = "w-full rounded-lg border border-sand bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none";
  const label = "mb-1 block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4">
      <div className="my-8 w-full max-w-2xl club-b-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-ink">
            {draft.id ? "Edit product" : "New product"}
          </h2>
          <button onClick={onClose} className="text-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Title</label>
            <input className={field} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <label className={label}>Slug</label>
            <input className={field} value={draft.slug} onChange={(e) => set({ slug: e.target.value })} />
          </div>
          <div>
            <label className={label}>Sort</label>
            <input className={field} value={draft.sort} onChange={(e) => set({ sort: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Subtitle</label>
            <input
              className={field}
              value={draft.subtitle}
              onChange={(e) => set({ subtitle: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Description (lines starting with &quot;- &quot; render as bullets)</label>
            <textarea
              rows={5}
              className={field}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Audience</label>
            <select
              className={field}
              value={draft.audience}
              onChange={(e) => set({ audience: e.target.value as ShopAudience | "" })}
            >
              <option value="">—</option>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Kind</label>
            <select
              className={field}
              value={draft.kind}
              onChange={(e) => set({ kind: e.target.value as ShopKind | "" })}
            >
              <option value="">—</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Price (USD)</label>
            <input
              className={field}
              value={draft.price_dollars}
              onChange={(e) => set({ price_dollars: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Compare-at (USD, optional)</label>
            <input
              className={field}
              value={draft.compare_dollars}
              onChange={(e) => set({ compare_dollars: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Page count</label>
            <input
              className={field}
              value={draft.page_count}
              onChange={(e) => set({ page_count: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => set({ active: e.target.checked })}
                className="h-4 w-4 accent-[color:var(--accent-solid)]"
              />
              Active (visible on storefront)
            </label>
          </div>

          {/* Cover image */}
          <div className="sm:col-span-2">
            <label className={label}>Cover image</label>
            <div className="flex items-center gap-3">
              {draft.cover_image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.cover_image_path}
                  alt=""
                  className="h-16 w-12 rounded border border-sand object-cover"
                />
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sand px-3 py-2 text-sm text-ink hover:bg-paper">
                <Upload className="h-4 w-4" /> Upload cover
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onUploadCover(e.target.files[0])}
                />
              </label>
              <input
                className={field}
                placeholder="or paste a path/URL"
                value={draft.cover_image_path}
                onChange={(e) => set({ cover_image_path: e.target.value })}
              />
            </div>
          </div>

          {!isBundle && (
            <>
              <div className="sm:col-span-2">
                <label className={label}>Lulu pod_package_id</label>
                <input
                  className={field}
                  placeholder="e.g. 0600X0900BWSTDPB060UW444MXX (6×9 B&W paperback)"
                  value={draft.pod_package_id}
                  onChange={(e) => set({ pod_package_id: e.target.value })}
                />
                <p className="mt-1 text-xs text-soft">
                  Lulu&apos;s SKU for trim + paper + binding. Format: trim + color + binding + paper +
                  finish. Get it from developers.lulu.com pricing.
                </p>
              </div>
              <div>
                <label className={label}>Interior PDF (print-files)</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sand px-3 py-2 text-sm text-ink hover:bg-paper">
                  <Upload className="h-4 w-4" /> {draft.interior_pdf_path ? "Replace" : "Upload"} interior
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUploadPdf(e.target.files[0], "interior")}
                  />
                </label>
                {draft.interior_pdf_path && (
                  <p className="mt-1 truncate text-xs text-soft">{draft.interior_pdf_path}</p>
                )}
              </div>
              <div>
                <label className={label}>Cover PDF (print-files)</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sand px-3 py-2 text-sm text-ink hover:bg-paper">
                  <Upload className="h-4 w-4" /> {draft.cover_pdf_path ? "Replace" : "Upload"} cover PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUploadPdf(e.target.files[0], "cover")}
                  />
                </label>
                {draft.cover_pdf_path && (
                  <p className="mt-1 truncate text-xs text-soft">{draft.cover_pdf_path}</p>
                )}
              </div>
            </>
          )}

          {isBundle && (
            <div className="sm:col-span-2">
              <label className={label}>Bundle contents</label>
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-sand p-2">
                {products
                  .filter((p) => p.kind !== "bundle")
                  .map((p) => {
                    const checked = draft.bundle_product_ids.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm text-ink hover:bg-paper"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="h-4 w-4 accent-[color:var(--accent-solid)]"
                          onChange={(e) =>
                            set({
                              bundle_product_ids: e.target.checked
                                ? [...draft.bundle_product_ids, p.id]
                                : draft.bundle_product_ids.filter((id) => id !== p.id),
                            })
                          }
                        />
                        {p.title}
                        <span className="ml-auto text-xs text-soft">
                          {formatUsd(p.price_cents)}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-sand px-4 py-2 text-sm text-ink hover:bg-paper"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="f0-press f0-focus flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-[color:var(--accent-on)] hover:bg-accent-strong disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
