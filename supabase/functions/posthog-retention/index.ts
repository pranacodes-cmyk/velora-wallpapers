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

  const queries: Record<string, string> = {
    // Rolling retention: for each cohort day, how many came back D1/D3/D7/D14
    retention_by_cohort: `
      WITH firsts AS (
        SELECT distinct_id, min(toDate(timestamp)) AS d0
        FROM events WHERE ${notIN}
        GROUP BY distinct_id
      ),
      activity AS (
        SELECT DISTINCT e.distinct_id, toDate(e.timestamp) AS d
        FROM events e WHERE ${notIN}
      )
      SELECT
        f.d0 AS cohort,
        count(DISTINCT f.distinct_id) AS cohort_size,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 14) AS d14
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      GROUP BY cohort ORDER BY cohort DESC LIMIT 30`,
    // Overall retention rollup ex-IN
    retention_overall: `
      WITH firsts AS (
        SELECT distinct_id, min(toDate(timestamp)) AS d0
        FROM events WHERE ${notIN}
        GROUP BY distinct_id
      ),
      activity AS (
        SELECT DISTINCT e.distinct_id, toDate(e.timestamp) AS d
        FROM events e WHERE ${notIN}
      )
      SELECT
        count(DISTINCT f.distinct_id) AS total_users,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 14) AS d14
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      WHERE f.d0 <= today() - 14`,
    // Session count distribution ex-IN
    days_active_dist: `
      SELECT bucket, count() AS users FROM (
        SELECT distinct_id, multiIf(c=1,'1_day',c<=2,'2',c<=3,'3',c<=7,'4-7',c<=14,'8-14','15+') AS bucket
        FROM (SELECT distinct_id, count(DISTINCT toDate(timestamp)) AS c FROM events WHERE ${notIN} GROUP BY distinct_id)
      ) GROUP BY bucket ORDER BY bucket`,
    // Paywall by country (ex-IN) — who sees it, who converts
    paywall_by_country: `
      SELECT properties.$geoip_country_code AS c,
        countIf(event='paywall_shown') AS shown,
        countIf(event='paywall_cta_tapped') AS tapped,
        countIf(event='purchase_started') AS started,
        countIf(event='purchase_completed') AS completed,
        countIf(event='purchase_cancelled') AS cancelled
      FROM events WHERE ${notIN}
      GROUP BY c HAVING shown > 20 ORDER BY shown DESC LIMIT 15`,
    // What are premium users doing before purchase? Trigger of the 5 purchases
    purchase_triggers: `
      SELECT properties.trigger AS trig, properties.plan AS plan, properties.$geoip_country_code AS c, count() AS n
      FROM events WHERE event='purchase_completed' AND ${notIN}
      GROUP BY trig, plan, c ORDER BY n DESC`,
    // Purchase started but cancelled: where they drop
    started_vs_completed_by_country: `
      SELECT properties.$geoip_country_code AS c,
        countIf(event='purchase_started') AS started,
        countIf(event='purchase_completed') AS completed,
        countIf(event='purchase_cancelled') AS cancelled
      FROM events WHERE event IN ('purchase_started','purchase_completed','purchase_cancelled') AND ${notIN}
      GROUP BY c ORDER BY started DESC LIMIT 15`,
    // How many paywalls shown per user (fatigue check)
    paywalls_per_user: `
      SELECT bucket, count() AS users FROM (
        SELECT distinct_id, multiIf(n=1,'1',n<=2,'2',n<=5,'3-5',n<=10,'6-10','11+') AS bucket
        FROM (SELECT distinct_id, count() AS n FROM events WHERE event='paywall_shown' AND ${notIN} GROUP BY distinct_id)
      ) GROUP BY bucket ORDER BY bucket`,
    // Time to purchase after first_open
    time_to_purchase: `
      WITH firsts AS (SELECT distinct_id, min(timestamp) AS t0 FROM events WHERE ${notIN} GROUP BY distinct_id),
      buys AS (SELECT distinct_id, min(timestamp) AS tp FROM events WHERE event='purchase_completed' AND ${notIN} GROUP BY distinct_id)
      SELECT distinct_id, dateDiff('minute', firsts.t0, buys.tp) AS mins_to_purchase
      FROM buys JOIN firsts ON firsts.distinct_id = buys.distinct_id
      ORDER BY mins_to_purchase`,
    // Engagement of purchasers vs non
    buyers_engagement: `
      WITH buyers AS (SELECT DISTINCT distinct_id FROM events WHERE event='purchase_completed' AND ${notIN})
      SELECT
        if(distinct_id IN (SELECT distinct_id FROM buyers), 'buyer', 'non_buyer') AS grp,
        count(DISTINCT distinct_id) AS users,
        avg(events_per_user) AS avg_events,
        avg(days_active) AS avg_days
      FROM (
        SELECT distinct_id, count() AS events_per_user, count(DISTINCT toDate(timestamp)) AS days_active
        FROM events WHERE ${notIN} GROUP BY distinct_id
      ) GROUP BY grp`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
