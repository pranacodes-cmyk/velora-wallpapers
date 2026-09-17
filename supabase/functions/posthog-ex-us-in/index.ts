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

  // Exclude junk countries: IN + US. Look at real users only.
  const clean = `properties.$geoip_country_code NOT IN ('IN','US') AND properties.$geoip_country_code IS NOT NULL`;

  const queries: Record<string, string> = {
    // Overall retention rollup ex-IN-US
    retention_overall: `
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
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
      )
      SELECT
        count(DISTINCT f.distinct_id) AS total_users,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 14) AS d14,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 30) AS d30
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL
        AND f.d0 <= today() - 14`,

    engagement_depth: `
      WITH firsts AS (
        SELECT distinct_id,
               argMin(properties.$geoip_country_code, timestamp) AS country
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
        GROUP BY distinct_id
      ),
      per_user AS (
        SELECT f.distinct_id,
               count() AS ev,
               countDistinct(toDate(e.timestamp)) AS days_active,
               dateDiff('second', min(e.timestamp), max(e.timestamp)) AS lifetime_sec
        FROM firsts f JOIN events e ON e.distinct_id = f.distinct_id
        WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL
          AND e.timestamp >= now() - INTERVAL 60 DAY
        GROUP BY f.distinct_id
      )
      SELECT count() AS users,
             countIf(ev <= 2) AS bounced,
             round(100.0*countIf(ev <= 2)/count(),1) AS bounced_pct,
             countIf(lifetime_sec < 10) AS died_under_10s,
             round(100.0*countIf(lifetime_sec < 10)/count(),1) AS died_under_10s_pct,
             countIf(lifetime_sec > 300) AS engaged_5min_plus,
             round(100.0*countIf(lifetime_sec > 300)/count(),1) AS engaged_5min_plus_pct,
             countIf(days_active >= 2) AS returned,
             round(100.0*countIf(days_active >= 2)/count(),1) AS returned_pct,
             countIf(days_active >= 7) AS power_users,
             round(avg(ev),1) AS avg_events,
             round(median(ev),1) AS median_events
      FROM per_user`,

    paywall_funnel: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY GROUP BY distinct_id
      )
      SELECT
        countIf(event='paywall_shown') AS shown,
        countIf(event='paywall_cta_tapped') AS tapped,
        countIf(event='purchase_started') AS started,
        countIf(event='purchase_completed') AS completed,
        countIf(event='purchase_cancelled') AS cancelled,
        count(DISTINCT if(event='paywall_shown', e.distinct_id, NULL)) AS unique_shown,
        count(DISTINCT if(event='purchase_completed', e.distinct_id, NULL)) AS unique_buyers
      FROM events e JOIN firsts f ON f.distinct_id = e.distinct_id
      WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL
        AND e.timestamp >= now() - INTERVAL 60 DAY`,

    wallpaper_apply_funnel: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY GROUP BY distinct_id
      )
      SELECT
        count(DISTINCT f.distinct_id) AS total_users,
        countDistinctIf(f.distinct_id, e.event IN ('apply_wallpaper','wallpaper_applied','wallpaper_set')) AS ever_applied,
        round(100.0*countDistinctIf(f.distinct_id, e.event IN ('apply_wallpaper','wallpaper_applied','wallpaper_set'))/count(DISTINCT f.distinct_id),1) AS apply_pct
      FROM firsts f LEFT JOIN events e ON e.distinct_id = f.distinct_id
      WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL`,

    top_countries_clean: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY GROUP BY distinct_id
      ),
      activity AS (
        SELECT DISTINCT distinct_id, toDate(timestamp) AS d
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY
      )
      SELECT f.country,
             count(DISTINCT f.distinct_id) AS users,
             round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 1)/count(DISTINCT f.distinct_id),1) AS d1_pct,
             round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 7)/count(DISTINCT f.distinct_id),1) AS d7_pct,
             round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 14)/count(DISTINCT f.distinct_id),1) AS d14_pct
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL
      GROUP BY f.country HAVING users >= 20 ORDER BY users DESC LIMIT 20`,

    dau_trend_14d: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country
        FROM events WHERE timestamp >= now() - INTERVAL 30 DAY GROUP BY distinct_id
      )
      SELECT toDate(e.timestamp) AS d, count(DISTINCT e.distinct_id) AS dau
      FROM events e JOIN firsts f ON f.distinct_id = e.distinct_id
      WHERE f.country NOT IN ('IN','US') AND f.country IS NOT NULL
        AND e.timestamp >= now() - INTERVAL 14 DAY
      GROUP BY d ORDER BY d DESC`,
  };

  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
