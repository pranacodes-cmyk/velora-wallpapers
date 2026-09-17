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
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const proj = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then(r => r.json());
  const pid = proj.results?.[0]?.id;
  const notIN = `(properties.$geoip_country_code IS NULL OR properties.$geoip_country_code != 'IN')`;
  const today = `toDate(timestamp) = today()`;

  const queries: Record<string,string> = {
    // Truly-new = first EVER event was today (lifetime lookback)
    truly_new_users_today_ex_india: `
      SELECT count(*) AS truly_new FROM (
        SELECT distinct_id, min(toDate(timestamp)) AS first_day
        FROM events
        WHERE timestamp > now() - INTERVAL 180 DAY
          AND ${notIN}
        GROUP BY distinct_id
        HAVING first_day = today()
      )`,
    // app_first_open users today
    app_first_open_today: `
      SELECT count(DISTINCT distinct_id) AS users, count() AS events
      FROM events WHERE event='app_first_open' AND ${today} AND ${notIN}`,
    // Break by platform
    truly_new_by_platform: `
      SELECT platform, count() AS n FROM (
        SELECT distinct_id, any(properties.platform) AS platform,
               min(toDate(timestamp)) AS first_day
        FROM events
        WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN}
        GROUP BY distinct_id
        HAVING first_day = today()
      ) GROUP BY platform ORDER BY n DESC`,
    // Break by country
    truly_new_by_country: `
      SELECT country, count() AS n FROM (
        SELECT distinct_id, any(properties.$geoip_country_code) AS country,
               min(toDate(timestamp)) AS first_day
        FROM events
        WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN}
        GROUP BY distinct_id
        HAVING first_day = today()
      ) GROUP BY country ORDER BY n DESC`,
    // How deep did those new users go?
    truly_new_engagement_buckets: `
      SELECT bucket, count() AS users FROM (
        SELECT distinct_id,
          multiIf(c=1,'1_event',c<=3,'2-3',c<=10,'4-10',c<=30,'11-30','31+') AS bucket
        FROM (
          SELECT e.distinct_id AS distinct_id, count() AS c
          FROM events e
          WHERE ${today} AND ${notIN}
            AND e.distinct_id IN (
              SELECT distinct_id FROM events
              WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN}
              GROUP BY distinct_id
              HAVING min(toDate(timestamp)) = today()
            )
          GROUP BY e.distinct_id
        )
      ) GROUP BY bucket ORDER BY bucket`,
    // Onboarding completion among truly-new
    onboarding_by_truly_new: `
      SELECT count(DISTINCT distinct_id) AS completed
      FROM events
      WHERE event='onboarding_completed' AND ${today} AND ${notIN}
        AND distinct_id IN (
          SELECT distinct_id FROM events
          WHERE timestamp > now() - INTERVAL 180 DAY AND ${notIN}
          GROUP BY distinct_id
          HAVING min(toDate(timestamp)) = today()
        )`,
  };
  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) out[k] = await hogql(q, pid);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
