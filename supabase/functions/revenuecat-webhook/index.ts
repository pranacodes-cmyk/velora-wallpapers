/**
 * RevenueCat → Meta Conversions API webhook.
 *
 * RevenueCat fires this for: INITIAL_PURCHASE, RENEWAL, TRIAL_CONVERSION,
 * CANCELLATION, REFUND, NON_RENEWING_PURCHASE, EXPIRATION, BILLING_ISSUE.
 *
 * This is the SINGLE sender of StartTrial and Purchase to Meta:
 *   - INITIAL_PURCHASE with period_type TRIAL → StartTrial (value 0)
 *   - INITIAL_PURCHASE / RENEWAL / TRIAL_CONVERSION / NON_RENEWING → Purchase
 * Device ids ($gpsAdId, $fbAnonId, $ip) come from RevenueCat subscriber
 * attributes set by the app, so Meta can attribute events to the ad.
 *
 * Setup:
 *   RevenueCat dashboard → Integrations → Webhooks
 *   URL:    https://<project-ref>.functions.supabase.co/revenuecat-webhook
 *   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const META_APP_ID = Deno.env.get("META_APP_ID") ?? "1327255305975486";
const META_DATASET_ID = Deno.env.get("META_DATASET_ID") ?? "927046087032329";
const META_CAPI_ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") ?? "";
const RC_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

function buildAndroidExtInfo(): (string | number)[] {
  return [
    "a2",
    "com.jesuswallpaperbible.app",
    "",
    "1.0.0",
    "13",
    "",
    "en_US",
    "GMT+0",
    "",
    0,
    0,
    "",
    0,
    0,
    0,
    "",
  ];
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

type RcEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  price?: number;
  price_in_purchased_currency?: number;
  currency?: string;
  purchased_at_ms?: number;
  event_timestamp_ms?: number;
  transaction_id?: string;
  original_transaction_id?: string;
  store?: string;
  country_code?: string;
  ip?: string;
  period_type?: string;
  environment?: string;
  subscriber_attributes?: Record<string, { value?: string } | undefined>;
};

function attr(ev: RcEvent, key: string): string | undefined {
  const v = ev.subscriber_attributes?.[key]?.value;
  return v && String(v).trim() ? String(v).trim() : undefined;
}

const REVENUE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "TRIAL_CONVERSION",
  "NON_RENEWING_PURCHASE",
]);

async function fireMetaEvent(opts: {
  eventName: string;
  value: number;
  currency: string;
  productId?: string;
  externalId?: string;
  eventId: string;
  ip?: string;
  countryCode?: string;
  eventTimeSec: number;
  madid?: string;
  anonId?: string;
  userAgent?: string;
}) {
  const userData: Record<string, unknown> = {};
  // Device identifiers are what let Meta attribute the event to the ad that
  // drove the install. Meta requires madid / anon_id unhashed.
  if (opts.madid) userData.madid = opts.madid;
  if (opts.anonId) userData.anon_id = opts.anonId;
  if (opts.ip) userData.client_ip_address = opts.ip;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.externalId) userData.external_id = [await sha256(opts.externalId)];
  if (opts.countryCode) userData.country = [await sha256(opts.countryCode.toLowerCase())];

  const customData: Record<string, unknown> = {
    value: Number(opts.value.toFixed(4)),
    currency: opts.currency,
  };
  if (opts.productId) customData.content_ids = [opts.productId];

  const event = {
    event_name: opts.eventName,
    event_time: opts.eventTimeSec,
    event_id: opts.eventId,
    action_source: "app",
    user_data: userData,
    app_data: {
      advertiser_tracking_enabled: 1,
      application_tracking_enabled: 1,
      extinfo: buildAndroidExtInfo(),
    },
    custom_data: customData,
  };

  const url = `https://graph.facebook.com/v26.0/${META_DATASET_ID}/events`;
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
  if (!res.ok) throw new Error(`Meta ${res.status}: ${text}`);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth check: RevenueCat sends the secret as "Authorization: Bearer <secret>"
  if (RC_WEBHOOK_SECRET) {
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${RC_WEBHOOK_SECRET}`;
    if (auth !== expected) {
      console.warn("[rc-webhook] unauthorized — auth header mismatch");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!META_CAPI_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "META_CAPI_ACCESS_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const ev: RcEvent | undefined = payload?.event;
    if (!ev?.type) {
      return new Response(JSON.stringify({ error: "missing event.type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Never forward sandbox/test purchases to Meta.
    const env = String(ev.environment ?? "").toUpperCase();
    if (env === "SANDBOX" || ev.type === "TEST") {
      console.log(`[rc-webhook] skip sandbox/test event: ${ev.type}`);
      return new Response(JSON.stringify({ ok: true, skipped: "sandbox" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const period = String(ev.period_type ?? "").toUpperCase();
    const isTrialStart = ev.type === "INITIAL_PURCHASE" && period === "TRIAL";
    const isRevenue = !isTrialStart && REVENUE_EVENTS.has(ev.type);

    if (!isTrialStart && !isRevenue) {
      // CANCELLATION, EXPIRATION, BILLING_ISSUE, REFUND, … are acknowledged
      // without firing to Meta (Meta does not accept negative-value events).
      console.log(`[rc-webhook] ack non-conversion event: ${ev.type}`);
      return new Response(JSON.stringify({ ok: true, skipped: ev.type }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const value = isTrialStart ? 0 : Number(ev.price_in_purchased_currency ?? ev.price ?? 0);
    if (isRevenue && !(value > 0)) {
      return new Response(JSON.stringify({ ok: true, skipped: "zero-value" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = ev.currency || "USD";
    const eventTimeSec = Math.floor(
      (ev.event_timestamp_ms ?? ev.purchased_at_ms ?? Date.now()) / 1000
    );
    // Server is the single sender of StartTrial and Purchase (the app sends
    // neither), so a stable per-transaction event_id dedups RevenueCat retries.
    const txn = ev.transaction_id || ev.original_transaction_id ||
      `${ev.original_app_user_id ?? ev.app_user_id ?? "anon"}-${ev.product_id ?? "p"}-${eventTimeSec}`;
    const eventName = isTrialStart ? "StartTrial" : "Purchase";

    const result = await fireMetaEvent({
      eventName,
      value,
      currency,
      productId: ev.product_id,
      externalId: ev.original_app_user_id ?? ev.app_user_id,
      eventId: `${eventName.toLowerCase()}-${txn}`,
      ip: attr(ev, "$ip") ?? ev.ip,
      countryCode: ev.country_code,
      eventTimeSec,
      madid: attr(ev, "$gpsAdId") ?? attr(ev, "$idfa"),
      anonId: attr(ev, "$fbAnonId"),
      userAgent: attr(ev, "$userAgent"),
    });

    console.log(`[rc-webhook] forwarded ${ev.type} as ${eventName} value=${value} ${currency}`);
    return new Response(JSON.stringify({ ok: true, type: ev.type, meta: result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[rc-webhook] fatal", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
