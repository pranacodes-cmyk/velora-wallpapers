import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// S3 V4 signing helpers
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
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { image_url, media_url, thumbnail_url, title, category_slug, filename, type } = body;
    const isLive = type === "live";
    const sourceUrl = isLive ? media_url : image_url;

    if (!sourceUrl || !title || !category_slug || !filename) {
      return new Response(JSON.stringify({ error: "source URL, title, category_slug, filename required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assetResp = await fetch(sourceUrl);
    if (!assetResp.ok) throw new Error(`Failed to fetch source asset: ${assetResp.status}`);
    const bytes = new Uint8Array(await assetResp.arrayBuffer());
    const contentType = assetResp.headers.get("content-type") || (isLive ? "video/mp4" : "image/png");

    console.log(`Uploading ${title}: ${bytes.length} bytes to R2...`);

    const folder = isLive ? "live" : "static";
    const r2Key = `${folder}/${filename}`;
    const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`;
    const putResp = await signedRequest("PUT", putUrl, bytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", contentType);

    if (!putResp.ok) {
      const errText = await putResp.text();
      return new Response(JSON.stringify({ error: `R2 upload failed: ${errText.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use proxy URL so feed tiles can fetch with CORS
    const proxyBase = `${SUPABASE_URL}/functions/v1/image-proxy`;
    const proxyUrl = `${proxyBase}/${folder}/${filename}`;
    // Also keep the raw R2 URL for reference
    const rawUrl = `${R2_PUBLIC_URL}/${folder}/${filename}`;

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

    if (isLive) {
      // For live wallpapers, store the video via proxy and thumbnail via proxy too
      const thumbProxyUrl = thumbnail_url
        ? `${proxyBase}/static/${filename.replace(/\.mp4$/, '.png')}`
        : null;
      const { error: dbErr } = await supabase.from("live_wallpapers").insert({
        title,
        video_url: proxyUrl,
        thumbnail_url: thumbProxyUrl,
        category: category_slug,
        is_premium: false,
        sort_order: await getNextSortOrder("live_wallpapers"),
      });
      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);
    } else {
      const { error: dbErr } = await supabase.from("wallpapers").insert({
        title,
        image_url: proxyUrl,
        category_id: catData?.id || null,
        is_premium: false,
        sort_order: await getNextSortOrder("wallpapers"),
      });
      if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);
    }

    return new Response(JSON.stringify({ ok: true, url: proxyUrl, rawUrl, title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
