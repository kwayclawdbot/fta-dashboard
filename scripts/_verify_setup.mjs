import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env() {
  const raw = readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local", "utf8");
  const e = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return e;
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const key = e.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const ts = Date.now();
const email = `fta-verify-${ts}@example.com`;
const password = `Verify!${ts}aB`;

const { data: created, error: cErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (cErr) throw cErr;
const userId = created.user.id;

const { error: pErr } = await supabase.from("profiles").upsert(
  {
    id: userId,
    role: "parent",
    display_name: "FTA Verify",
    email,
    track: "adults",
    age_group: "adults",
    onboarding_complete: true,
    notification_prefs: {},
  },
  { onConflict: "id" }
);
if (pErr) throw pErr;

writeFileSync(
  "/private/tmp/claude-501/-Users-kwaysclawd/be0d6c7d-5fc7-4bfd-bb65-2f3aaba03af9/scratchpad/creds.json",
  JSON.stringify({ userId, email, password, url }, null, 2)
);
console.log(JSON.stringify({ userId, email, password }, null, 2));
