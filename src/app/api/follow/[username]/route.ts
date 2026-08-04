import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Member-to-member follow, keyed by the followee's handle.
 *
 * The FOLLOWER is always the signed-in caller, read from the session — never
 * the body. The write goes through the RLS-scoped session client, so the
 * `follows` policies ("Follow as yourself" / "Unfollow as yourself", both
 * follower_id = auth.uid()) are the real enforcement; the route just resolves
 * the handle and prevents self-follow.
 *
 *   POST   /api/follow/[username]  → follow that member (idempotent)
 *   DELETE /api/follow/[username]  → unfollow
 *   GET    /api/follow/[username]  → { followers, following, isFollowing }
 */

async function resolveFollowee(username: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const followeeId = await resolveFollowee(username);
  if (!followeeId) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (followeeId === user.id) {
    return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 });
  }

  // RLS enforces follower_id = auth.uid(); the upsert makes a repeat follow a
  // no-op rather than a duplicate-key error.
  const { error } = await db
    .from("follows")
    .upsert(
      { follower_id: user.id, followee_id: followeeId },
      { onConflict: "follower_id,followee_id", ignoreDuplicates: true }
    );
  if (error) return NextResponse.json({ error: "Could not follow." }, { status: 400 });

  return NextResponse.json({ following: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const followeeId = await resolveFollowee(username);
  if (!followeeId) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const { error } = await db
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", followeeId);
  if (error) return NextResponse.json({ error: "Could not unfollow." }, { status: 400 });

  return NextResponse.json({ following: false });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const followeeId = await resolveFollowee(username);
  if (!followeeId) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  // Counts are public to members (RLS: follows readable). head:true returns the
  // count without the rows.
  const [followersRes, followingRes] = await Promise.all([
    db.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", followeeId),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", followeeId),
  ]);

  let isFollowing = false;
  if (user && user.id !== followeeId) {
    const { data } = await db
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followee_id", followeeId)
      .maybeSingle();
    isFollowing = !!data;
  }

  return NextResponse.json({
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
    isFollowing,
  });
}
