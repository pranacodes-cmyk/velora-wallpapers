const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KEY = Deno.env.get("POSTHOG_PERSONAL_API_KEY")!;
const HOST = "https://us.posthog.com";

async function hogql(query: string, projectId: number) {
  const res = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const proj = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then(r=>r.json());
    const pid = proj.results?.[0]?.id;
    // "today" in USA = since start of today US/Eastern. Use UTC today as approximation, plus filter geoip country.
    const usaFilter = `properties.$geoip_country_code = 'US' AND toDate(timestamp) = today()`;
    const queries: Record<string,string> = {
      summary: `SELECT count(DISTINCT distinct_id) AS users, count() AS events FROM events WHERE ${usaFilter}`,
      top_events: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS users FROM events WHERE ${usaFilter} GROUP BY event ORDER BY n DESC LIMIT 40`,
      top_pages: `SELECT properties.$pathname AS path, count() AS views, count(DISTINCT distinct_id) AS users FROM events WHERE event='$pageview' AND ${usaFilter} GROUP BY path ORDER BY views DESC LIMIT 20`,
      paywall: `SELECT event, properties.trigger AS trigger, count() AS n, count(DISTINCT distinct_id) AS users FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed') AND ${usaFilter} GROUP BY event, trigger ORDER BY n DESC`,
      paywall_totals: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS users FROM events WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed') AND ${usaFilter} GROUP BY event`,
      new_vs_returning: `SELECT sum(is_new) AS new_users, sum(1-is_new) AS returning_users FROM (SELECT distinct_id, if(min(toDate(timestamp)) = today(), 1, 0) AS is_new FROM events WHERE properties.$geoip_country_code='US' AND timestamp > now() - INTERVAL 60 DAY GROUP BY distinct_id HAVING max(toDate(timestamp)) = today())`,
      sessions_depth: `SELECT bucket, count() AS users FROM (SELECT distinct_id, multiIf(c=1,'1_event',c<=5,'2-5',c<=20,'6-20',c<=50,'21-50','51+') AS bucket FROM (SELECT distinct_id, count() AS c FROM events WHERE ${usaFilter} GROUP BY distinct_id)) GROUP BY bucket ORDER BY bucket`,
      daily_verse: `SELECT event, count() AS n, count(DISTINCT distinct_id) AS users FROM events WHERE event LIKE 'daily_verse%' AND ${usaFilter} GROUP BY event ORDER BY n DESC`,
      quiz: `SELECT event, count() AS n FROM events WHERE event LIKE 'quiz%' AND ${usaFilter} GROUP BY event ORDER BY n DESC`,
      wallpaper: `SELECT event, count() AS n FROM events WHERE (event LIKE 'wallpaper%' OR event LIKE 'live_wallpaper%') AND ${usaFilter} GROUP BY event ORDER BY n DESC`,
      companion: `SELECT event, count() AS n FROM events WHERE event LIKE 'companion%' AND ${usaFilter} GROUP BY event ORDER BY n DESC`,
      prayer: `SELECT event, count() AS n FROM events WHERE (event LIKE 'prayer%' OR event LIKE 'devotional%') AND ${usaFilter} GROUP BY event ORDER BY n DESC`,
    };
    const out: Record<string, unknown> = {};
    for (const [k,q] of Object.entries(queries)) { out[k] = await hogql(q, pid); }
    return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
