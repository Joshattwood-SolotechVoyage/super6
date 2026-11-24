import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Super 6 Web Push. Server-side only: the service key and VAPID private key
// never enter the browser or the public Git repository.
const db = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { db: { schema: "super6" }, auth: { persistSession: false } }
);
const appOrigin = "https://super6-7by.pages.dev";
const prefKeys = ["new_round", "deadline_24h", "deadline_2h", "results", "manual"];
const defaults = Object.fromEntries(prefKeys.map(k => [k, true]));
const isAllowedOrigin = (origin) => origin === appOrigin ||
  /^https:\/\/[a-z0-9-]+\.super6-7by\.pages\.dev$/.test(origin || "");
function cors(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : appOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}
function reply(req, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(req) });
}
function requireData(data, error, name) {
  if (error) throw new Error(name + ": " + error.message);
  return data;
}
async function secrets() {
  const { data, error } = await db.from("push_private_config")
    .select("vapid_public,vapid_private,cron_secret").eq("singleton", true).single();
  return requireData(data, error, "Notification configuration");
}
async function authenticate(req) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Error("Please log into Super 6 first.");
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) throw new Error("Your session has expired. Please log in again.");
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id,role").eq("id", data.user.id).maybeSingle();
  requireData(profile, profileError, "Player account");
  if (!profile) throw new Error("Your Super 6 player account was not found.");
  return profile;
}
async function activeRound() {
  const { data, error } = await db.from("rounds")
    .select("id,name,cutoff_at,status,created_at,completed_at")
    .eq("status", "published").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return requireData(data, error, "Published round");
}
async function subscriptions() {
  const { data, error } = await db.from("push_subscriptions")
    .select("id,player_id,endpoint,p256dh,auth_key,prefs").eq("enabled", true).limit(1000);
  return requireData(data, error, "Subscriptions") || [];
}
async function entriesFor(roundId) {
  const { data, error } = await db.from("entries")
    .select("player_id").eq("round_id", roundId).limit(3000);
  return new Set((requireData(data, error, "Submitted entries") || []).map(e => e.player_id));
}
async function players() {
  const { data, error } = await db.from("profiles")
    .select("id").eq("role", "player").limit(3000);
  return new Set((requireData(data, error, "Players") || []).map(p => p.id));
}
function payloadFor(round, kind) {
  const title = "Super 6 ⚽";
  const name = (round.name || "This round").slice(0, 70);
  if (kind === "new_round") return { title, body: name + " is open — make your six predictions!", url: "/", tag: "super6-new-" + round.id };
  if (kind === "deadline_24h") return { title, body: "24-hour heads-up! Get your predictions in before the deadline.", url: "/", tag: "super6-24-" + round.id };
  if (kind === "deadline_2h") return { title: "Super 6 final whistle ⏰", body: "Less than 2 hours left — your predictions are still missing!", url: "/", tag: "super6-2-" + round.id };
  if (kind === "results") return { title: "Super 6 results are in 🏆", body: name + " is complete. Check the scores and updated tables.", url: "/", tag: "super6-results-" + round.id };
  return { title: "Super 6 reminder ⚽", body: "Your predictions are still outstanding. Get them in before the deadline!", url: "/", tag: "super6-manual-" + round.id };
}
async function dispatch(round, kind, manual = false) {
  if (!round) return { subscribed: 0, eligible: 0, sent: 0, skipped: 0, failed: 0 };
  const allSubs = await subscriptions();
  const playerIds = await players();
  const submitted = kind === "results" ? new Set() : await entriesFor(round.id);
  const eligible = allSubs.filter(s =>
    playerIds.has(s.player_id) &&
    (kind === "results" || !submitted.has(s.player_id)) &&
    s.prefs?.[manual ? "manual" : kind] !== false
  );
  const stamp = manual ? "manual_" + new Date().toISOString().slice(0, 10) : kind;
  return sendEligible(round.id,stamp,payloadFor(round,kind),allSubs,eligible);
}

