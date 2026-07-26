import { notFound } from "next/navigation";
import PreviewShell from "@/components/clubhome/PreviewShell";
import type { ClubScale } from "@/lib/clubhome/contract";
import type { Register } from "@/lib/register";

/**
 * /club/preview — ClubHome v2 design-review harness. PROD-GUARDED: returns 404 in
 * production so it can never be reached by a real user. In dev / vercel preview
 * it renders the page with rich fixtures across scale × register, no auth needed.
 */

export const dynamic = "force-dynamic";

function previewAllowed(): boolean {
  const env = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined
  if (env) return env !== "production";
  return process.env.NODE_ENV !== "production";
}

export default async function ClubHomePreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!previewAllowed()) notFound();

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const scale: ClubScale = one(sp.scale) === "founding" ? "founding" : "scale";
  const rp = one(sp.register);
  const register: Register = rp === "kid" ? "kid" : rp === "teen" ? "teen" : "adult";
  const challenge = one(sp.challenge) === "1";
  const live = one(sp.data) === "live";

  return <PreviewShell scale={scale} register={register} challenge={challenge} live={live} />;
}
