// Meta Conversions API edge function (server-side App Events).
// Fires events directly to Meta's dataset endpoint so they are deduplicated
// against client-side SDK events using event_id. Powers Value Optimization
// even when client-side events are blocked (iOS ATT denied, ad blockers, etc.)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const META_APP_ID = Deno.env.get("META_APP_ID") ?? "1327255305975486";
const META_DATASET_ID = Deno.env.get("META_DATASET_ID") ?? "927046087032329";
const META_CAPI_ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") ?? "";

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface AppData {
  platform?: "ios" | "android" | "web";
  bundle_id?: string;
  app_version?: string;
  os_version?: string;
  device_model?: string;
  locale?: string;
  timezone?: string;
  screen_width?: number;
  screen_height?: number;
  advertiser_tracking_enabled?: 0 | 1;
}

interface TrackPayload {
  event_name: string;
  event_id?: string;
  value?: number;
  currency?: string;
  device_id?: string;
  app_user_id?: string;
  email?: string;
  fbc?: string;
  fbp?: string;
  custom_data?: Record<string, unknown>;
  action_source?: "app" | "website";
  app_data?: AppData;
}

/**
 * Build Meta's positional `extinfo` array.
 * Required for App Events via CAPI. Missing/wrong format → error 2804043.
 * Spec: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters/#extinfo
 */
function buildExtInfo(a: AppData = {}): (string | number)[] {
  const isIOS = a.platform === "ios";
  const version = isIOS ? "i2" : "a2"; // i2 = iOS extinfo v2, a2 = Android v2
  // os_version must be a non-empty, non-"0" string Meta can parse.
  const rawOs = (a.os_version ?? "").trim();
  const osVersion = rawOs && rawOs !== "0" ? rawOs : (isIOS ? "17.0" : "13");
  return [
    version,
    a.bundle_id ?? "com.jesuswallpaperbible.app",
    "",                       // app_build (long version) — optional
    a.app_version ?? "1.0.0",
    osVersion,
    a.device_model ?? "",
    a.locale ?? "en_US",
    a.timezone ?? "GMT+0",
    "",                       // carrier
    a.screen_width ?? 0,
    a.screen_height ?? 0,
    "",                       // screen_density
    0,                        // cpu_cores
    0,                        // ext_storage_gb
    0,                        // free_storage_gb
    "",                       // device_timezone
  ];
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!META_CAPI_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "META_CAPI_ACCESS_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as TrackPayload;
    if (!body?.event_name) {
      return new Response(JSON.stringify({ error: "event_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    // Web platforms must be tracked as "website" — App Events extinfo
    // only accepts iOS/Android device info. Otherwise Meta returns 2804043.
    const isWebPlatform = body.app_data?.platform === "web" || !body.app_data?.platform;
    const actionSource =
      body.action_source === "app" && !isWebPlatform ? "app" : "website";

    // Advanced matching: combine device_id + app_user_id (RevenueCat) as
    // external_id, hash email if present, forward fbc/fbp click IDs.
    const externalIds: string[] = [];
    if (body.device_id) externalIds.push(await sha256(body.device_id));
    if (body.app_user_id) externalIds.push(await sha256(body.app_user_id));

    const userData: Record<string, unknown> = {
      client_ip_address: ip,
      client_user_agent: ua,
    };
    if (externalIds.length) userData.external_id = externalIds;
    if (body.email) userData.em = [await sha256(body.email.trim().toLowerCase())];
    if (body.fbc) userData.fbc = body.fbc;
    if (body.fbp) userData.fbp = body.fbp;

    const event: Record<string, unknown> = {
      event_name: body.event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: actionSource,
      event_id: body.event_id ?? crypto.randomUUID(),
      user_data: userData,
    };

    // App Events (action_source="app") REQUIRE app_data with extinfo.
    if (actionSource === "app") {
      const ad = body.app_data ?? {};
      event.app_data = {
        advertiser_tracking_enabled: ad.advertiser_tracking_enabled ?? 1,
        application_tracking_enabled: 1,
        extinfo: buildExtInfo(ad),
      };
    } else {
      // Website events: include event_source_url for better matching/attribution.
      event.event_source_url = "https://velora-wallpapers.lovable.app/";
    }



    const customData: Record<string, unknown> = { ...(body.custom_data ?? {}) };
    if (typeof body.value === "number") customData.value = body.value;
    if (body.currency) customData.currency = body.currency;
    if (Object.keys(customData).length) event.custom_data = customData;


    const url = `https://graph.facebook.com/v21.0/${META_DATASET_ID}/events`;
    const params = new URLSearchParams({
      access_token: META_CAPI_ACCESS_TOKEN,
      data: JSON.stringify([event]),
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[meta-capi] Meta API error", res.status, text);
      return new Response(JSON.stringify({ error: "Meta API error", status: res.status, body: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, meta: JSON.parse(text) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meta-capi] fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
