import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R2_PUBLIC = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

// Build proxy base dynamically from env
function getProxyBase(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/functions/v1/image-proxy`;
}

// S3 ListObjectsV2 helpers
function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(data: Uint8Array | string): Promise<string> {
  const encoded = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", encoded));
}
async function hmacSha256(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg)));
}
async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  let k = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  k = await hmacSha256(k, region);
  k = await hmacSha256(k, service);
  k = await hmacSha256(k, "aws4_request");
  return k;
}

async function listR2Files(prefix: string): Promise<string[]> {
  const endpoint = Deno.env.get("R2_ENDPOINT")!;
  const bucket = Deno.env.get("R2_BUCKET_NAME")!;
  const accessKey = Deno.env.get("R2_ACCESS_KEY_ID")!;
  const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
  const region = "auto";
  const allKeys: string[] = [];
  let continuationToken = "";

  while (true) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);

    let queryParams = `list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
    if (continuationToken) {
      queryParams += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    }

    const u = new URL(`${endpoint}/${bucket}?${queryParams}`);
    const payloadHash = await sha256("");

    const headers: Record<string, string> = {
      "host": u.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    const signedHeaderKeys = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
    
    // Sort query params for canonical request
    const sortedQuery = queryParams.split("&").sort().join("&");
    
    const canonicalRequest = [
      "GET", `/${bucket}`, sortedQuery,
      canonicalHeaders, signedHeaderKeys, payloadHash
    ].join("\n");

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
    const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
    const signature = toHex(await crypto.subtle.sign("HMAC",
      await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      new TextEncoder().encode(stringToSign)));

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

    const resp = await fetch(`${endpoint}/${bucket}?${queryParams}`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`ListObjects failed: ${resp.status}`, errText);
      break;
    }

    const xml = await resp.text();
    
    // Parse keys from XML
    const keyMatches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const m of keyMatches) {
      allKeys.push(m[1]);
    }

    // Check for continuation
    const isTruncated = xml.includes("<IsTruncated>true</IsTruncated>");
    if (!isTruncated) break;

    const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!tokenMatch) break;
    continuationToken = tokenMatch[1];
  }

  return allKeys;
}

// Category definitions
const CATEGORIES = [
  { name: "Viral", slug: "viral", thumbnail: "static/batch4-wolf-aurora-peak.jpg", sort_order: 0 },
  { name: "Nature", slug: "nature", thumbnail: "static/nature-4.jpg", sort_order: 1 },
  { name: "Abstract", slug: "abstract", thumbnail: "static/abstract-1.jpg", sort_order: 2 },
  { name: "Space", slug: "space", thumbnail: "static/space-1.jpg", sort_order: 3 },
  { name: "Minimal", slug: "minimal", thumbnail: "static/minimal-2.jpg", sort_order: 4 },
  { name: "Urban", slug: "urban", thumbnail: "static/urban-1.jpg", sort_order: 5 },
  { name: "Dark AMOLED", slug: "dark-amoled", thumbnail: "static/dark-2.jpg", sort_order: 6 },
  { name: "Anime", slug: "anime", thumbnail: "static/anime-2.jpg", sort_order: 7 },
  { name: "Floral", slug: "floral", thumbnail: "static/floral-1.jpg", sort_order: 8 },
  { name: "Post Apocalyptic", slug: "post-apocalyptic", thumbnail: "static/postapoc-1.jpg", sort_order: 9 },
  { name: "Nihilist Penguin", slug: "penguin", thumbnail: "static/penguin-4.jpg", sort_order: 10 },
  { name: "Samurai", slug: "samurai", thumbnail: "static/samurai-1.jpg", sort_order: 11 },
  { name: "Cars", slug: "cars", thumbnail: "static/cars-1.jpg", sort_order: 12 },
  { name: "Motivation", slug: "motivation", thumbnail: "static/motivation-1.jpg", sort_order: 13 },
  { name: "Live Wallpaper", slug: "live-wallpaper", thumbnail: "static/live/live-nebula.jpg", sort_order: 14 },
  { name: "Gaming", slug: "gaming", thumbnail: "static/gaming-arena.jpg", sort_order: 15 },
  { name: "Superheroes", slug: "superheroes", thumbnail: "static/batch4-superhero-shield-storm.jpg", sort_order: 16 },
  { name: "Animals", slug: "animals", thumbnail: "static/animal-white-tiger-glow.jpg", sort_order: 17 },
  { name: "Cyberpunk", slug: "cyberpunk", thumbnail: "static/cyberpunk-bike.jpg", sort_order: 18 },
  { name: "Aesthetic", slug: "aesthetic", thumbnail: "static/aesthetic-sakura-pond.jpg", sort_order: 19 },
];

