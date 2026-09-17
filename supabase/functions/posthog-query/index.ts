const KEY = Deno.env.get("POSTHOG_PERSONAL_API_KEY")!;
const HOST = "https://us.posthog.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ogk" };

let projectId: string | null = null;
async function getProjectId() {
  if (projectId) return projectId;
  const r = await fetch(`${HOST}/api/projects/`, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
  projectId = r.results?.[0]?.id ?? null;
  return projectId;
}

async function hogql(query: string) {
  const pid = await getProjectId();
  if (!pid) return { error: "no project" };
  const res = await fetch(`${HOST}/api/projects/${pid}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  const j = await res.json();
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  let q = url.searchParams.get("q");
  if (!q && req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.q === "string") q = body.q;
      else if (typeof body?.q_b64 === "string") q = atob(body.q_b64);
    } catch { /* ignore */ }
  }
  const qb64 = url.searchParams.get("q_b64");
  if (!q && qb64) {
    try { q = atob(qb64); } catch { /* ignore */ }
  }
  if (!q) return new Response(JSON.stringify({ error: "no q" }), { headers: { ...cors, "content-type": "application/json" } });
  const result = await hogql(q);
  return new Response(JSON.stringify(result), { headers: { ...cors, "content-type": "application/json" } });
});
