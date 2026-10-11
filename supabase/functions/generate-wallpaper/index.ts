import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// S3 V4 signing
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
    "host": u.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate,
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
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { prompt, title, category_slug, type, filename } = body;
    // type: "static" or "live" (for now we only generate static images)

    if (!prompt || !title || !category_slug || !filename) {
      return new Response(JSON.stringify({ error: "prompt, title, category_slug, filename required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating wallpaper: ${title} (${category_slug}) -> ${filename}`);

    // 1. Generate image via Lovable AI
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`AI error: ${aiResp.status} ${errText}`);
      return new Response(JSON.stringify({ error: `AI generation failed: ${aiResp.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const imageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl || !imageUrl.startsWith("data:image")) {
      return new Response(JSON.stringify({ error: "No image generated by AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Decode base64
    const base64Data = imageUrl.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let j = 0; j < binaryString.length; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }

    console.log(`Generated image: ${bytes.length} bytes, uploading to R2...`);

    // 3. Upload to R2
    const r2Key = `static/${filename}`;
    const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`;
    const putResp = await signedRequest("PUT", putUrl, bytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", "image/png");

    if (!putResp.ok) {
      const errText = await putResp.text();
      return new Response(JSON.stringify({ error: `R2 upload failed: ${errText.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const publicUrl = `${R2_PUBLIC_URL}/static/${filename}`;
    console.log(`✅ Uploaded to: ${publicUrl}`);

    // 4. Seed into DB
    const getNextSortOrder = async (table: "wallpapers" | "live_wallpapers") => {
      const { data, error } = await supabase
        .from(table)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(`Failed to read sort order: ${error.message}`);
      return typeof data?.sort_order === "number" ? data.sort_order + 1 : 1;
    };

    const { data: catData } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category_slug)
      .maybeSingle();

    if (type === "live") {
      const { error: dbErr } = await supabase.from("live_wallpapers").insert({
        title,
        video_url: publicUrl,
        thumbnail_url: publicUrl,
        category: category_slug,
        is_premium: false,
        sort_order: await getNextSortOrder("live_wallpapers"),
      });
      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);
    } else {
      const { error: dbErr } = await supabase.from("wallpapers").insert({
        title,
        image_url: publicUrl,
        category_id: catData?.id || null,
        is_premium: false,
        sort_order: await getNextSortOrder("wallpapers"),
      });
      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      url: publicUrl,
      title,
      category_slug,
      type: type || "static",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
