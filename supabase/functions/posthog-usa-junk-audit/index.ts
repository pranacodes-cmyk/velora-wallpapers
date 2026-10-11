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

  // ============ USA JUNK-INSTALL AUDIT (last 60 days) ============
  // Compare USA behavior to clean/paid-quality cohorts (BR/MX/PH).
  // If Meta pushed junk installs, USA will show: near-zero events per user,
  // 100% one-session bounces, no wallpaper applies, bot-like install hours.

  // 1. Per-user engagement depth in USA vs benchmarks
  const q1 = `
    WITH firsts AS (
      SELECT distinct_id,
             argMin(properties.$geoip_country_code, timestamp) AS country,
             min(timestamp) AS first_ts
      FROM events
      WHERE timestamp >= now() - INTERVAL 60 DAY
      GROUP BY distinct_id
    ),
    per_user AS (
      SELECT f.country,
             f.distinct_id,
             count() AS total_events,
             countDistinct(toDate(e.timestamp)) AS active_days,
             countIf(e.event = 'wallpaper_applied' OR e.event = 'apply_wallpaper' OR e.event = 'wallpaper_set') AS applied,
             countIf(e.event = 'prayer_completed' OR e.event = 'devotional_completed') AS prayed,
             dateDiff('second', min(e.timestamp), max(e.timestamp)) AS lifetime_seconds
      FROM firsts f
      JOIN events e ON e.distinct_id = f.distinct_id
      WHERE e.timestamp >= now() - INTERVAL 60 DAY
      GROUP BY f.country, f.distinct_id
    )
    SELECT country,
           count() AS users,
           round(avg(total_events), 1) AS avg_events,
           round(median(total_events), 1) AS median_events,
           countIf(total_events <= 2) AS bounced_users,
           round(100.0 * countIf(total_events <= 2) / count(), 1) AS bounced_pct,
           countIf(active_days >= 2) AS returned_users,
           round(100.0 * countIf(active_days >= 2) / count(), 1) AS returned_pct,
           countIf(applied > 0) AS ever_applied,
           round(100.0 * countIf(applied > 0) / count(), 1) AS applied_pct,
           round(avg(lifetime_seconds), 0) AS avg_lifetime_sec
    FROM per_user
    WHERE country IN ('US', 'BR', 'MX', 'PH', 'ID', 'IN')
    GROUP BY country
    ORDER BY users DESC`;

  // 2. Install-hour distribution for USA (bot signal: spikes at 3am / off-hours)
  const q2 = `
    WITH firsts AS (
      SELECT distinct_id,
             argMin(properties.$geoip_country_code, timestamp) AS country,
             min(timestamp) AS first_ts
      FROM events
      WHERE timestamp >= now() - INTERVAL 30 DAY
      GROUP BY distinct_id
    )
    SELECT country,
           toHour(first_ts) AS install_hour_utc,
           count() AS installs
    FROM firsts
    WHERE country IN ('US', 'BR', 'PH')
    GROUP BY country, install_hour_utc
    ORDER BY country, install_hour_utc`;

  // 3. USA: session length distribution
  const q3 = `
    WITH per_user AS (
      SELECT distinct_id,
             argMin(properties.$geoip_country_code, timestamp) AS country,
             dateDiff('second', min(timestamp), max(timestamp)) AS lifetime_sec,
             count() AS events
      FROM events
      WHERE timestamp >= now() - INTERVAL 60 DAY
      GROUP BY distinct_id
    )
    SELECT country,
           countIf(lifetime_sec < 10) AS died_under_10s,
           countIf(lifetime_sec BETWEEN 10 AND 60) AS died_10_60s,
           countIf(lifetime_sec BETWEEN 60 AND 300) AS lasted_1_5min,
           countIf(lifetime_sec > 300) AS engaged_5min_plus,
           count() AS total
    FROM per_user
    WHERE country IN ('US', 'BR', 'MX', 'PH')
    GROUP BY country
    ORDER BY total DESC`;

  const [engagement, hours, session] = await Promise.all([
    hogql(q1, pid), hogql(q2, pid), hogql(q3, pid),
  ]);

  return new Response(JSON.stringify({ engagement, hours, session }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
