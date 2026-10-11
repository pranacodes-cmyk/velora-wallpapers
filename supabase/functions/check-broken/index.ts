import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_BASE = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check all static wallpapers
  const { data: statics } = await supabase.from("wallpapers").select("id, title, image_url").order("sort_order");
  const { data: lives } = await supabase.from("live_wallpapers").select("id, title, video_url").order("sort_order");

  const broken: { id: string; title: string; url: string; type: string; status: number }[] = [];

  // Extract R2 key from proxy URL
  function toR2Url(proxyUrl: string): string {
    const match = proxyUrl.match(/image-proxy\/(.+)$/);
    return match ? `${R2_BASE}/${match[1]}` : proxyUrl;
  }

  // Check in batches of 20 concurrently
  async function checkBatch(items: { id: string; title: string; url: string; type: string }[]) {
    await Promise.all(items.map(async (item) => {
      try {
        const r2Url = toR2Url(item.url);
        const resp = await fetch(r2Url, { method: "HEAD" });
        if (!resp.ok) {
          broken.push({ ...item, status: resp.status });
        }
      } catch {
        broken.push({ ...item, status: 0 });
      }
    }));
  }

  const allItems = [
    ...(statics || []).map(s => ({ id: s.id, title: s.title, url: s.image_url, type: "static" })),
    ...(lives || []).map(l => ({ id: l.id, title: l.title, url: l.video_url, type: "live" })),
  ];

  for (let i = 0; i < allItems.length; i += 20) {
    await checkBatch(allItems.slice(i, i + 20));
  }

  return new Response(JSON.stringify({
    totalChecked: allItems.length,
    brokenCount: broken.length,
    broken,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
