// Feature usage among daily-retained users (ex-IN, ex-US).
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
  const clean = `properties.$geoip_country_code NOT IN ('IN','US') AND properties.$geoip_country_code IS NOT NULL`;

  const q: Record<string, string> = {
    // Users active on at least 2 distinct days in last 30d = "retained"
    top_events_retained_users_30d: `
      WITH retained AS (
        SELECT distinct_id
        FROM events
        WHERE timestamp >= now() - INTERVAL 30 DAY AND ${clean}
        GROUP BY distinct_id
        HAVING count(DISTINCT toDate(timestamp)) >= 2
      )
      SELECT e.event AS event,
             count() AS total_fires,
             count(DISTINCT e.distinct_id) AS users,
             round(100.0*count(DISTINCT e.distinct_id)/(SELECT count() FROM retained),1) AS pct_of_retained
      FROM events e
      WHERE e.distinct_id IN (SELECT distinct_id FROM retained)
        AND e.timestamp >= now() - INTERVAL 30 DAY
        AND e.event NOT LIKE '$%'
      GROUP BY event
      ORDER BY users DESC
      LIMIT 40`,

    // How many retained users vs one-day
    retention_cohort_size: `
      SELECT
        countDistinctIf(distinct_id, days >= 2) AS retained_users,
        countDistinctIf(distinct_id, days = 1) AS one_day_users,
        countDistinctIf(distinct_id, days >= 7) AS power_users_7plus_days
      FROM (
        SELECT distinct_id, count(DISTINCT toDate(timestamp)) AS days
        FROM events
        WHERE timestamp >= now() - INTERVAL 30 DAY AND ${clean}
        GROUP BY distinct_id
      )`,

    // Same but among users active TODAY (true daily-active)
    top_events_dau_last7d: `
      WITH dau AS (
        SELECT DISTINCT distinct_id FROM events
        WHERE timestamp >= now() - INTERVAL 7 DAY AND ${clean}
        GROUP BY distinct_id
        HAVING count(DISTINCT toDate(timestamp)) >= 3
      )
      SELECT e.event AS event,
             count() AS total_fires,
             count(DISTINCT e.distinct_id) AS users,
             round(100.0*count(DISTINCT e.distinct_id)/(SELECT count() FROM dau),1) AS pct
      FROM events e
      WHERE e.distinct_id IN (SELECT distinct_id FROM dau)
        AND e.timestamp >= now() - INTERVAL 7 DAY
        AND e.event NOT LIKE '$%'
      GROUP BY event ORDER BY users DESC LIMIT 40`,
  };

  const out: Record<string, unknown> = {};
  for (const [k, query] of Object.entries(q)) out[k] = await hogql(query, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
