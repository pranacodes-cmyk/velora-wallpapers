import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROXY_BASE = "https://giwkqylbsotvodojgevn.supabase.co/functions/v1/image-proxy";

// Map filename to category
function getCategory(filename: string): string {
  const lower = filename.toLowerCase();

  // Superheroes
  if (lower.startsWith("sh-") || lower.startsWith("sh_") || lower.startsWith("hero_batman") || lower.startsWith("hero_doom") || lower.startsWith("hero_ironman") || lower.startsWith("hero_scarlet") || lower.startsWith("hero_spiderman") || lower.startsWith("hero_strange") || lower.startsWith("hero_thor")) return "superheroes";
  if (lower.startsWith("dr-doom") || lower.startsWith("doom_castle")) return "superheroes";

  // Samurai
  if (lower.startsWith("samurai") || lower.startsWith("sakura_temple") || lower.startsWith("sakura_walk") || lower.startsWith("sakura_koi") || lower.startsWith("katana") || lower.startsWith("crimson_mist") || lower.startsWith("crimson-blade") || lower.startsWith("crimson-field") || lower.startsWith("crimson-aura") || lower.startsWith("red_field") || lower.startsWith("dual_blade") || lower.startsWith("temple_guardian") || lower.startsWith("cyber_samurai") || lower.startsWith("autumn-cliff") || lower.startsWith("epic-ronin") || lower.startsWith("epic-samurai") || lower.startsWith("batch2_samurai")) return "samurai";

  // Warriors
  if (lower.startsWith("assassin") || lower.startsWith("fallen_knight") || lower.startsWith("knight") || lower.startsWith("shadow_assassin") || lower.startsWith("viking") || lower.startsWith("spartan") || lower.startsWith("crusader") || lower.startsWith("dark_paladin") || lower.startsWith("forest_challenger") || lower.startsWith("mech_warrior")) return "warrior";

  // Animals
  if (lower.startsWith("animal-") || lower.startsWith("lone_wolf") || lower.startsWith("white_tiger") || lower.startsWith("hero_wolf") || lower.startsWith("hero_jellyfish") || lower.startsWith("batch2_wolf") || lower.startsWith("batch2_coral")) return "animals";

  // Penguin
  if (lower.startsWith("penguin") || lower.startsWith("nihilist")) return "penguin";

  // Cosmic / Space
  if (lower.startsWith("cosmic") || lower.startsWith("black_hole") || lower.startsWith("lost_astronaut") || lower.startsWith("saturn") || lower.startsWith("solar_flare") || lower.startsWith("starfall") || lower.startsWith("wormhole") || lower.startsWith("interstellar") || lower.startsWith("hero_space") || lower.startsWith("hero_galaxy") || lower.startsWith("epic-black-hole") || lower.startsWith("epic-galaxy") || lower.startsWith("epic-golden-ring") || lower.startsWith("epic-golden-vortex") || lower.startsWith("epic-milkyway") || lower.startsWith("epic-space") || lower.startsWith("epic-storm") || lower.startsWith("batch2_galaxy") || lower.startsWith("batch2_lightning")) return "cosmic";

  // Sci-fi
  if (lower.startsWith("ai_") || lower.startsWith("blade_runner") || lower.startsWith("hologram") || lower.startsWith("matrix") || lower.startsWith("neon_rain") || lower.startsWith("tron") || lower.startsWith("hero_neon_alley") || lower.startsWith("batch2_cyberpunk") || lower.startsWith("midnight_drive")) return "sci-fi";

  // Fantasy
  if (lower.startsWith("dragon") || lower.startsWith("enchanted") || lower.startsWith("fairy") || lower.startsWith("phoenix") || lower.startsWith("golden_phoenix") || lower.startsWith("crystal") || lower.startsWith("dark_castle") || lower.startsWith("dune") || lower.startsWith("hero_dragon") || lower.startsWith("batch2_magic")) return "fantasy";

  // Nature
  if (lower.startsWith("aurora") || lower.startsWith("bio_wave") || lower.startsWith("cherry_blossom") || lower.startsWith("crimson_autumn") || lower.startsWith("deep_abyss") || lower.startsWith("firefly") || lower.startsWith("golden_orb") || lower.startsWith("monsoon") || lower.startsWith("mountain_storm") || lower.startsWith("ocean") || lower.startsWith("thunder_strike") || lower.startsWith("volcanic") || lower.startsWith("hero_aurora") || lower.startsWith("hero_koi") || lower.startsWith("hero_waterfall") || lower.startsWith("batch2_lavender") || lower.startsWith("epic-frozen") || lower.startsWith("epic-wanderer") || lower.startsWith("epic-warrior") || lower.startsWith("epic-temple") || lower.startsWith("autumn-tunnel") || lower.startsWith("rooftop_sunset") || lower.startsWith("ghibli")) return "nature";

  // Anime
  if (lower.startsWith("hero_anime") || lower.startsWith("hero_sakura")) return "anime";

  // Cars
  if (lower.startsWith("desert_mustang") || lower.startsWith("midnight_lambo") || lower.startsWith("mountain_gt") || lower.startsWith("rain_porsche") || lower.startsWith("tokyo_drift") || lower.startsWith("hero_neon_drive") || lower.startsWith("batch2_lambo")) return "cars";

  // Gaming
  if (lower.startsWith("batch2_gaming")) return "sci-fi";

  return "nature"; // fallback
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.mp4$/i, "")
    .replace(/^(batch2_|hero_|epic-|sh[-_])/, "")
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function subtitleFromCategory(category: string): string {
  const map: Record<string, string> = {
    "samurai": "Blade of honor",
    "warrior": "Strength and valor",
    "nature": "Earth's beauty",
    "cosmic": "Beyond the stars",
    "sci-fi": "Future vision",
    "fantasy": "Realm of wonder",
    "anime": "Animated dreams",
    "cars": "Speed and power",
    "superheroes": "Heroic might",
    "penguin": "Antarctic spirit",
    "animals": "Wild and free",
  };
  return map[category] || "Live wallpaper";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { files, dryRun, nukeFirst } = await req.json();

    if (!files || !Array.isArray(files)) {
      return new Response(JSON.stringify({ error: "files array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build live wallpaper records
    const records = files.map((f: { filename: string; isPremium?: boolean }, i: number) => {
      const category = getCategory(f.filename);
      const r2Key = `live/${f.filename}`;

      return {
        title: titleFromFilename(f.filename),
        subtitle: subtitleFromCategory(category),
        video_url: `${PROXY_BASE}/${r2Key}`,
        category,
        is_premium: f.isPremium || false,
        sort_order: i,
      };
    });

    if (dryRun) {
      const categoryCounts: Record<string, number> = {};
      records.forEach((r: any) => {
        categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
      });
      return new Response(JSON.stringify({
        total: records.length,
        categoryCounts,
        sample: records.slice(0, 5),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nuke existing records first
    if (nukeFirst !== false) {
      const { error: delErr } = await supabase.from("live_wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) {
        return new Response(JSON.stringify({ error: `Failed to clear DB: ${delErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert in batches of 200
    const BATCH = 200;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { data, error } = await supabase.from("live_wallpapers").insert(batch).select("id");
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || batch.length;
      }
    }

    // Verify final count
    const { count } = await supabase.from("live_wallpapers").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      success: true,
      inserted,
      total: records.length,
      dbCount: count,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
