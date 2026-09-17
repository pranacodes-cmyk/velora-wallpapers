/**
 * Read-only proxy that forwards a diagnostics request to the admin-guarded
 * `play-console` function using the service-role key, so analytics pulls work
 * from tooling without exposing the key.
 *
 * Only read actions are allowed.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ALLOWED = new Set(['permissions', 'vitals', 'subscriptions', 'voided', 'diagnose', 'listing', 'images']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body.action ?? '');
  if (!ALLOWED.has(action)) return json({ error: 'action not allowed', action }, 400);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/play-console`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
