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

  // Per-country retention over last 60 days. Country = at first event.
  const q = `
    WITH firsts AS (
      SELECT distinct_id,
             argMin(properties.$geoip_country_code, timestamp) AS country,
             min(toDate(timestamp)) AS d0
      FROM events
      WHERE timestamp >= now() - INTERVAL 60 DAY
      GROUP BY distinct_id
    ),
    activity AS (
      SELECT DISTINCT distinct_id, toDate(timestamp) AS d
      FROM events
      WHERE timestamp >= now() - INTERVAL 60 DAY
    )
    SELECT
      f.country AS country,
      count(DISTINCT f.distinct_id) AS installs,
      countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
      countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
      countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
      countDistinctIf(f.distinct_id, a.d = f.d0 + 14) AS d14
    FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
    GROUP BY country
    HAVING installs >= 20
    ORDER BY installs DESC
    LIMIT 30`;


  const rows = await hogql(q, pid);
  return new Response(JSON.stringify({ rows }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
