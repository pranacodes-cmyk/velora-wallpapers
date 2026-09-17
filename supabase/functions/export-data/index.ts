import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * EXPORT-DATA: Dumps the EXACT database state as JSON.
 * This preserves all manual rankings (sort_order), thumbnail_urls,
 * categories, and every field exactly as-is.
 *
 * Usage: GET/POST to this function → returns full JSON snapshot
 * Feed the output into clone-data on a new project.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch ALL categories
    const allCategories: any[] = [];
    let catPage = 0;
    while (true) {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(catPage * 1000, (catPage + 1) * 1000 - 1);
      if (error) throw new Error(`categories fetch: ${error.message}`);
      if (!data || data.length === 0) break;
      allCategories.push(...data);
      if (data.length < 1000) break;
      catPage++;
    }

    // Fetch ALL wallpapers (may exceed 1000)
    const allWallpapers: any[] = [];
    let wpPage = 0;
    while (true) {
      const { data, error } = await supabase
        .from("wallpapers")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(wpPage * 1000, (wpPage + 1) * 1000 - 1);
      if (error) throw new Error(`wallpapers fetch: ${error.message}`);
      if (!data || data.length === 0) break;
      allWallpapers.push(...data);
      if (data.length < 1000) break;
      wpPage++;
    }

    // Fetch ALL live wallpapers (may exceed 1000)
    const allLive: any[] = [];
    let livePage = 0;
    while (true) {
      const { data, error } = await supabase
        .from("live_wallpapers")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(livePage * 1000, (livePage + 1) * 1000 - 1);
      if (error) throw new Error(`live_wallpapers fetch: ${error.message}`);
      if (!data || data.length === 0) break;
      allLive.push(...data);
      if (data.length < 1000) break;
      livePage++;
    }

    const snapshot = {
      exported_at: new Date().toISOString(),
      source_project: Deno.env.get("SUPABASE_URL"),
      counts: {
        categories: allCategories.length,
        wallpapers: allWallpapers.length,
        live_wallpapers: allLive.length,
      },
      categories: allCategories,
      wallpapers: allWallpapers,
      live_wallpapers: allLive,
    };

    return new Response(JSON.stringify(snapshot), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
