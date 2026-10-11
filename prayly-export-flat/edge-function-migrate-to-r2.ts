import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// S3-compatible signing (AWS Signature V4)
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
  
  const canonicalRequest = [
    method, u.pathname, u.search.slice(1),
    canonicalHeaders, signedHeaderKeys, payloadHash
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
  const signature = toHex(await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign)));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    "Authorization": authHeader,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) fetchHeaders["content-type"] = contentType;

  return fetch(url, { method, headers: fetchHeaders, body });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
    const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      throw new Error("Missing R2 configuration");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { phase = "static", previewBaseUrl, chunkStart = 0, chunkSize = 30 } = body;

    const results: { file: string; status: string; r2Url?: string; error?: string }[] = [];

    async function uploadToR2(key: string, bodyData: Uint8Array, contentType: string): Promise<string> {
      const headUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
      try {
        const headResp = await signedRequest("HEAD", headUrl, null, R2_ACCESS_KEY_ID!, R2_SECRET_ACCESS_KEY!, "auto");
        if (headResp.ok) return `${R2_PUBLIC_URL}/${key}`;
      } catch { /* doesn't exist */ }

      const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
      const putResp = await signedRequest("PUT", putUrl, bodyData, R2_ACCESS_KEY_ID!, R2_SECRET_ACCESS_KEY!, "auto", contentType);
      if (!putResp.ok) {
        const errText = await putResp.text();
        throw new Error(`R2 upload failed (${putResp.status}): ${errText}`);
      }
      return `${R2_PUBLIC_URL}/${key}`;
    }

    function getContentType(fileName: string): string {
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
      if (ext === "png") return "image/png";
      if (ext === "webp") return "image/webp";
      if (ext === "webm") return "video/webm";
      if (ext === "mp4") return "video/mp4";
      return "application/octet-stream";
    }

    // NEW: phase "url-to-r2" — download from external URL and upload to R2, then update DB
    if (phase === "url-to-r2") {
      const items: { id: string; sourceUrl: string; r2Key: string }[] = body.items || [];
      if (items.length === 0) {
        return new Response(JSON.stringify({ error: "items array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const item of items) {
        try {
          console.log(`Downloading ${item.sourceUrl}`);
          const resp = await fetch(item.sourceUrl);
          if (!resp.ok) {
            results.push({ file: item.r2Key, status: "error", error: `HTTP ${resp.status}` });
            continue;
          }
          const buffer = new Uint8Array(await resp.arrayBuffer());
          
          // Validate size — truncated files are ~133KB, real ones are 4-12MB for videos
          const sizeMB = buffer.length / (1024 * 1024);
          if (item.r2Key.endsWith(".mp4") && sizeMB < 0.5) {
            results.push({ file: item.r2Key, status: "error", error: `File too small (${sizeMB.toFixed(2)}MB) - likely truncated` });
            continue;
          }

          const r2Url = await uploadToR2(item.r2Key, buffer, getContentType(item.r2Key));
          
          // Update DB record
          const { error: dbErr } = await supabase
            .from("live_wallpapers")
            .update({ video_url: r2Url })
            .eq("id", item.id);

          if (dbErr) {
            results.push({ file: item.r2Key, status: "partial", r2Url, error: `Uploaded but DB update failed: ${dbErr.message}` });
          } else {
            results.push({ file: item.r2Key, status: "ok", r2Url });
          }
        } catch (e) {
          results.push({ file: item.r2Key, status: "error", error: String(e) });
        }
      }

      const ok = results.filter(r => r.status === "ok").length;
      const errors = results.filter(r => r.status !== "ok").length;

      return new Response(JSON.stringify({
        phase, summary: { total: items.length, ok, errors }, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (phase === "static") {
      let allFiles: string[] = [];
      const dirs = ["", "cars", "motivation", "live"];
      
      for (const dir of dirs) {
        let offset = 0;
        while (true) {
          const { data: files, error } = await supabase.storage
            .from("wallpapers").list(dir, { limit: 1000, offset });
          if (error || !files || files.length === 0) break;
          const fileNames = files
            .filter(f => f.name && !f.metadata?.mimetype?.includes("folder") && f.id)
            .map(f => dir ? `${dir}/${f.name}` : f.name);
          allFiles = allFiles.concat(fileNames);
          offset += 1000;
          if (files.length < 1000) break;
        }
      }

      const chunk = allFiles.slice(chunkStart, chunkStart + chunkSize);
      console.log(`Processing chunk ${chunkStart}-${chunkStart + chunkSize} of ${allFiles.length} total files`);

      for (let i = 0; i < chunk.length; i += 5) {
        const batch = chunk.slice(i, i + 5);
        await Promise.all(batch.map(async (fileName) => {
          try {
            const { data, error } = await supabase.storage.from("wallpapers").download(fileName);
            if (error || !data) {
              results.push({ file: fileName, status: "error", error: error?.message || "No data" });
              return;
            }
            const buffer = new Uint8Array(await data.arrayBuffer());
            const r2Key = `static/${fileName}`;
            const r2Url = await uploadToR2(r2Key, buffer, getContentType(fileName));
            results.push({ file: fileName, status: "ok", r2Url });
          } catch (e) {
            results.push({ file: fileName, status: "error", error: String(e) });
          }
        }));
      }

      const ok = results.filter(r => r.status === "ok").length;
      const errors = results.filter(r => r.status === "error").length;
      const hasMore = chunkStart + chunkSize < allFiles.length;

      return new Response(JSON.stringify({
        phase, summary: { total: allFiles.length, processed: chunk.length, ok, errors },
        hasMore, nextChunkStart: chunkStart + chunkSize, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (phase === "live") {
      if (!previewBaseUrl) throw new Error("previewBaseUrl required for live phase");

      const liveFiles: string[] = body.files || [];
      if (liveFiles.length === 0) {
        return new Response(JSON.stringify({ error: "files array required for live phase" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chunk = liveFiles.slice(chunkStart, chunkStart + chunkSize);
      console.log(`Processing live chunk ${chunkStart}-${chunkStart + chunkSize} of ${liveFiles.length}`);

      for (let i = 0; i < chunk.length; i += 3) {
        const batch = chunk.slice(i, i + 3);
        await Promise.all(batch.map(async (fileName) => {
          try {
            const resp = await fetch(`${previewBaseUrl}/live-wallpapers/${fileName}`);
            if (!resp.ok) {
              results.push({ file: fileName, status: "error", error: `HTTP ${resp.status}` });
              return;
            }
            const buffer = new Uint8Array(await resp.arrayBuffer());
            const r2Key = `live/${fileName}`;
            const r2Url = await uploadToR2(r2Key, buffer, getContentType(fileName));
            results.push({ file: fileName, status: "ok", r2Url });
          } catch (e) {
            results.push({ file: fileName, status: "error", error: String(e) });
          }
        }));
      }

      const ok = results.filter(r => r.status === "ok").length;
      const errors = results.filter(r => r.status === "error").length;
      const hasMore = chunkStart + chunkSize < liveFiles.length;

      return new Response(JSON.stringify({
        phase, summary: { total: liveFiles.length, processed: chunk.length, ok, errors },
        hasMore, nextChunkStart: chunkStart + chunkSize, results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid phase" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
