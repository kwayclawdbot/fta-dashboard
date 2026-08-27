import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
// find all s1shell test users
let removed = [];
const { data: list } = await admin.auth.admin.listUsers({ page:1, perPage:200 });
for (const u of (list?.users||[])) {
  if (u.email && u.email.startsWith("s1shell+")) {
    const { data: prof } = await admin.from("profiles").select("family_id").eq("id", u.id).maybeSingle();
    const fid = prof?.family_id;
    if (fid) { await admin.from("family_profiles").delete().eq("family_id", fid); }
    await admin.from("profiles").delete().eq("id", u.id);
    if (fid) { await admin.from("families").delete().eq("id", fid); }
    await admin.auth.admin.deleteUser(u.id);
    removed.push(u.email + (fid?` (fam ${fid})`:""));
  }
}
console.log("CLEANUP removed:", removed.length ? removed.join(", ") : "none");
