// Quick PostHog query proxy. Returns top paywall triggers, conversion funnel, and event counts.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEY = Deno.env.get("POSTHOG_PERSONAL_API_KEY")!;
const HOST = "https://us.posthog.com";

async function hogql(query: string) {
  // Need project id — discover from /api/projects/
  const proj = await fetch(`${HOST}/api/projects/`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }).then((r) => r.json());
  const projectId = proj.results?.[0]?.id;
  if (!projectId) return { error: "no project", proj };
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
    const since = "now() - INTERVAL 30 DAY";

    const queries: Record<string, string> = {
      paywall_shown_by_trigger: `
        SELECT properties.trigger AS trigger, count() AS shown
        FROM events WHERE event = 'paywall_shown' AND timestamp > ${since}
        GROUP BY trigger ORDER BY shown DESC LIMIT 20`,
      purchase_completed_by_trigger: `
        SELECT properties.trigger AS trigger, count() AS purchases
        FROM events WHERE event = 'purchase_completed' AND timestamp > ${since}
        GROUP BY trigger ORDER BY purchases DESC LIMIT 20`,
      purchase_completed_by_plan: `
        SELECT properties.plan AS plan, count() AS n
        FROM events WHERE event = 'purchase_completed' AND timestamp > ${since}
        GROUP BY plan ORDER BY n DESC`,
      funnel_counts: `
        SELECT event, count() AS n FROM events
        WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_started','purchase_completed','purchase_cancelled','purchase_failed')
          AND timestamp > ${since}
        GROUP BY event ORDER BY n DESC`,
      daily_purchases_last_14d: `
        SELECT toDate(timestamp) AS d, count() AS n
        FROM events WHERE event = 'purchase_completed' AND timestamp > now() - INTERVAL 14 DAY
        GROUP BY d ORDER BY d DESC`,
      top_events_30d: `
        SELECT event, count() AS n FROM events
        WHERE timestamp > ${since}
        GROUP BY event ORDER BY n DESC LIMIT 30`,
      dau_last_30d: `
        SELECT toDate(timestamp) AS d, count(DISTINCT distinct_id) AS dau
        FROM events WHERE timestamp > ${since}
        GROUP BY d ORDER BY d DESC`,
      new_vs_returning_30d: `
        SELECT
          countDistinctIf(distinct_id, first_seen = d) AS new_users,
          countDistinctIf(distinct_id, first_seen < d) AS returning_users,
          d
        FROM (
          SELECT distinct_id, toDate(timestamp) AS d,
            min(toDate(timestamp)) OVER (PARTITION BY distinct_id) AS first_seen
          FROM events WHERE timestamp > now() - INTERVAL 30 DAY
        )
        GROUP BY d ORDER BY d DESC`,
      day1_retention_last_14d: `
        SELECT
          first_day,
          count(DISTINCT distinct_id) AS cohort,
          countDistinctIf(distinct_id, returned_d1) AS d1_returned,
          countDistinctIf(distinct_id, returned_d7) AS d7_returned
        FROM (
          SELECT
            distinct_id,
            min_first_day AS first_day,
            maxIf(1, toDate(timestamp) = min_first_day + 1) > 0 AS returned_d1,
            maxIf(1, toDate(timestamp) = min_first_day + 7) > 0 AS returned_d7
          FROM (
            SELECT distinct_id, timestamp,
              min(toDate(timestamp)) OVER (PARTITION BY distinct_id) AS min_first_day
            FROM events WHERE timestamp > now() - INTERVAL 21 DAY
          )
          GROUP BY distinct_id, min_first_day
        )
        WHERE first_day > now() - INTERVAL 14 DAY
        GROUP BY first_day ORDER BY first_day DESC`,
      daily_verse_funnel: `
        SELECT event, count() AS n, count(DISTINCT distinct_id) AS users
        FROM events
        WHERE event IN ('paywall_shown','paywall_cta_tapped','purchase_completed')
          AND properties.trigger IN ('daily_verse_auto_unlock','daily_verse_manual_apply','daily_verse')
          AND timestamp > ${since}
        GROUP BY event`,
      sessions_per_user_30d: `
        SELECT bucket, count() AS users FROM (
          SELECT distinct_id,
            multiIf(c=1,'1_session', c<=3,'2-3', c<=7,'4-7', c<=20,'8-20','21+') AS bucket
          FROM (
            SELECT distinct_id, count(DISTINCT toDate(timestamp)) AS c
            FROM events WHERE timestamp > ${since}
            GROUP BY distinct_id
          )
        ) GROUP BY bucket ORDER BY bucket`,
    };

    const out: Record<string, unknown> = {};
    for (const [k, q] of Object.entries(queries)) {
      out[k] = await hogql(q);
    }
    return new Response(JSON.stringify(out, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
