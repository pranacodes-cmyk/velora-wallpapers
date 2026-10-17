/** Legacy forwarder retired: RevenueCat native Meta integration owns conversions.
 * This endpoint never changes purchases, restores or customer entitlements.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  return new Response(JSON.stringify({ ok: true, skipped: "revenuecat-native-meta-owns-conversions" }), { status: 200, headers });
});
