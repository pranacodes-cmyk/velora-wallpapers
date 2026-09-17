import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { items } = await req.json();
    // items: [{ cdnUrl, r2Key, dbId?, title?, category?, isInsert? }]

    const results: any[] = [];

    for (const item of items) {
      try {
        console.log(`Downloading: ${item.cdnUrl}`);
        const dlResp = await fetch(item.cdnUrl);
        if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status}`);
        
        const videoBytes = new Uint8Array(await dlResp.arrayBuffer());
        console.log(`Downloaded ${videoBytes.length} bytes, uploading to R2: ${item.r2Key}`);

        const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${item.r2Key}`;
        const putResp = await signedRequest("PUT", putUrl, videoBytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", "video/mp4");
        
        if (!putResp.ok) throw new Error(`R2 upload failed: ${await putResp.text()}`);

        const publicVideoUrl = `${R2_PUBLIC_URL}/${item.r2Key}`;
        const proxyVideoUrl = `${SUPABASE_URL}/functions/v1/image-proxy/${item.r2Key}`;

        if (item.isInsert) {
          const { error } = await supabase.from("live_wallpapers").insert({
            title: item.title,
            subtitle: item.subtitle || null,
            video_url: proxyVideoUrl,
            category: item.category || "devotional",
            is_premium: false,
            sort_order: item.sortOrder || 100,
          });
          if (error) throw error;
          console.log(`✅ Inserted new record: ${item.title}`);
        } else if (item.dbId) {
          const { error } = await supabase.from("live_wallpapers")
            .update({ video_url: proxyVideoUrl })
            .eq("id", item.dbId);
          if (error) throw error;
          console.log(`✅ Updated ${item.dbId}`);
        }

        results.push({ r2Key: item.r2Key, status: "ok", url: publicVideoUrl });
      } catch (e) {
        console.error(`Error for ${item.r2Key}:`, e);
        results.push({ r2Key: item.r2Key, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