async function dispatchShootouts() {
  const { data, error } = await db.from("shart_shootouts").select("id,match_id,chumpions_match_id,nohope_match_id,home_team,away_team,cutoff_at")
    .eq("status","open").gt("cutoff_at",new Date().toISOString());
  const open = requireData(data,error,"Open shootouts") || [];
  if (!open.length) return [];
  const subs = await subscriptions();
  const results = [];
  for (const s of open) {
    const cup = s.match_id ? "shart" : s.chumpions_match_id ? "chumpions" : "nohope";
    const match = await db.from("shootout_parents").select("player1_id,player2_id,round_id")
      .eq("id",s.match_id || s.chumpions_match_id || s.nohope_match_id).eq("cup",cup).eq("is_tie",true).maybeSingle();
    const m = requireData(match.data,match.error,"Shootout fixture");
    if (!m?.round_id) continue;
    const eligible = subs.filter(sub => [m.player1_id,m.player2_id].includes(sub.player_id) && sub.prefs?.new_round !== false);
    const label = {shart:"SHART",chumpions:"Chumpions League",nohope:"No Hope"}[cup];
    const tag = "shootout_" + s.id;
    results.push(await sendEligible(m.round_id,tag,{title:label+" shootout ⚽",body:s.home_team+" v "+s.away_team+". Enter your score and first-goal minute before "+new Date(s.cutoff_at).toLocaleString("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" UK time.",url:"/",tag},subs,eligible));
  }
  return results;
}

async function sendEligible(roundId,stamp,payload,allSubs,eligible) {
  const config = await secrets();
  webpush.setVapidDetails(appOrigin, config.vapid_public, config.vapid_private);
  const data = JSON.stringify(payload);
  const counts = { subscribed: new Set(allSubs.map(s => s.player_id)).size, eligible: new Set(eligible.map(s => s.player_id)).size, sent: 0, skipped: 0, failed: 0 };
  const sendOne = async (s) => {
    const log = { round_id: roundId, subscription_id: s.id, kind: stamp, status: "reserved" };
    const { data: row, error: reserveError } = await db.from("push_delivery_log").insert(log).select("id").single();
    if (reserveError) {
      if (reserveError.code === "23505") counts.skipped++;
      else { counts.failed++; console.error("super6 reserve", reserveError.message); }
      return;
    }
    try {
      await webpush.sendNotification({
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth_key }
      }, data, { TTL: 14400, urgency: "normal" });
      counts.sent++;
      await Promise.all([
        db.from("push_delivery_log").update({ status: "sent" }).eq("id", row.id),
        db.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id)
      ]);
    } catch (error) {
      counts.failed++;
      const code = Number(error?.statusCode || error?.status || 0);
      if (code === 404 || code === 410) {
        await db.from("push_subscriptions").update({ enabled: false }).eq("id", s.id);
      } else {
        // Retry transient failures on a future invocation; never duplicate successes.
        await db.from("push_delivery_log").delete().eq("id", row.id);
      }
      console.error("super6 push failed", code, String(error?.message || error).slice(0, 180));
    }
  };
  for (let i = 0; i < eligible.length; i += 8) {
    await Promise.all(eligible.slice(i, i + 8).map(sendOne));
  }
  return counts;
}
async function scheduled() {
  const { data, error } = await db.from("rounds")
    .select("id,name,cutoff_at,status,created_at,completed_at")
    .in("status", ["published", "completed"])
    .order("created_at", { ascending: false }).limit(15);
  const rounds = requireData(data, error, "Rounds") || [];
  const now = Date.now();
  const sent = [];
  for (const round of rounds) {
    const remaining = new Date(round.cutoff_at).getTime() - now;
    const age = now - new Date(round.created_at).getTime();
    if (round.status === "published" && remaining > 0) {
      if (age >= 0 && age <= 3 * 3600000 && remaining > 2 * 3600000)
        sent.push({ kind: "new_round", round: round.id, ...(await dispatch(round, "new_round")) });
      if (remaining <= 24 * 3600000 && remaining > 23 * 3600000)
        sent.push({ kind: "deadline_24h", round: round.id, ...(await dispatch(round, "deadline_24h")) });
      if (remaining <= 2 * 3600000 && remaining > 1 * 3600000)
        sent.push({ kind: "deadline_2h", round: round.id, ...(await dispatch(round, "deadline_2h")) });
    }
    const completedAge = now - new Date(round.completed_at || 0).getTime();
    if (round.status === "completed" && completedAge >= 0 && completedAge <= 3 * 3600000)
      sent.push({ kind: "results", round: round.id, ...(await dispatch(round, "results")) });
  }
  return { checked: rounds.length, dispatches: sent };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req), status: 204 });
  if (req.method !== "POST") return reply(req, { error: "POST required" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "config") {
      const s = await secrets();
      return reply(req, { publicKey: s.vapid_public });
    }
    if (action === "cron" || action === "shootouts") {
      const s = await secrets();
      if (!req.headers.get("x-super6-cron") || req.headers.get("x-super6-cron") !== s.cron_secret)
        return reply(req, { error: "Forbidden" }, 403);
      if (action === "shootouts") return reply(req, await dispatchShootouts());
      const weekly = await scheduled();
      return reply(req, { ...weekly, shootouts: await dispatchShootouts() });
    }
    const profile = await authenticate(req);
    if (action === "subscribe") {
      const sub = body.subscription;
      const endpoint = sub?.endpoint;
      const keys = sub?.keys;
      if (typeof endpoint !== "string" || endpoint.length > 2048 ||
          !/^https:\/\//.test(endpoint) ||
          typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string" ||
          !/^[a-zA-Z0-9_-]+$/.test(keys.p256dh) ||
          !/^[a-zA-Z0-9_-]+$/.test(keys.auth))
        return reply(req, { error: "Invalid browser subscription" }, 400);
      const prefs = Object.fromEntries(prefKeys.map(k => [k, body.prefs?.[k] !== false]));
      const { error } = await db.from("push_subscriptions").upsert({
        player_id: profile.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
        prefs, enabled: true, updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      requireData(null, error, "Saving subscription");
      return reply(req, { ok: true, prefs });
    }
    if (action === "unsubscribe") {
      const endpoint = body.endpoint;
      if (typeof endpoint !== "string") return reply(req, { error: "Invalid subscription" }, 400);
      const { error } = await db.from("push_subscriptions").delete().eq("player_id", profile.id).eq("endpoint", endpoint);
      requireData(null, error, "Removing subscription");
      return reply(req, { ok: true });
    }
    if (action === "get_preferences") {
      if (typeof body.endpoint !== "string") return reply(req, { error: "Invalid subscription" }, 400);
      const { data, error } = await db.from("push_subscriptions")
        .select("prefs").eq("player_id", profile.id).eq("endpoint", body.endpoint).eq("enabled", true).maybeSingle();
      requireData(data, error, "Reading preferences");
      return reply(req, { found: !!data, prefs: data?.prefs || defaults });
    }
    if (action === "preferences") {
      const endpoint = body.endpoint;
      if (typeof endpoint !== "string") return reply(req, { error: "Invalid subscription" }, 400);
      const prefs = Object.fromEntries(prefKeys.map(k => [k, body.prefs?.[k] !== false]));
      const { data, error } = await db.from("push_subscriptions")
        .update({ prefs, updated_at: new Date().toISOString() })
        .eq("player_id", profile.id).eq("endpoint", endpoint).select("id").maybeSingle();
      requireData(data, error, "Saving preferences");
      if (!data) return reply(req, { error: "Enable notifications on this device first." }, 404);
      return reply(req, { ok: true, prefs });
    }
    if (profile.role !== "admin") return reply(req, { error: "Admin only" }, 403);
    if (action === "status") {
      const round = await activeRound();
      if (!round) return reply(req, { round: null, outstanding: 0, reachable: 0 });
      const playerIds = await players();
      const entered = await entriesFor(round.id);
      const subs = await subscriptions();
      const outstanding = [...playerIds].filter(id => !entered.has(id));
      const reachable = new Set(subs.filter(s =>
        !entered.has(s.player_id) && playerIds.has(s.player_id) && s.prefs?.manual !== false
      ).map(s => s.player_id)).size;
      return reply(req, { round: round.name, outstanding: outstanding.length, reachable, deadline: round.cutoff_at });
    }
    if (action === "manual") {
      const round = await activeRound();
      if (!round || new Date(round.cutoff_at).getTime() <= Date.now())
        return reply(req, { error: "No open round with time remaining." }, 409);
      return reply(req, { round: round.name, ...(await dispatch(round, "manual", true)) });
    }
    return reply(req, { error: "Unknown action" }, 400);
  } catch (error) {
    console.error("super6 push request", String(error?.message || error).slice(0, 250));
    return reply(req, { error: String(error?.message || error).slice(0, 180) }, 400);
  }
});
