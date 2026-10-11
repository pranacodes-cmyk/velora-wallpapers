import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Category slug → ID mapping (from DB)
const CATEGORY_MAP: Record<string, string> = {
  "viral": "89f66827-fdcf-48b3-ba5d-cc25a2334c05",
  "nature": "53f8b103-d31f-4c81-b7e1-cd5be52c2b92",
  "abstract": "e4f82dbd-f90b-4952-9647-fdbbfce207fe",
  "space": "3e27781b-3d72-4255-b7ed-406553426837",
  "minimal": "cda4d213-efb3-4535-a5c7-8100f8562337",
  "urban": "d83abc58-c8f2-4128-9c40-f325274e14a7",
  "dark-amoled": "dfcfc993-2762-4304-b573-a65c32be7b96",
  "anime": "c00541da-7b20-41fe-8eb5-4e694e1bfcb6",
  "floral": "827114c8-614f-479d-88e7-3826fa3f36d1",
  "post-apocalyptic": "b38f731b-930f-470d-bcd9-24d63b92e5ed",
  "penguin": "6a6988d9-795e-4c93-bfec-e6b8e7417ee5",
  "samurai": "b404e8d4-3b6d-481f-b81f-44db96aa525c",
  "cars": "3a70a0db-11d9-4537-9b95-0263ed085fbc",
  "motivation": "2632cd07-c06c-4bdd-8e14-a58f8632a9bc",
  "gaming": "f2834e99-e247-43da-b444-de63b8e72d9a",
  "superheroes": "c314d5d0-ec8f-425a-88da-06bb720ffc31",
  "animals": "2842a075-71ec-4453-9a6b-611679c4ad46",
  "cyberpunk": "9ea19e5e-5656-4d8a-80df-add3f84f0b3e",
  "aesthetic": "6c515fa3-8f06-4a5c-9d83-80c2ecbdb463",
  "cosmic": "3e27781b-3d72-4255-b7ed-406553426837", // map to space
};

const PROXY_BASE = "https://giwkqylbsotvodojgevn.supabase.co/functions/v1/image-proxy";

