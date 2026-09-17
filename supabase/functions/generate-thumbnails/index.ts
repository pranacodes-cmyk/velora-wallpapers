import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── S3 V4 signing helpers ──
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
    const body = await req.json().catch(() => ({}));
    const { action = "upload" } = body;

    if (action === "upload") {
      // Client sends base64 data + wallpaper ID
      // type: "preview" stores as WebM video clip in previews/ folder
      // type: "sprite" stores in sprites/ folder
      // type: "thumbnail" stores in thumbnails/ folder
      const { id, imageData, type = "thumbnail" } = body;
      if (!id || !imageData) {
        return new Response(JSON.stringify({ error: "id and imageData required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Decode base64 to bytes
      const raw = atob(imageData);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      // Determine R2 key and content type
      let r2Key: string;
      let contentType: string;
      if (type === "preview") {
        r2Key = `previews/${id}.webm`;
        contentType = "video/webm";
      } else if (type === "sprite") {
        r2Key = `sprites/${id}.jpg`;
        contentType = "image/jpeg";
      } else {
        r2Key = `thumbnails/${id}.jpg`;
        contentType = "image/jpeg";
      }

      const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${r2Key}`;
      const putResp = await signedRequest("PUT", putUrl, bytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", contentType);
      
      if (!putResp.ok) {
        const errText = await putResp.text();
        throw new Error(`R2 upload failed: ${putResp.status} ${errText}`);
      }

      const resultUrl = `${R2_PUBLIC_URL}/${r2Key}`;

      // Update DB
      const { error: dbErr } = await supabase
        .from("live_wallpapers")
        .update({ thumbnail_url: resultUrl })
        .eq("id", id);

      if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`);

      return new Response(JSON.stringify({ ok: true, url: resultUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const mode = body.mode || "sprite_only";
      
      let query = supabase
        .from("live_wallpapers")
        .select("id, title, video_url, thumbnail_url");

      if (mode === "upgrade") {
        query = query.or("thumbnail_url.is.null,thumbnail_url.not.like.%previews/%");
      } else {
        query = query.is("thumbnail_url", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ missing: data?.length ?? 0, wallpapers: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Thumbnail error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
