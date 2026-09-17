/**
 * OTA release management (admin only).
 *
 * Registers / disables / rolls out web bundles that the `ota-update`
 * endpoint serves to installed apps.
 *
 * Auth: `x-ota-key: <OTA_RELEASE_KEY>` header, or a signed-in user JWT
 * belonging to a user with the `admin` role.
 *
 * POST body: { action, ...params }
 *   publish     { version, url, checksum, platform?, channel?, native_version?,
 *                 min_native_version?, rollout?, notes? }
 *   list        { platform?, channel? }
 *   rollout     { version, platform?, channel?, rollout }
 *   deactivate  { version, platform?, channel? }   // instant rollback
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OTA_KEY = Deno.env.get('OTA_RELEASE_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function isAuthorized(req: Request): Promise<boolean> {
  const key = req.headers.get('x-ota-key') ?? '';
  if (OTA_KEY && key && key === OTA_KEY) return true;

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  if (SERVICE_ROLE && token === SERVICE_ROLE) return true;

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData } = await client.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return false;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' });
    return data === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!(await isAuthorized(req))) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const action = String(body.action ?? '');
  const platform = body.platform === 'ios' ? 'ios' : 'android';
  const channel = typeof body.channel === 'string' && body.channel.trim() ? body.channel.trim() : 'production';
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    if (action === 'publish') {
      const version = String(body.version ?? '').trim();
      const url = String(body.url ?? '').trim();
      const checksum = String(body.checksum ?? '').trim();
      if (!/^\d+\.\d+\.\d+$/.test(version)) return json({ error: 'version must be x.y.z' }, 400);
      if (!/^https:\/\//.test(url)) return json({ error: 'url must be https' }, 400);
      if (!/^[a-f0-9]{64}$/i.test(checksum)) return json({ error: 'checksum must be sha256 hex' }, 400);

      const rollout = Math.max(0, Math.min(100, Number(body.rollout ?? 100)));
      const row = {
        version,
        platform,
        channel,
        url,
        checksum: checksum.toLowerCase(),
        rollout,
        active: true,
        native_version: body.native_version ? String(body.native_version) : null,
        min_native_version: body.min_native_version ? String(body.min_native_version) : null,
        notes: body.notes ? String(body.notes) : null,
        // Urgent bundles are applied during splash on the very next launch
        // instead of waiting for a later cold start.
        urgent: body.urgent === true,
      };
      const { data, error } = await supabase
        .from('ota_bundles')
        .upsert(row, { onConflict: 'platform,channel,version' })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, bundle: data });
    }

    if (action === 'list') {
      const { data, error } = await supabase
        .from('ota_bundles')
        .select('*')
        .eq('platform', platform)
        .eq('channel', channel)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return json({ error: error.message }, 500);
      return json({ bundles: data });
    }

    if (action === 'rollout') {
      const version = String(body.version ?? '').trim();
      const rollout = Math.max(0, Math.min(100, Number(body.rollout ?? 100)));
      const { data, error } = await supabase
        .from('ota_bundles')
        .update({ rollout })
        .eq('platform', platform)
        .eq('channel', channel)
        .eq('version', version)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, bundle: data });
    }

    if (action === 'deactivate') {
      const version = String(body.version ?? '').trim();
      const { data, error } = await supabase
        .from('ota_bundles')
        .update({ active: false })
        .eq('platform', platform)
        .eq('channel', channel)
        .eq('version', version)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, bundle: data });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
