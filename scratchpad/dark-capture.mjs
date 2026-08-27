import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/Users/kwaysclawd/projects/fta-dashboard/.env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const BASE="http://localhost:3111", SHOTS="/private/tmp/claude-501/-Users-kwaysclawd/4fee2b40-5044-4249-b735-c75d10907d7a/scratchpad/shots";
const stamp=Date.now(), EMAIL=`s1shell+${stamp}@example.com`, PASSWORD=`S1shell!${stamp}`;
let familyId,userId;
async function main(){
  const {data:fam}=await admin.from("families").insert({name:"S1 Dark Test"}).select("id").single(); familyId=fam.id;
  const {data:created,error}=await admin.auth.admin.createUser({email:EMAIL,password:PASSWORD,email_confirm:true}); if(error)throw error; userId=created.user.id;
  await admin.from("profiles").upsert({id:userId,family_id:familyId,role:"parent",age_group:"adults",display_name:"Alex Rivera",onboarding_complete:true,tour_completed_at:new Date().toISOString(),tour_version:3},{onConflict:"id"});
  await admin.from("family_profiles").upsert({family_id:familyId,household:{adults:1,kids:0,kid_age_ranges:[]},completed_at:new Date().toISOString()},{onConflict:"family_id"});
  const browser=await chromium.launch(); const ctx=await browser.newContext(); const page=await ctx.newPage();
  await page.addInitScript(()=>{try{localStorage.setItem("fta-theme","dark");localStorage.setItem("cc:first-run-done","1");}catch{}});
  await page.goto(`${BASE}/login`,{waitUntil:"domcontentloaded"});
  await page.fill('input[type="email"]',EMAIL); await page.fill('input[type="password"]',PASSWORD); await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/,{timeout:25000}).catch(()=>{});
  await page.waitForTimeout(4000); // let session settle + dashboard render
  console.log("post-login url:", page.url());
  for (const [name,w,h] of [["s1-adult-desktop-dark",1440,900],["s1-adult-mobile-dark",390,844]]) {
    await page.setViewportSize({width:w,height:h});
    await page.evaluate(()=>{localStorage.setItem("fta-theme","dark");document.documentElement.setAttribute("data-theme","dark");});
    await page.waitForTimeout(1200);
    const th = await page.evaluate(()=>document.documentElement.getAttribute("data-theme"));
    await page.screenshot({path:`${SHOTS}/${name}.png`});
    console.log(name, "url=", page.url(), "data-theme=", th);
  }
  await browser.close();
}
async function teardown(){try{if(familyId)await admin.from("family_profiles").delete().eq("family_id",familyId);if(userId)await admin.from("profiles").delete().eq("id",userId);if(familyId)await admin.from("families").delete().eq("id",familyId);if(userId)await admin.auth.admin.deleteUser(userId);console.log("TEARDOWN complete");}catch(e){console.log("TEARDOWN err",e.message);}}
main().catch(e=>console.log("ERR",e.message)).finally(teardown);
