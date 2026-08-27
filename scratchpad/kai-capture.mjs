import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, appendFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const BASE="http://localhost:3111", SHOTS="/private/tmp/claude-501/-Users-kwaysclawd/4fee2b40-5044-4249-b735-c75d10907d7a/scratchpad/shots";
const LOG=SHOTS+"/../kai.log"; const log=m=>{console.log(m);try{appendFileSync(LOG,m+"\n");}catch{}};
const stamp=Date.now(), EMAIL=`s1shell+${stamp}@example.com`, PASSWORD=`S1shell!${stamp}`;
let familyId,userId;
async function main(){
  const {data:fam}=await admin.from("families").insert({name:"S1 Kai Test"}).select("id").single(); familyId=fam.id;
  const {data:created,error}=await admin.auth.admin.createUser({email:EMAIL,password:PASSWORD,email_confirm:true}); if(error)throw error; userId=created.user.id;
  await admin.from("profiles").upsert({id:userId,family_id:familyId,role:"parent",age_group:"adults",display_name:"Alex Rivera",onboarding_complete:true,tour_completed_at:new Date().toISOString(),tour_version:3},{onConflict:"id"});
  await admin.from("family_profiles").upsert({family_id:familyId,household:{adults:1,kids:0,kid_age_ranges:[]},completed_at:new Date().toISOString()},{onConflict:"family_id"});
  const browser=await chromium.launch(); const ctx=await browser.newContext(); const page=await ctx.newPage();
  await page.addInitScript(()=>{try{localStorage.setItem("fta-theme","light");localStorage.setItem("cc:first-run-done","1");}catch{}});
  await page.goto(`${BASE}/login`,{waitUntil:"domcontentloaded"});
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASSWORD); await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/,{timeout:25000}).catch(()=>{});
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${BASE}/dashboard`,{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(5000); // let dashboard fully settle
  // Path A: FAB click → sheet opens (no chip) — proves the sheet mechanism.
  const fab=page.locator('[data-tour="kai-float"]').first();
  await fab.click();
  await page.waitForTimeout(3500);
  await page.screenshot({path:`${SHOTS}/s1-adult-kai-fab.png`}); log("s1-adult-kai-fab");
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  // Path B: search → Ask Kai (Enter) → sheet with CONTEXT CHIP.
  await page.keyboard.press("Meta+k"); await page.waitForTimeout(500);
  await page.keyboard.type("nvda",{delay:60}); await page.waitForTimeout(2500);
  await page.screenshot({path:`${SHOTS}/s1-adult-search-results.png`}); log("s1-adult-search-results");
  await page.keyboard.press("Enter"); await page.waitForTimeout(4000);
  await page.screenshot({path:`${SHOTS}/s1-adult-kai-chip.png`}); log("s1-adult-kai-chip");
  await browser.close();
}
async function teardown(){try{if(familyId)await admin.from("family_profiles").delete().eq("family_id",familyId);if(userId)await admin.from("profiles").delete().eq("id",userId);if(familyId)await admin.from("families").delete().eq("id",familyId);if(userId)await admin.auth.admin.deleteUser(userId);log("TEARDOWN complete");}catch(e){log("TEARDOWN err "+e.message);}}
main().catch(e=>log("ERR "+e.message+"\n"+e.stack)).finally(teardown);
