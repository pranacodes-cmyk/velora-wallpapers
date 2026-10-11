/**
 * RevenueCat full audit (read-only).
 *
 * Pulls project overview metrics + walks customers seen in the last N days and
 * fetches each customer's subscriptions, then aggregates trial / paid /
 * failed outcomes by country, product and store.
 *
 * POST body: { days?: number, maxCustomers?: number }
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const RC_KEY = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
const BASE = 'https://api.revenuecat.com/v2';

async function rc(path: string) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${RC_KEY}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`RC ${res.status} ${path}: ${text.slice(0, 300)}`);
  return body as any;
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try { out.push(await fn(items[idx])); } catch { /* skip */ }
      }
    }),
  );
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (!RC_KEY) return json({ error: 'REVENUECAT_SECRET_API_KEY not configured' }, 500);

  try {
    let days = 60, maxCustomers = 4000;
    let cursor: string | null = null;
    try {
      const b = await req.json();
      if (typeof b?.days === 'number') days = b.days;
      if (typeof b?.maxCustomers === 'number') maxCustomers = b.maxCustomers;
      if (typeof b?.cursor === 'string' && b.cursor) cursor = b.cursor;
    } catch { /* defaults */ }

    const projects = await rc('/projects');
    const project = projects.items?.[0];
    if (!project) return json({ error: 'no project', projects }, 500);
    const pid = project.id;

    let overview: unknown = null;
    try { overview = await rc(`/projects/${pid}/metrics/overview`); } catch (e) { overview = String(e); }

    let pageErrorMsg: string | null = null;
    const cutoff = Date.now() - days * 86400000;

    // Walk customers
    const customers: any[] = [];
    let next: string | null = cursor ?? `/projects/${pid}/customers?limit=1000`;
    let pageErrors = 0;
    while (next && customers.length < maxCustomers) {
      let page: any;
      try {
        page = await rc(next);
      } catch (e) {
        pageErrors++;
        pageErrorMsg = String(e);
        break;
      }
      for (const c of page.items ?? []) customers.push(c);
      const np = page.next_page ? String(page.next_page) : null;
      next = np ? (np.startsWith('http') ? np : np.replace(/^\/v2/, '')) : null;
    }

    const recent = customers.filter((c) => (c.first_seen_at ?? 0) >= cutoff);

    const subs = await pool(recent, 12, async (c) => {
      const customerId = encodeURIComponent(c.id);
      const [s, p] = await Promise.all([
        rc(`/projects/${pid}/customers/${customerId}/subscriptions?limit=20`),
        rc(`/projects/${pid}/customers/${customerId}/purchases?limit=20`).catch(() => ({ items: [] })),
      ]);
      return { customer: c, items: s.items ?? [], purchases: p.items ?? [] };
    });

    const rows: any[] = [];
    const purchaseRows: any[] = [];
    for (const r of subs) {
      for (const s of r.items) {
        rows.push({
          customer_id: r.customer.id,
          country: r.customer.last_seen_country ?? r.customer.country ?? null,
          store: s.store,
          product_id: s.product_id,
          status: s.status,
          starts_at: s.starts_at,
          current_period_ends_at: s.current_period_ends_at,
          gives_access: s.gives_access,
          auto_renewal_status: s.auto_renewal_status,
          store_subscription_identifier: s.store_subscription_identifier,
          total_revenue: s.total_revenue_in_usd?.gross ?? null,
          pending_payment: s.pending_payment,
          entitlements: (s.entitlements?.items ?? []).map((e: any) => e.lookup_key),
        });
      }
      for (const p of r.purchases) {
        purchaseRows.push({
          customer_id: r.customer.id,
          country: r.customer.last_seen_country ?? r.customer.country ?? null,
          store: p.store,
          product_id: p.product_id,
          purchased_at: p.purchased_at,
          gives_access: p.gives_access,
          store_purchase_identifier: p.store_purchase_identifier,
          revenue: p.revenue_in_usd?.gross ?? p.total_revenue_in_usd?.gross ?? null,
          entitlements: (p.entitlements?.items ?? []).map((e: any) => e.lookup_key),
        });
      }
    }

    const tally = (key: string) =>
      rows.reduce((acc: Record<string, number>, r) => {
        const k = String(r[key] ?? 'unknown');
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});

    const revenue = rows.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0);
    const paid = rows.filter((r) => (Number(r.total_revenue) || 0) > 0);

    return json({
      project: { id: pid, name: project.name },
      window_days: days,
      overview,
      customers_total_scanned: customers.length,
      page_error: pageErrorMsg,
      next_cursor: next,
      customers_in_window: recent.length,
      subscriptions_in_window: rows.length,
      purchases_in_window: purchaseRows.length,
      by_status: tally('status'),
      by_country: tally('country'),
      by_product: tally('product_id'),
      gross_revenue_usd_in_window: Number(revenue.toFixed(2)),
      paid_subscriptions: paid.map((r) => ({
        country: r.country, product_id: r.product_id, status: r.status,
        revenue: r.total_revenue, starts_at: r.starts_at,
      })),
      rows,
      purchases: purchaseRows,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