// Static wallpaper category detection
function getStaticCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.startsWith("sh-") || lower.startsWith("superhero") || lower.startsWith("hero-")) return "superheroes";
  if (lower.startsWith("cap-")) return "superheroes";
  if (lower.startsWith("ironman-") || lower.startsWith("iron-")) return "superheroes";
  if (lower.startsWith("thor-")) return "superheroes";
  if (lower.startsWith("doom-")) return "superheroes";
  if (lower.startsWith("strange-")) return "superheroes";
  if (lower.startsWith("panther-")) return "superheroes";
  if (lower.startsWith("batch4-doom") || lower.startsWith("batch4-cap") || lower.startsWith("batch4-hulk") || lower.startsWith("batch4-iron") || lower.startsWith("batch4-thor") || lower.startsWith("batch4-venom") || lower.startsWith("batch4-wolverine") || lower.startsWith("batch4-scarlet") || lower.startsWith("batch4-spiderman") || lower.startsWith("batch4-batman") || lower.startsWith("batch4-panther") || lower.startsWith("batch4-strange") || lower.startsWith("batch4-thanos")) return "superheroes";
  if (lower.startsWith("batch4-superhero")) return "superheroes";
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
  if (lower.startsWith("fantasy-") || lower.startsWith("batch4-dragon") || lower.startsWith("batch4-enchanted") || lower.startsWith("batch4-steampunk") || lower.startsWith("batch4-viking") || lower.startsWith("hero-steampunk")) return "viral";
  if (lower.startsWith("gen-")) return "abstract";
  if (lower.startsWith("wall-")) return "abstract";
  return "viral";
}

