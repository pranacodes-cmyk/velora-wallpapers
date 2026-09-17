import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const R2_BASE = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all unique filenames from wallpapers table
    const { data: wallpapers } = await supabase
      .from("wallpapers")
      .select("image_url")
      .order("image_url");

    if (!wallpapers) {
      return new Response(JSON.stringify({ error: "No wallpapers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract unique filenames
    const filenames = [...new Set(wallpapers.map((w: any) => {
      return w.image_url.replace(/.*\/static\//, "");
    }))];

    console.log(`Checking ${filenames.length} unique files against R2...`);

    // Check each file with HEAD request (fast, no body download)
    const results: { existing: string[]; missing: string[] } = {
      existing: [],
      missing: [],
    };

    // Batch check in groups of 20
    for (let i = 0; i < filenames.length; i += 20) {
      const batch = filenames.slice(i, i + 20);
      const checks = batch.map(async (filename: string) => {
        try {
          const r2Url = `${R2_BASE}/static/${filename}`;
          const resp = await fetch(r2Url, { method: "HEAD" });
          if (resp.ok) {
            results.existing.push(filename);
          } else {
            results.missing.push(filename);
          }
        } catch {
          results.missing.push(filename);
        }
      });
      await Promise.all(checks);
    }

    // Group missing by category prefix
    const missingByCategory: Record<string, string[]> = {};
    results.missing.forEach((f: string) => {
      const prefix = f.includes("/") ? f.split("/")[0] : f.replace(/-\d+\.jpg$/, "");
      if (!missingByCategory[prefix]) missingByCategory[prefix] = [];
      missingByCategory[prefix].push(f);
    });

    const existingByCategory: Record<string, number> = {};
    results.existing.forEach((f: string) => {
      const prefix = f.includes("/") ? f.split("/")[0] : f.replace(/-\d+\.jpg$/, "");
      existingByCategory[prefix] = (existingByCategory[prefix] || 0) + 1;
    });

    return new Response(JSON.stringify({
      total_in_db: filenames.length,
      existing_on_r2: results.existing.length,
      missing_from_r2: results.missing.length,
      existing_by_category: existingByCategory,
      missing_by_category: missingByCategory,
      missing_files: results.missing,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
