const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KEY = Deno.env.get("POSTHOG_PERSONAL_API_KEY")!;
const HOST = "https://us.posthog.com";

async function hogql(query: string, pid: number) {
  const res = await fetch(`${HOST}/api/projects/${pid}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  const j = await res.json();
  if (!res.ok) return { error: j };
  return j.results ?? j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const proj = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then(r => r.json());
  const pid = proj.results?.[0]?.id;

  // Exclude my own testing: India traffic + S23 Ultra devices (SM-S918*)
  const notMine = `(coalesce(properties.$geoip_country_code,'') != 'IN')
    AND (coalesce(toString(properties.$device_model),'') NOT ILIKE '%S918%')
    AND (coalesce(toString(properties.$device_model),'') NOT ILIKE '%S23 Ultra%')
    AND (coalesce(toString(properties.$raw_user_agent),'') NOT ILIKE '%SM-S918%')`;
  const win = `timestamp > now() - INTERVAL 5 DAY AND ${notMine}`;

  const queries: Record<string, string> = {
    daily: `SELECT toDate(timestamp) AS d, count(DISTINCT distinct_id) AS users, count() AS events FROM events WHERE ${win} GROUP BY d ORDER BY d DESC`,
    new_users_by_day: `SELECT first_day, count(*) AS new_users FROM (SELECT distinct_id, min(toDate(timestamp)) AS first_day FROM events WHERE timestamp > now() - INTERVAL 180 DAY AND ${notMine} GROUP BY distinct_id HAVING first_day > today() - 5) GROUP BY first_day ORDER BY first_day DESC`,
    by_country: `SELECT properties.$geoip_country_code AS c, count(DISTINCT distinct_id) AS users, count() AS events, round(count()/count(DISTINCT distinct_id),1) AS events_per_user FROM events WHERE ${win} GROUP BY c ORDER BY users DESC LIMIT 25`,
    quality_by_country: `SELECT country, count() AS users, round(avg(ev),1) AS avg_events, round(median(ev),1) AS med_events, round(100.0*countIf(ev<=2)/count(),1) AS bounced_pct, round(100.0*countIf(days>=2)/count(),1) AS returned_pct, round(avg(life_sec),0) AS avg_life_sec
      FROM (SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country, count() AS ev, countDistinct(toDate(timestamp)) AS days, dateDiff('second', min(timestamp), max(timestamp)) AS life_sec FROM events WHERE ${win} GROUP BY distinct_id)
      GROUP BY country HAVING users >= 5 ORDER BY users DESC LIMIT 20`,
    top_events: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE ${win} GROUP BY event ORDER BY n DESC LIMIT 40`,
    paywall_funnel: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed','trial_started') AND ${win} GROUP BY event ORDER BY n DESC`,
    purchase_by_country: `SELECT properties.$geoip_country_code AS c, countIf(event='paywall_shown') AS shown, countIf(event='purchase_started') AS started, countIf(event='purchase_completed') AS completed, countIf(event='purchase_cancelled') AS cancelled FROM events WHERE event IN ('paywall_shown','purchase_started','purchase_completed','purchase_cancelled') AND ${win} GROUP BY c ORDER BY started DESC LIMIT 20`,
    trials_30d: `SELECT toDate(timestamp) AS d, count() AS n FROM events WHERE event IN ('purchase_completed','trial_started') AND timestamp > now() - INTERVAL 30 DAY AND ${notMine} GROUP BY d ORDER BY d DESC`,
    by_lang: `SELECT properties.app_lang AS lang, count(DISTINCT distinct_id) AS users FROM events WHERE ${win} GROUP BY lang ORDER BY users DESC`,
    by_version: `SELECT coalesce(toString(properties.native_version),'?') AS nv, coalesce(toString(properties.ota_version),'?') AS ota, count(DISTINCT distinct_id) AS users FROM events WHERE ${win} GROUP BY nv, ota ORDER BY users DESC LIMIT 20`,
    errors: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE (event LIKE '%error%' OR event LIKE '%fail%' OR event='$exception') AND ${win} GROUP BY event ORDER BY n DESC LIMIT 20`,
    session_depth: `SELECT bucket, count() AS users FROM (SELECT distinct_id, multiIf(c=1,'1_event',c<=5,'2-5',c<=20,'6-20',c<=50,'21-50','51+') AS bucket FROM (SELECT distinct_id, count() AS c FROM events WHERE ${win} GROUP BY distinct_id)) GROUP BY bucket ORDER BY bucket`,
    onboarding: `SELECT countIf(event='app_first_open') AS first_opens, countIf(event='onboarding_completed') AS onboarded FROM events WHERE ${win}`,
  };

  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
