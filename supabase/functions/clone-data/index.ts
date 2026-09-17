import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CLONE-DATA: Imports an exported snapshot into THIS project's database.
 *
 * It rewrites all proxy URLs from the old project ID to this project's
 * Supabase URL, preserving every sort_order, thumbnail_url, and field exactly.
 *
 * Usage:
 *   POST with body: { source_url: "https://<old-project>.supabase.co/functions/v1/export-data" }
 *   OR
 *   POST with body: { snapshot: { ...exported JSON... } }
 *
 * Options:
 *   dryRun: true → just shows counts, no writes
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { source_url, snapshot: directSnapshot, dryRun } = body;

    // Step 1: Get the snapshot
    let snapshot: any;
    if (directSnapshot) {
      snapshot = directSnapshot;
    } else if (source_url) {
      const resp = await fetch(source_url, {
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        throw new Error(`Failed to fetch export: ${resp.status} ${await resp.text()}`);
      }
      snapshot = await resp.json();
    } else {
      return new Response(
        JSON.stringify({ error: "Provide either 'source_url' or 'snapshot' in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { categories, wallpapers, live_wallpapers } = snapshot;
    if (!categories || !wallpapers || !live_wallpapers) {
      return new Response(
        JSON.stringify({ error: "Invalid snapshot format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Detect old proxy base and compute new one
    const thisUrl = Deno.env.get("SUPABASE_URL")!;
    const newProxyBase = `${thisUrl}/functions/v1/image-proxy`;

    // Extract old proxy base from existing URLs
    // Pattern: https://<project-id>.supabase.co/functions/v1/image-proxy/...
    const proxyPattern = /https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/image-proxy/;
    let oldProxyBase = "";

    // Find from wallpapers
    for (const w of wallpapers) {
      const match = w.image_url?.match(proxyPattern);
      if (match) { oldProxyBase = match[0]; break; }
    }
    if (!oldProxyBase) {
      for (const lw of live_wallpapers) {
        const match = lw.video_url?.match(proxyPattern);
        if (match) { oldProxyBase = match[0]; break; }
      }
    }
    if (!oldProxyBase) {
      for (const c of categories) {
        const match = c.thumbnail_url?.match(proxyPattern);
        if (match) { oldProxyBase = match[0]; break; }
      }
    }

    // Also handle direct R2 URLs
    const r2Pattern = /https:\/\/pub-[a-z0-9]+\.r2\.dev/;

    function rewriteUrl(url: string | null): string | null {
      if (!url) return null;
      // Rewrite old proxy → new proxy
      if (oldProxyBase && url.startsWith(oldProxyBase)) {
        return url.replace(oldProxyBase, newProxyBase);
      }
      // If URL is a direct R2 URL, route through proxy
      const r2Match = url.match(r2Pattern);
      if (r2Match) {
        const path = url.replace(r2Match[0] + "/", "");
        return `${newProxyBase}/${path}`;
      }
      return url;
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        counts: {
          categories: categories.length,
          wallpapers: wallpapers.length,
          live_wallpapers: live_wallpapers.length,
        },
        oldProxyBase,
        newProxyBase,
        sampleRewrite: wallpapers[0]
          ? { before: wallpapers[0].image_url, after: rewriteUrl(wallpapers[0].image_url) }
          : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Initialize Supabase
    const supabase = createClient(thisUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const log: string[] = [];

    // Step 4: Clear existing data
    log.push("Clearing existing data...");
    await supabase.from("wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("live_wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    log.push("Cleared.");

    // Step 5: Insert categories (with NEW UUIDs since old IDs belong to old project)
    // We need to map old category IDs → new category IDs for wallpaper foreign keys
    const oldToNewCatId: Record<string, string> = {};
    const catRecords = categories.map((c: any) => ({
      name: c.name,
      slug: c.slug,
      thumbnail_url: rewriteUrl(c.thumbnail_url),
      sort_order: c.sort_order,
    }));

    const { data: insertedCats, error: catErr } = await supabase
      .from("categories")
      .insert(catRecords)
      .select("id, slug");

    if (catErr) {
      log.push(`Category error: ${catErr.message}`);
      return new Response(JSON.stringify({ error: catErr.message, log }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build slug → new ID map
    const slugToNewId: Record<string, string> = {};
    for (const c of insertedCats || []) {
      slugToNewId[c.slug] = c.id;
    }
    // Build old ID → slug map from source
    const oldIdToSlug: Record<string, string> = {};
    for (const c of categories) {
      oldIdToSlug[c.id] = c.slug;
    }
    // Build old ID → new ID
    for (const [oldId, slug] of Object.entries(oldIdToSlug)) {
      oldToNewCatId[oldId] = slugToNewId[slug] || "";
    }
    log.push(`Inserted ${insertedCats?.length} categories`);

    // Step 6: Insert wallpapers with remapped category_id
    const BATCH = 200;
    let insertedWp = 0;
    const wpRecords = wallpapers.map((w: any) => ({
      title: w.title,
      image_url: rewriteUrl(w.image_url)!,
      category_id: w.category_id ? (oldToNewCatId[w.category_id] || null) : null,
      is_premium: w.is_premium,
      sort_order: w.sort_order,
    }));

    for (let i = 0; i < wpRecords.length; i += BATCH) {
      const batch = wpRecords.slice(i, i + BATCH);
      const { data, error } = await supabase.from("wallpapers").insert(batch).select("id");
      if (error) {
        log.push(`Wallpaper batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        insertedWp += data?.length || 0;
      }
    }
    log.push(`Inserted ${insertedWp} wallpapers`);

    // Step 7: Insert live wallpapers
    let insertedLive = 0;
    const liveRecords = live_wallpapers.map((lw: any) => ({
      title: lw.title,
      subtitle: lw.subtitle,
      video_url: rewriteUrl(lw.video_url)!,
      thumbnail_url: rewriteUrl(lw.thumbnail_url),
      category: lw.category,
      is_premium: lw.is_premium,
      sort_order: lw.sort_order,
    }));

    for (let i = 0; i < liveRecords.length; i += BATCH) {
      const batch = liveRecords.slice(i, i + BATCH);
      const { data, error } = await supabase.from("live_wallpapers").insert(batch).select("id");
      if (error) {
        log.push(`Live batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        insertedLive += data?.length || 0;
      }
    }
    log.push(`Inserted ${insertedLive} live wallpapers`);

    // Final counts
    const { count: wCount } = await supabase.from("wallpapers").select("*", { count: "exact", head: true });
    const { count: lCount } = await supabase.from("live_wallpapers").select("*", { count: "exact", head: true });
    const { count: cCount } = await supabase.from("categories").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      success: true,
      counts: { categories: cCount, wallpapers: wCount, live_wallpapers: lCount },
      log,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
