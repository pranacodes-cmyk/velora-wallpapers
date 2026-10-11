import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// S3-compatible signing (AWS Signature V4) - reused from migrate-to-r2
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

async function signedRequest(
  method: string, url: string, body: Uint8Array | null,
  accessKey: string, secretKey: string, region: string, contentType?: string
): Promise<Response> {
  const u = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? await sha256(body) : await sha256("");
  const headers: Record<string, string> = {
    "host": u.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaderKeys = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = [method, u.pathname, u.search.slice(1), canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
  const signature = toHex(await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign)));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;
  const fetchHeaders: Record<string, string> = { "Authorization": authHeader, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) fetchHeaders["content-type"] = contentType;
  return fetch(url, { method, headers: fetchHeaders, body });
}

// Category-specific prompts for better quality
const CATEGORY_PROMPTS: Record<string, string> = {
  cars: "Ultra high resolution photograph of a {title}, cinematic automotive photography, dramatic lighting, studio quality, 4K wallpaper, dark moody background, glossy reflections, professional car photography",
  nature: "Ultra high resolution photograph of {title}, breathtaking landscape photography, golden hour lighting, vivid colors, National Geographic quality, 4K wallpaper, extremely detailed",
  flowers: "Ultra high resolution macro photograph of {title}, stunning floral photography, soft bokeh background, vivid petals, dewdrops, studio lighting, 4K phone wallpaper, extremely detailed",
  aura: "Ultra high resolution digital art of {title}, neon aura aesthetic, glowing silhouette, vibrant energy waves, dark background with luminous colors, 4K phone wallpaper, ethereal atmosphere, extremely detailed",
  samurai: "Ultra high resolution digital art of {title}, Japanese samurai warrior scene, cinematic atmosphere, dramatic lighting, cherry blossoms or rain, 4K phone wallpaper, extremely detailed, masterpiece quality",
  space: "Ultra high resolution digital art of {title}, deep space, cosmic photography, NASA-quality, dramatic nebula colors, 4K wallpaper, photorealistic, extremely detailed",
  viral: "Ultra high resolution digital art of {title}, trending viral aesthetic, cinematic lighting, dramatic atmosphere, 4K phone wallpaper, extremely detailed, epic composition",
  postapoc: "Ultra high resolution digital art of {title}, post-apocalyptic scene, dramatic atmosphere, cinematic lighting, overgrown ruins, 4K wallpaper, extremely detailed",
  motivation: "Ultra high resolution motivational wallpaper with text '{title}', bold typography, dark cinematic background, inspirational, 4K phone wallpaper",
  hero: "Ultra high resolution digital art of {title}, epic cinematic composition, dramatic lighting, 4K phone wallpaper, extremely detailed, masterpiece quality",
};

function getPrompt(filename: string, title: string): string {
  const category = filename.includes("/") ? filename.split("/")[0] : filename.replace(/-\d+\.jpg$/, "");
  const template = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.viral;
  return template.replace("{title}", title);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");

    if (!LOVABLE_API_KEY || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
      throw new Error("Missing configuration");
    }

    const body = await req.json();
    const { items, batchSize = 2 } = body;
    // items: [{ filename: "cars-15.jpg", title: "McLaren P1 Night Run" }, ...]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "items array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { filename: string; status: string; error?: string }[] = [];

    // Process in small batches to avoid timeout
    for (let i = 0; i < Math.min(items.length, batchSize); i++) {
      const item = items[i];
      const { filename, title } = item;
      
      try {
        console.log(`Generating image for: ${filename} (${title})`);
        
        // 1. Generate image via Lovable AI
        const prompt = getPrompt(filename, title);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: `Generate a stunning phone wallpaper image (portrait orientation, 9:16 aspect ratio). ${prompt}` }],
            modalities: ["image", "text"],
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          console.error(`AI error for ${filename}: ${aiResp.status} ${errText}`);
          results.push({ filename, status: "error", error: `AI ${aiResp.status}: ${errText.slice(0, 200)}` });
          continue;
        }

        const aiData = await aiResp.json();
        const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageUrl || !imageUrl.startsWith("data:image")) {
          results.push({ filename, status: "error", error: "No image in AI response" });
          continue;
        }

        // 2. Decode base64 image
        const base64Data = imageUrl.split(",")[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        console.log(`Generated ${filename}: ${bytes.length} bytes, uploading to R2...`);

        // 3. Upload to R2
        const r2Key = `static/${filename}`;
        const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`;
        const putResp = await signedRequest("PUT", putUrl, bytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", "image/jpeg");
        
        if (!putResp.ok) {
          const errText = await putResp.text();
          results.push({ filename, status: "error", error: `R2 upload failed: ${errText.slice(0, 200)}` });
          continue;
        }

        console.log(`✅ ${filename} uploaded successfully`);
        results.push({ filename, status: "ok" });
      } catch (e) {
        console.error(`Error processing ${filename}:`, e);
        results.push({ filename, status: "error", error: String(e).slice(0, 200) });
      }
    }

    const ok = results.filter(r => r.status === "ok").length;
    const errors = results.filter(r => r.status === "error").length;
    const remaining = items.slice(Math.min(items.length, batchSize));

    return new Response(JSON.stringify({
      processed: results.length,
      ok,
      errors,
      results,
      remaining: remaining.length,
      nextItems: remaining,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