// Live wallpaper category detection
function getLiveCategory(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.startsWith("sh-") || lower.startsWith("sh_") || lower.startsWith("hero_batman") || lower.startsWith("hero_doom") || lower.startsWith("hero_ironman") || lower.startsWith("hero_scarlet") || lower.startsWith("hero_spiderman") || lower.startsWith("hero_strange") || lower.startsWith("hero_thor")) return "superheroes";
  if (lower.startsWith("dr-doom") || lower.startsWith("doom_castle")) return "superheroes";
  if (lower.startsWith("samurai") || lower.startsWith("sakura_temple") || lower.startsWith("sakura_walk") || lower.startsWith("sakura_koi") || lower.startsWith("katana") || lower.startsWith("crimson_mist") || lower.startsWith("crimson-blade") || lower.startsWith("crimson-field") || lower.startsWith("crimson-aura") || lower.startsWith("red_field") || lower.startsWith("dual_blade") || lower.startsWith("temple_guardian") || lower.startsWith("cyber_samurai") || lower.startsWith("autumn-cliff") || lower.startsWith("epic-ronin") || lower.startsWith("epic-samurai") || lower.startsWith("batch2_samurai")) return "samurai";
  if (lower.startsWith("assassin") || lower.startsWith("fallen_knight") || lower.startsWith("knight") || lower.startsWith("shadow_assassin") || lower.startsWith("viking") || lower.startsWith("spartan") || lower.startsWith("crusader") || lower.startsWith("dark_paladin") || lower.startsWith("forest_challenger") || lower.startsWith("mech_warrior")) return "warrior";
  if (lower.startsWith("animal-") || lower.startsWith("lone_wolf") || lower.startsWith("white_tiger") || lower.startsWith("hero_wolf") || lower.startsWith("hero_jellyfish") || lower.startsWith("batch2_wolf") || lower.startsWith("batch2_coral")) return "animals";
  if (lower.startsWith("penguin") || lower.startsWith("nihilist")) return "penguin";
  if (lower.startsWith("cosmic") || lower.startsWith("black_hole") || lower.startsWith("lost_astronaut") || lower.startsWith("saturn") || lower.startsWith("solar_flare") || lower.startsWith("starfall") || lower.startsWith("wormhole") || lower.startsWith("interstellar") || lower.startsWith("hero_space") || lower.startsWith("hero_galaxy") || lower.startsWith("epic-black-hole") || lower.startsWith("epic-galaxy") || lower.startsWith("epic-golden-ring") || lower.startsWith("epic-golden-vortex") || lower.startsWith("epic-milkyway") || lower.startsWith("epic-space") || lower.startsWith("epic-storm") || lower.startsWith("batch2_galaxy") || lower.startsWith("batch2_lightning")) return "cosmic";
  if (lower.startsWith("ai_") || lower.startsWith("blade_runner") || lower.startsWith("hologram") || lower.startsWith("matrix") || lower.startsWith("neon_rain") || lower.startsWith("tron") || lower.startsWith("hero_neon_alley") || lower.startsWith("batch2_cyberpunk") || lower.startsWith("midnight_drive")) return "sci-fi";
  if (lower.startsWith("dragon") || lower.startsWith("enchanted") || lower.startsWith("fairy") || lower.startsWith("phoenix") || lower.startsWith("golden_phoenix") || lower.startsWith("crystal") || lower.startsWith("dark_castle") || lower.startsWith("dune") || lower.startsWith("hero_dragon") || lower.startsWith("batch2_magic")) return "fantasy";
  if (lower.startsWith("aurora") || lower.startsWith("bio_wave") || lower.startsWith("cherry_blossom") || lower.startsWith("crimson_autumn") || lower.startsWith("crimson-autumn") || lower.startsWith("deep_abyss") || lower.startsWith("firefly") || lower.startsWith("golden_orb") || lower.startsWith("monsoon") || lower.startsWith("mountain_storm") || lower.startsWith("ocean") || lower.startsWith("thunder_strike") || lower.startsWith("volcanic") || lower.startsWith("hero_aurora") || lower.startsWith("hero_koi") || lower.startsWith("hero_waterfall") || lower.startsWith("batch2_lavender") || lower.startsWith("epic-frozen") || lower.startsWith("epic-wanderer") || lower.startsWith("epic-warrior") || lower.startsWith("epic-temple") || lower.startsWith("autumn-tunnel") || lower.startsWith("rooftop_sunset") || lower.startsWith("ghibli")) return "nature";
  if (lower.startsWith("hero_anime") || lower.startsWith("hero_sakura")) return "anime";
  if (lower.startsWith("desert_mustang") || lower.startsWith("midnight_lambo") || lower.startsWith("mountain_gt") || lower.startsWith("rain_porsche") || lower.startsWith("tokyo_drift") || lower.startsWith("hero_neon_drive") || lower.startsWith("batch2_lambo")) return "cars";
  return "nature";
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.(jpg|mp4)$/i, "")
    .replace(/^(batch4-|batch2_|hero[-_]|gen-|sh[-_]|live-|epic-)/, "")
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

    const PROXY_BASE = getProxyBase();
    const log: string[] = [];

    // Step 1: List all files from R2
    log.push("Listing R2 static files...");
    const staticKeys = await listR2Files("static/");
    log.push(`Found ${staticKeys.length} static keys`);

    log.push("Listing R2 live files...");
    const liveKeys = await listR2Files("live/");
    log.push(`Found ${liveKeys.length} live keys`);

    // Filter to actual wallpaper files
    const staticFiles = staticKeys.filter(k => k.endsWith(".jpg") && !k.includes("/live/"));
    const liveFiles = liveKeys.filter(k => k.endsWith(".mp4"));

    log.push(`Static wallpaper files: ${staticFiles.length}`);
    log.push(`Live wallpaper files: ${liveFiles.length}`);

    // Step 2: Clear existing data
    log.push("Clearing existing data...");
    await supabase.from("wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("live_wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    log.push("Cleared.");

    // Step 3: Insert categories
    const categoryRecords = CATEGORIES.map(c => ({
      name: c.name,
      slug: c.slug,
      thumbnail_url: `${PROXY_BASE}/${c.thumbnail}`,
      sort_order: c.sort_order,
    }));

    const { data: insertedCategories, error: catErr } = await supabase
      .from("categories")
      .insert(categoryRecords)
      .select("id, slug");

    if (catErr) {
      log.push(`Category insert error: ${catErr.message}`);
      return new Response(JSON.stringify({ error: catErr.message, log }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build slug→id map
    const categoryMap: Record<string, string> = {};
    for (const cat of insertedCategories || []) {
      categoryMap[cat.slug] = cat.id;
    }
    // Also map "cosmic" to space
    categoryMap["cosmic"] = categoryMap["space"] || categoryMap["viral"];
    log.push(`Inserted ${insertedCategories?.length} categories`);

    // Step 4: Insert static wallpapers
    const wallpaperRecords = staticFiles.map((key, i) => {
      const filename = key.replace("static/", "");
      const catSlug = getStaticCategory(filename);
      const catId = categoryMap[catSlug] || categoryMap["viral"];
      return {
        title: titleFromFilename(filename),
        image_url: `${PROXY_BASE}/${key}`,
        category_id: catId,
        is_premium: false,
        sort_order: i,
      };
    });

    // Insert in batches
    const BATCH = 200;
    let insertedWallpapers = 0;
    for (let i = 0; i < wallpaperRecords.length; i += BATCH) {
      const batch = wallpaperRecords.slice(i, i + BATCH);
      const { data, error } = await supabase.from("wallpapers").insert(batch).select("id");
      if (error) {
        log.push(`Wallpaper batch ${Math.floor(i/BATCH)+1} error: ${error.message}`);
      } else {
        insertedWallpapers += data?.length || 0;
      }
    }
    log.push(`Inserted ${insertedWallpapers} static wallpapers`);

    // Step 5: Insert live wallpapers
    const liveRecords = liveFiles.map((key, i) => {
      const filename = key.replace("live/", "");
      const category = getLiveCategory(filename);
      return {
        title: titleFromFilename(filename),
        subtitle: subtitleFromCategory(category),
        video_url: `${PROXY_BASE}/${key}`,
        category,
        is_premium: false,
        sort_order: i,
      };
    });

    let insertedLive = 0;
    for (let i = 0; i < liveRecords.length; i += BATCH) {
      const batch = liveRecords.slice(i, i + BATCH);
      const { data, error } = await supabase.from("live_wallpapers").insert(batch).select("id");
      if (error) {
        log.push(`Live batch ${Math.floor(i/BATCH)+1} error: ${error.message}`);
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
      counts: {
        categories: cCount,
        staticWallpapers: wCount,
        liveWallpapers: lCount,
      },
      r2Files: {
        staticFound: staticFiles.length,
        liveFound: liveFiles.length,
      },
      log,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Full seed error:", err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