// Map filename prefix to category slug
function getCategory(filename: string): string {
  const lower = filename.toLowerCase();
  // Hero wallpapers with specific prefixes
  if (lower.startsWith("sh-") || lower.startsWith("superhero") || lower.startsWith("hero-")) return "superheroes";
  if (lower.startsWith("cap-")) return "superheroes";
  if (lower.startsWith("ironman-") || lower.startsWith("iron-")) return "superheroes";
  if (lower.startsWith("thor-")) return "superheroes";
  if (lower.startsWith("doom-")) return "superheroes";
  if (lower.startsWith("strange-")) return "superheroes";
  if (lower.startsWith("panther-")) return "superheroes";
  if (lower.startsWith("batch4-doom") || lower.startsWith("batch4-cap") || lower.startsWith("batch4-hulk") || lower.startsWith("batch4-iron") || lower.startsWith("batch4-thor") || lower.startsWith("batch4-venom") || lower.startsWith("batch4-wolverine") || lower.startsWith("batch4-scarlet") || lower.startsWith("batch4-spiderman") || lower.startsWith("batch4-batman") || lower.startsWith("batch4-panther") || lower.startsWith("batch4-strange") || lower.startsWith("batch4-thanos")) return "superheroes";
  
  if (lower.startsWith("abstract-") || lower.startsWith("liquid-") || lower.startsWith("hero-amoled-gold")) return "abstract";
  if (lower.startsWith("anime-") || lower.startsWith("batch4-anime")) return "anime";
  if (lower.startsWith("cars-") || lower.startsWith("car-") || lower.startsWith("lamborghini-") || lower.startsWith("porsche-") || lower.startsWith("batch4-ferrari") || lower.startsWith("batch4-lambo") || lower.startsWith("batch4-porsche") || lower.startsWith("hero-ferrari") || lower.startsWith("hero-lambo")) return "cars";
  if (lower.startsWith("dark-") || lower.startsWith("amoled-") || lower.startsWith("golden-dragon") || lower.startsWith("golden-kintsugi") || lower.startsWith("hero-amoled") || lower.startsWith("batch4-amoled")) return "dark-amoled";
  if (lower.startsWith("floral-") || lower.startsWith("hero-floral")) return "floral";
  if (lower.startsWith("minimal-") || lower.startsWith("golden-circle") || lower.startsWith("golden-mountain") || lower.startsWith("hero-golden")) return "minimal";
  if (lower.startsWith("motivation-") || lower.startsWith("hero-motivation")) return "motivation";
  if (lower.startsWith("nature-") || lower.startsWith("bioluminescent-") || lower.startsWith("hero-nature") || lower.startsWith("hero-ocean")) return "nature";
  if (lower.startsWith("penguin-") || lower.startsWith("hero-penguin")) return "penguin";
  if (lower.startsWith("postapoc-") || lower.startsWith("post-apoc") || lower.startsWith("hero-postapoc") || lower.startsWith("batch4-postapoc")) return "post-apocalyptic";
  if (lower.startsWith("samurai-") || lower.startsWith("cyber-samurai") || lower.startsWith("hero-samurai") || lower.startsWith("batch4-samurai") || lower.startsWith("ronin-") || lower.startsWith("crimson-") || lower.startsWith("autumn-")) return "samurai";
  if (lower.startsWith("space-") || lower.startsWith("astronaut-") || lower.startsWith("black-hole") || lower.startsWith("cosmic-") || lower.startsWith("hero-space") || lower.startsWith("batch4-astronaut") || lower.startsWith("batch4-supernova") || lower.startsWith("supernova-") || lower.startsWith("hero-astronaut")) return "space";
  if (lower.startsWith("trending-") || lower.startsWith("viral-") || lower.startsWith("hero-viral")) return "viral";
  if (lower.startsWith("urban-") || lower.startsWith("neon-rain") || lower.startsWith("tokyo-") || lower.startsWith("hero-urban")) return "urban";
  if (lower.startsWith("gaming-") || lower.startsWith("hero-gaming") || lower.startsWith("batch4-gaming")) return "gaming";
  if (lower.startsWith("cyberpunk-") || lower.startsWith("hero-cyber") || lower.startsWith("batch4-cyberpunk")) return "cyberpunk";
  if (lower.startsWith("aesthetic-") || lower.startsWith("hero-aesthetic") || lower.startsWith("lofi-")) return "aesthetic";
  if (lower.startsWith("animal-") || lower.startsWith("wolf-") || lower.startsWith("wolves-") || lower.startsWith("tiger-") || lower.startsWith("lion-") || lower.startsWith("eagle-") || lower.startsWith("whale-") || lower.startsWith("fox-") || lower.startsWith("bear-") || lower.startsWith("cat-") || lower.startsWith("cheetah-") || lower.startsWith("deer-") || lower.startsWith("dog-") || lower.startsWith("dolphin-") || lower.startsWith("elephant-") || lower.startsWith("flamingo-") || lower.startsWith("gorilla-") || lower.startsWith("horse-") || lower.startsWith("husky-") || lower.startsWith("kingfisher-") || lower.startsWith("macaw-") || lower.startsWith("owl-") || lower.startsWith("panda-") || lower.startsWith("peacock-") || lower.startsWith("puppy-") || lower.startsWith("red-panda") || lower.startsWith("shepherd-") || lower.startsWith("snow-leopard") || lower.startsWith("turtle-") || lower.startsWith("hero-lion") || lower.startsWith("hero-snow-leopard") || lower.startsWith("batch4-eagle") || lower.startsWith("batch4-lion") || lower.startsWith("batch4-wolf")) return "animals";
  if (lower.startsWith("fantasy-") || lower.startsWith("batch4-dragon") || lower.startsWith("batch4-enchanted") || lower.startsWith("batch4-steampunk") || lower.startsWith("batch4-viking") || lower.startsWith("hero-steampunk")) return "viral"; // fantasy → viral

  // Fallback
  if (lower.startsWith("gen-")) return "abstract";
  if (lower.startsWith("wall-")) return "abstract";
  
  return "viral"; // default fallback
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.jpg$/i, "")
    .replace(/^(batch4-|hero-|gen-|sh-|live-)/, "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

    // Build wallpaper records
    const records = files.map((f: { filename: string; folder: string; isPremium?: boolean }, i: number) => {
      const catSlug = getCategory(f.filename);
      const catId = CATEGORY_MAP[catSlug] || CATEGORY_MAP["viral"];
      const r2Key = `static/${f.filename}`;
      
      return {
        title: titleFromFilename(f.filename),
        image_url: `${PROXY_BASE}/${r2Key}`,
        category_id: catId,
        is_premium: f.isPremium || false,
        sort_order: i,
      };
    });

    if (dryRun) {
      const categoryCounts: Record<string, number> = {};
      records.forEach((r: any) => {
        const slug = Object.entries(CATEGORY_MAP).find(([_, id]) => id === r.category_id)?.[0] || "unknown";
        categoryCounts[slug] = (categoryCounts[slug] || 0) + 1;
      });
      return new Response(JSON.stringify({ 
        total: records.length, 
        categoryCounts,
        sample: records.slice(0, 5),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nuke existing records first to prevent duplicates
    if (nukeFirst !== false) {
      const { error: delErr } = await supabase.from("wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
      const { data, error } = await supabase.from("wallpapers").insert(batch).select("id");
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        inserted += data?.length || batch.length;
      }
    }

    // Verify final count
    const { count } = await supabase.from("wallpapers").select("*", { count: "exact", head: true });

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
