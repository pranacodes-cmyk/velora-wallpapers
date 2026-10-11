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
  const url = new URL(req.url);
  // Cutoff = date the perf-overhaul update went live in Play Store.
  // Default = 2026-07-13 (2 days after the July-11 audit sweep). Override via ?cutoff=YYYY-MM-DD
  const cutoff = url.searchParams.get("cutoff") || "2026-07-13";
  const proj = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then(r => r.json());
  const pid = proj.results?.[0]?.id;
  const clean = `properties.$geoip_country_code NOT IN ('IN') AND properties.$geoip_country_code IS NOT NULL`;

  const q: Record<string, string> = {
    // 1) POST-UPDATE cohort (first-seen >= cutoff): engagement & retention
    post_update_summary: `
      WITH firsts AS (
        SELECT distinct_id,
               argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND ${clean}
        GROUP BY distinct_id
      ),
      activity AS (SELECT DISTINCT distinct_id, toDate(timestamp) AS d FROM events WHERE timestamp >= now() - INTERVAL 60 DAY)
      SELECT
        count(DISTINCT f.distinct_id) AS installs,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 1)/count(DISTINCT f.distinct_id),1) AS d1_pct,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 3)/count(DISTINCT f.distinct_id),1) AS d3_pct,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 7)/count(DISTINCT f.distinct_id),1) AS d7_pct
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      WHERE f.d0 >= toDate('${cutoff}') AND f.country NOT IN ('IN')`,

    // 2) PRE-UPDATE cohort for comparison (installed in the 14 days BEFORE cutoff, so they had time)
    pre_update_summary: `
      WITH firsts AS (
        SELECT distinct_id,
               argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 90 DAY AND ${clean}
        GROUP BY distinct_id
      ),
      activity AS (SELECT DISTINCT distinct_id, toDate(timestamp) AS d FROM events WHERE timestamp >= now() - INTERVAL 90 DAY)
      SELECT
        count(DISTINCT f.distinct_id) AS installs,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 1) AS d1,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 3) AS d3,
        countDistinctIf(f.distinct_id, a.d = f.d0 + 7) AS d7,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 1)/count(DISTINCT f.distinct_id),1) AS d1_pct,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 3)/count(DISTINCT f.distinct_id),1) AS d3_pct,
        round(100.0*countDistinctIf(f.distinct_id, a.d = f.d0 + 7)/count(DISTINCT f.distinct_id),1) AS d7_pct
      FROM firsts f LEFT JOIN activity a ON f.distinct_id = a.distinct_id
      WHERE f.d0 >= toDate('${cutoff}') - 14 AND f.d0 < toDate('${cutoff}')
        AND f.country NOT IN ('IN')`,

    // 3) POST-UPDATE engagement depth
    post_update_engagement: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND ${clean}
        GROUP BY distinct_id
      ),
      per_user AS (
        SELECT f.distinct_id,
               count() AS ev,
               countDistinct(toDate(e.timestamp)) AS days_active,
               dateDiff('second', min(e.timestamp), max(e.timestamp)) AS lifetime_sec
        FROM firsts f JOIN events e ON e.distinct_id = f.distinct_id
        WHERE f.d0 >= toDate('${cutoff}') AND f.country NOT IN ('IN')
        GROUP BY f.distinct_id
      )
      SELECT count() AS users,
             round(100.0*countIf(ev <= 2)/count(),1) AS bounced_pct,
             round(100.0*countIf(lifetime_sec < 10)/count(),1) AS died_under_10s_pct,
             round(100.0*countIf(lifetime_sec > 300)/count(),1) AS engaged_5min_plus_pct,
             round(100.0*countIf(days_active >= 2)/count(),1) AS returned_pct,
             round(avg(ev),1) AS avg_events,
             round(median(ev),1) AS median_events`,

    // 4) PRE-UPDATE engagement depth (same 14d pre-window)
    pre_update_engagement: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 90 DAY AND ${clean}
        GROUP BY distinct_id
      ),
      per_user AS (
        SELECT f.distinct_id,
               count() AS ev,
               countDistinct(toDate(e.timestamp)) AS days_active,
               dateDiff('second', min(e.timestamp), max(e.timestamp)) AS lifetime_sec
        FROM firsts f JOIN events e ON e.distinct_id = f.distinct_id
        WHERE f.d0 >= toDate('${cutoff}') - 14 AND f.d0 < toDate('${cutoff}')
          AND f.country NOT IN ('IN')
        GROUP BY f.distinct_id
      )
      SELECT count() AS users,
             round(100.0*countIf(ev <= 2)/count(),1) AS bounced_pct,
             round(100.0*countIf(lifetime_sec < 10)/count(),1) AS died_under_10s_pct,
             round(100.0*countIf(lifetime_sec > 300)/count(),1) AS engaged_5min_plus_pct,
             round(100.0*countIf(days_active >= 2)/count(),1) AS returned_pct,
             round(avg(ev),1) AS avg_events,
             round(median(ev),1) AS median_events`,

    // 5) TODAY's DAU: are they old users or new? Break down by install-date bucket
    today_dau_by_cohort: `
      WITH firsts AS (
        SELECT distinct_id, min(toDate(timestamp)) AS d0
        FROM events WHERE ${clean}
        GROUP BY distinct_id
      ),
      today_users AS (
        SELECT DISTINCT distinct_id FROM events
        WHERE toDate(timestamp) = today() AND ${clean}
      )
      SELECT
        multiIf(
          f.d0 = today(), 'today_new',
          f.d0 >= today() - 3, 'installed_last_3d',
          f.d0 >= today() - 7, 'installed_4_7d_ago',
          f.d0 >= toDate('${cutoff}'), 'post_update_cohort',
          f.d0 >= toDate('${cutoff}') - 14, 'pre_update_14d',
          f.d0 >= toDate('${cutoff}') - 30, 'pre_update_15_30d',
          'older_than_30d_pre_update'
        ) AS bucket,
        count(DISTINCT f.distinct_id) AS users
      FROM today_users t JOIN firsts f ON t.distinct_id = f.distinct_id
      GROUP BY bucket ORDER BY users DESC`,

    // 6) Install trend around the cutoff (daily new installs)
    installs_daily: `
      SELECT toDate(t) AS d, count() AS new_installs FROM (
        SELECT min(timestamp) AS t FROM events WHERE ${clean} GROUP BY distinct_id
      ) WHERE t >= now() - INTERVAL 45 DAY GROUP BY d ORDER BY d DESC`,

    // 7) DAU trend last 30d
    dau_trend_30d: `
      SELECT toDate(timestamp) AS d, count(DISTINCT distinct_id) AS dau
      FROM events WHERE timestamp >= now() - INTERVAL 30 DAY AND ${clean}
      GROUP BY d ORDER BY d DESC`,

    // 8) Wallpaper apply funnel POST-UPDATE (matches the fixed tracking)
    wallpaper_apply_post: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND ${clean}
        GROUP BY distinct_id
      )
      SELECT
        count(DISTINCT f.distinct_id) AS users_installed,
        countDistinctIf(f.distinct_id, e.event='apply_wallpaper_tap') AS tried_apply,
        countDistinctIf(f.distinct_id, e.event IN ('wallpaper_applied','wallpaper_apply_success','wallpaper_set','apply_wallpaper','live_wallpaper_apply')) AS succeeded_apply,
        round(100.0*countDistinctIf(f.distinct_id, e.event IN ('wallpaper_applied','wallpaper_apply_success','wallpaper_set','apply_wallpaper','live_wallpaper_apply'))/count(DISTINCT f.distinct_id),1) AS apply_success_pct
      FROM firsts f LEFT JOIN events e ON e.distinct_id = f.distinct_id
      WHERE f.d0 >= toDate('${cutoff}') AND f.country NOT IN ('IN')`,

    // 9) Purchases post-update
    purchases_post: `
      WITH firsts AS (
        SELECT distinct_id, argMin(properties.$geoip_country_code, timestamp) AS country,
               min(toDate(timestamp)) AS d0
        FROM events WHERE timestamp >= now() - INTERVAL 60 DAY AND ${clean}
        GROUP BY distinct_id
      )
      SELECT properties.trigger AS trig, count() AS n
      FROM events e JOIN firsts f ON f.distinct_id = e.distinct_id
      WHERE e.event='purchase_completed'
        AND f.d0 >= toDate('${cutoff}') AND f.country NOT IN ('IN')
      GROUP BY trig ORDER BY n DESC`,
  };

  const out: Record<string, unknown> = { cutoff };
  for (const [k, query] of Object.entries(q)) out[k] = await hogql(query, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
