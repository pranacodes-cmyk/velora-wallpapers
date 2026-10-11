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

  const day = (offset: number) => `toDate(timestamp) = today() - ${offset}`;

  const buildDay = (offset: number) => ({
    [`d${offset}_summary`]: `SELECT count(DISTINCT distinct_id) AS users, count() AS events FROM events WHERE ${day(offset)} AND ${notIN}`,
    [`d${offset}_truly_new`]: `SELECT count(*) FROM (SELECT distinct_id, min(toDate(timestamp)) AS f FROM events WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN} GROUP BY distinct_id HAVING f = today() - ${offset})`,
    [`d${offset}_by_country`]: `SELECT properties.$geoip_country_code AS c, count(DISTINCT distinct_id) AS u FROM events WHERE ${day(offset)} AND ${notIN} GROUP BY c ORDER BY u DESC LIMIT 12`,
    [`d${offset}_by_platform`]: `SELECT properties.platform AS p, count(DISTINCT distinct_id) AS u FROM events WHERE ${day(offset)} AND ${notIN} GROUP BY p ORDER BY u DESC`,
    [`d${offset}_top_events`]: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE ${day(offset)} AND ${notIN} GROUP BY event ORDER BY n DESC LIMIT 30`,
    [`d${offset}_paywall`]: `SELECT event, properties.trigger AS trig, count() AS n FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed') AND ${day(offset)} AND ${notIN} GROUP BY event, trig ORDER BY n DESC`,
    [`d${offset}_purchases_by_plan`]: `SELECT properties.plan AS plan, count() AS n FROM events WHERE event='purchase_completed' AND ${day(offset)} AND ${notIN} GROUP BY plan`,
    [`d${offset}_onboarding_completed`]: `SELECT count(DISTINCT distinct_id) FROM events WHERE event='onboarding_completed' AND ${day(offset)} AND ${notIN}`,
    [`d${offset}_engagement`]: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS u FROM events WHERE event IN ('quiz_finished','companion_message_sent','daily_verse_apply','wallpaper_apply','live_wallpaper_apply','journey_day_completed','prayer_alarm_fired','rating_prompt_shown','rating_go_to_store') AND ${day(offset)} AND ${notIN} GROUP BY event ORDER BY n DESC`,
    [`d${offset}_errors`]: `SELECT event, count() AS n FROM events WHERE (event LIKE '%error%' OR event LIKE '%fail%' OR event LIKE '%crash%') AND ${day(offset)} AND ${notIN} GROUP BY event ORDER BY n DESC LIMIT 15`,
  });

  const queries = { ...buildDay(0), ...buildDay(1) };
  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
