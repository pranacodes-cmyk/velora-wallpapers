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
  return j.results ?? j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const proj = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then(r => r.json());
  const pid = proj.results?.[0]?.id;
  const notIN = `(properties.$geoip_country_code IS NULL OR properties.$geoip_country_code != 'IN')`;
  const win = `timestamp > now() - INTERVAL 4 DAY AND ${notIN}`;

  const queries: Record<string, string> = {
    daily_summary: `SELECT toDate(timestamp) AS d, count(DISTINCT distinct_id) AS users, count() AS events FROM events WHERE ${win} GROUP BY d ORDER BY d DESC`,
    truly_new_by_day: `SELECT first_day, count(*) AS new_users FROM (SELECT distinct_id, min(toDate(timestamp)) AS first_day FROM events WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN} GROUP BY distinct_id HAVING first_day > today() - 4) GROUP BY first_day ORDER BY first_day DESC`,
    totals_4d: `SELECT count(DISTINCT distinct_id) AS users, count() AS events FROM events WHERE ${win}`,
    by_country: `SELECT properties.$geoip_country_code AS c, count(DISTINCT distinct_id) AS u FROM events WHERE ${win} GROUP BY c ORDER BY u DESC LIMIT 20`,
    by_platform: `SELECT properties.platform AS p, count(DISTINCT distinct_id) AS u FROM events WHERE ${win} GROUP BY p ORDER BY u DESC`,
    top_events: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE ${win} GROUP BY event ORDER BY n DESC LIMIT 40`,
    paywall_funnel: `SELECT event, properties.trigger AS trig, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed') AND ${win} GROUP BY event, trig ORDER BY n DESC`,
    paywall_totals: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed') AND ${win} GROUP BY event`,
    purchases_by_plan: `SELECT properties.plan AS plan, count() AS n FROM events WHERE event='purchase_completed' AND ${win} GROUP BY plan`,
    onboarding: `SELECT count(DISTINCT distinct_id) AS completed FROM events WHERE event='onboarding_completed' AND ${win}`,
    app_first_open: `SELECT count(DISTINCT distinct_id) AS users FROM events WHERE event='app_first_open' AND ${win}`,
    engagement: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE event IN ('quiz_finished','companion_message_sent','daily_verse_apply','wallpaper_apply','live_wallpaper_apply','journey_day_completed','prayer_alarm_fired','rating_prompt_shown','rating_go_to_store','favorite_added') AND ${win} GROUP BY event ORDER BY n DESC`,
    errors: `SELECT event, count() AS n FROM events WHERE (event LIKE '%error%' OR event LIKE '%fail%' OR event LIKE '%crash%') AND ${win} GROUP BY event ORDER BY n DESC LIMIT 20`,
    session_depth: `SELECT bucket, count() AS users FROM (SELECT distinct_id, multiIf(c=1,'1_event',c<=5,'2-5',c<=20,'6-20',c<=50,'21-50','51+') AS bucket FROM (SELECT distinct_id, count() AS c FROM events WHERE ${win} GROUP BY distinct_id)) GROUP BY bucket ORDER BY bucket`,
    new_user_onboarding_rate: `SELECT count(DISTINCT distinct_id) AS completed FROM events WHERE event='onboarding_completed' AND ${win} AND distinct_id IN (SELECT distinct_id FROM events WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN} GROUP BY distinct_id HAVING min(toDate(timestamp)) > today() - 4)`,
    top_countries_purchases: `SELECT properties.$geoip_country_code AS c, count() AS n FROM events WHERE event='purchase_completed' AND ${win} GROUP BY c ORDER BY n DESC`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
