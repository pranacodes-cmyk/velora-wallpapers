// One-off PostHog audit: does auto-enabled 7am/9pm prayer bells hurt us?
// Compares app activity around those hours + uninstall / notification events.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const KEY = Deno.env.get("POSTHOG_PERSONAL_API_KEY")!;
const HOST = "https://us.posthog.com";

async function hogql(query: string) {
  const proj = await fetch(`${HOST}/api/projects/`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }).then((r) => r.json());
  const projectId = proj.results?.[0]?.id;
  if (!projectId) return { error: "no project" };
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
      // 1. Event names that mention alarm/notification/uninstall — see what we have
      notif_event_names: `
        SELECT event, count() AS n FROM events
        WHERE timestamp > ${since}
          AND (event ILIKE '%alarm%' OR event ILIKE '%notif%' OR event ILIKE '%uninstall%'
               OR event ILIKE '%bell%' OR event ILIKE '%prayer%' OR event ILIKE '%push%'
               OR event ILIKE '$app%')
        GROUP BY event ORDER BY n DESC LIMIT 40`,
      // 2. App open counts by local hour — is 7am / 9pm inflated (bell working) or flat (users ignoring)?
      opens_by_local_hour: `
        SELECT toHour(timestamp) AS hour, count(DISTINCT distinct_id) AS unique_users, count() AS opens
        FROM events
        WHERE event IN ('$pageview', 'Application Opened', 'app_opened', '$screen', '$app_open')
          AND timestamp > ${since}
        GROUP BY hour ORDER BY hour`,
      // 3. Uninstall counts by hour of day (if PostHog captures Application Uninstalled)
      uninstalls_by_hour: `
        SELECT toHour(timestamp) AS hour, count() AS n
        FROM events
        WHERE event IN ('Application Uninstalled', '$app_uninstalled', 'app_uninstalled')
          AND timestamp > ${since}
        GROUP BY hour ORDER BY hour`,
      // 4. Uninstalls total per day, last 30d
      uninstalls_daily: `
        SELECT toDate(timestamp) AS d, count() AS n
        FROM events
        WHERE event IN ('Application Uninstalled', '$app_uninstalled', 'app_uninstalled')
          AND timestamp > ${since}
        GROUP BY d ORDER BY d DESC LIMIT 30`,
      // 5. Onboarding completion → % who tapped both prayer times (both option)
      onboarding_time_pick: `
        SELECT properties.time AS pick, count() AS n
        FROM events
        WHERE event = 'onboarding_prayer_time_picked' AND timestamp > ${since}
        GROUP BY pick ORDER BY n DESC`,
      // 6. Backup: onboarding events that mention time / alarm
      onboarding_related: `
        SELECT event, count() AS n FROM events
        WHERE timestamp > ${since} AND event ILIKE '%onboarding%'
        GROUP BY event ORDER BY n DESC LIMIT 30`,
      // 7. D1 retention split — not possible in one query cleanly, so proxy:
      // Sessions per user in last 30d — heavy tail vs one-off installers
      sessions_per_user_hist: `
        SELECT sessions_bucket, count() AS users FROM (
          SELECT distinct_id,
            multiIf(n = 1, '1_only',
                    n <= 3, '2-3',
                    n <= 7, '4-7',
                    n <= 20, '8-20',
                    '20+') AS sessions_bucket
          FROM (
            SELECT distinct_id, count(DISTINCT toDate(timestamp)) AS n
            FROM events WHERE timestamp > ${since} GROUP BY distinct_id
          )
        ) GROUP BY sessions_bucket ORDER BY sessions_bucket`,
    };
    const results: Record<string, unknown> = {};
    for (const [k, q] of Object.entries(queries)) {
      const r = await hogql(q);
      results[k] = r?.results ?? r?.error ?? r;
    }
    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
