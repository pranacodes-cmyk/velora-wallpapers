/**
 * RevenueCat → Meta Conversions API webhook.
 *
 * RevenueCat fires this for: INITIAL_PURCHASE, RENEWAL, TRIAL_CONVERSION,
 * CANCELLATION, REFUND, NON_RENEWING_PURCHASE, EXPIRATION, BILLING_ISSUE.
 *
 * We forward the monetary events (purchase / renewal / trial conversion) to
 * Meta CAPI as a "Purchase" event, and refunds as a negative-value Purchase.
 * This captures revenue Meta would otherwise miss (renewals on month 2+,
 * post-app-close completions, etc.) and improves Value Optimization.
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
};

const REVENUE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "TRIAL_CONVERSION",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
]);
const REFUND_EVENTS = new Set(["REFUND"]);

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
}) {
  const userData: Record<string, unknown> = {};
  if (opts.ip) userData.client_ip_address = opts.ip;
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

    const isRevenue = REVENUE_EVENTS.has(ev.type);
    const isRefund = REFUND_EVENTS.has(ev.type);

    if (!isRevenue && !isRefund) {
      // Acknowledge other event types (CANCELLATION, EXPIRATION, BILLING_ISSUE…)
      // without firing to Meta. RevenueCat retries on non-2xx.
      console.log(`[rc-webhook] ack non-revenue event: ${ev.type}`);
      return new Response(JSON.stringify({ ok: true, skipped: ev.type }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const value = Number(ev.price_in_purchased_currency ?? ev.price ?? 0);
    if (!value) {
      return new Response(JSON.stringify({ ok: true, skipped: "zero-value" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = ev.currency || "USD";
    const eventTimeSec = Math.floor(
      (ev.event_timestamp_ms ?? ev.purchased_at_ms ?? Date.now()) / 1000
    );
    // Stable event_id so Meta dedups against client-side native SDK Purchase
    const eventId = ev.transaction_id || ev.original_transaction_id ||
      `${ev.original_app_user_id ?? ev.app_user_id ?? "anon"}-${ev.product_id ?? "p"}-${eventTimeSec}`;

    const result = await fireMetaEvent({
      eventName: "Purchase",
      value: isRefund ? -Math.abs(value) : value,
      currency,
      productId: ev.product_id,
      externalId: ev.original_app_user_id ?? ev.app_user_id,
      eventId: isRefund ? `refund-${eventId}` : eventId,
      ip: ev.ip,
      countryCode: ev.country_code,
      eventTimeSec,
    });

    console.log(`[rc-webhook] forwarded ${ev.type} value=${value} ${currency}`);
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
