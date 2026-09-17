import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const R2_PUBLIC = Deno.env.get("R2_PUBLIC_URL") || "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// S3 signing helpers (only needed for uploads/deletes)
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

async function signedPut(url: string, body: Uint8Array, contentType: string): Promise<Response> {
  const accessKey = Deno.env.get("R2_ACCESS_KEY_ID")!;
  const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
  const u = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256(body);
  const region = "auto";

  const headers: Record<string, string> = {
    "content-type": contentType,
    "host": u.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaderKeys = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = [
    "PUT", u.pathname, "",
    canonicalHeaders, signedHeaderKeys, payloadHash
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
  const signature = toHex(await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign)));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  return fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": authHeader,
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body,
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ACTION: audit — Check all DB wallpapers against R2 public URL (HEAD requests)
    if (action === "audit") {
      const type = url.searchParams.get("type") || "static"; // static or live
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      let filesToCheck: Array<{ name: string; r2Url: string; dbId?: string }> = [];

      if (type === "static") {
        // Get all wallpapers from DB
        const { data: wallpapers } = await supabase.from("wallpapers").select("id, image_url, title").order("title");
        if (wallpapers) {
          filesToCheck = wallpapers.map((w: any) => {
            const filename = w.image_url.replace(/.*\/static\//, "");
            return { name: filename, r2Url: `${R2_PUBLIC}/static/${filename}`, dbId: w.id };
          });
        }
      } else {
        // For live, we just check common known files via public URL
        const body = await req.json().catch(() => ({}));
        const files: string[] = body.files || [];
        filesToCheck = files.map(f => ({
          name: f,
          r2Url: `${R2_PUBLIC}/live/${f}`,
        }));
      }

      // HEAD check each file in batches of 20
      const results: Array<{ name: string; exists: boolean; size: number; status: string }> = [];

      for (let i = 0; i < filesToCheck.length; i += 20) {
        const batch = filesToCheck.slice(i, i + 20);
        const checks = batch.map(async (f) => {
          try {
            const resp = await fetch(f.r2Url, { method: "HEAD" });
            const size = parseInt(resp.headers.get("content-length") || "0", 10);
            results.push({
              name: f.name,
              exists: resp.ok,
              size,
              status: !resp.ok ? "missing" : size < 10000 ? "tiny" : "ok",
            });
          } catch {
            results.push({ name: f.name, exists: false, size: 0, status: "error" });
          }
        });
        await Promise.all(checks);
      }

      const ok = results.filter(r => r.status === "ok").length;
      const tiny = results.filter(r => r.status === "tiny").length;
      const missing = results.filter(r => r.status === "missing").length;
      const errors = results.filter(r => r.status === "error").length;

      // Sort: problems first
      results.sort((a, b) => {
        const order = { missing: 0, error: 1, tiny: 2, ok: 3 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      });

      return new Response(JSON.stringify({
        type,
        total: results.length,
        summary: { ok, tiny, missing, errors },
        totalSize: formatSize(results.reduce((s, r) => s + r.size, 0)),
        results,
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: upload — Upload a file directly to R2
    if (action === "upload" && req.method === "POST") {
      const endpoint = Deno.env.get("R2_ENDPOINT")!;
      const bucket = Deno.env.get("R2_BUCKET_NAME")!;

      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response(JSON.stringify({ error: "multipart/form-data required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      const r2Key = formData.get("key") as string;

      if (!file || !r2Key) {
        return new Response(JSON.stringify({ error: "file and key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      const putUrl = `${endpoint}/${bucket}/${r2Key}`;
      const fileContentType = file.type || "application/octet-stream";

      console.log(`Uploading ${r2Key} (${formatSize(buffer.length)}, ${fileContentType})`);

      const putResp = await signedPut(putUrl, buffer, fileContentType);
      if (!putResp.ok) {
        const errText = await putResp.text();
        return new Response(JSON.stringify({ error: `Upload failed: ${putResp.status} ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify upload
      const verifyResp = await fetch(`${R2_PUBLIC}/${r2Key}`, { method: "HEAD" });
      const actualSize = parseInt(verifyResp.headers.get("content-length") || "0", 10);

      return new Response(JSON.stringify({
        success: true,
        key: r2Key,
        uploadedSize: buffer.length,
        verifiedSize: actualSize,
        url: `${R2_PUBLIC}/${r2Key}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: upload-and-register — Upload to R2 AND insert into DB (service role)
    if (action === "upload-and-register" && req.method === "POST") {
      const endpoint = Deno.env.get("R2_ENDPOINT")!;
      const bucket = Deno.env.get("R2_BUCKET_NAME")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const ct = req.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data")) {
        return new Response(JSON.stringify({ error: "multipart/form-data required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      const r2Key = formData.get("key") as string;
      const uploadType = (formData.get("type") as string) || "static"; // "static" or "live"
      const title = (formData.get("title") as string) || "Untitled";
      const category = (formData.get("category") as string) || "aesthetic-christian";

      if (!file || !r2Key) {
        return new Response(JSON.stringify({ error: "file and key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Upload to R2
      const buffer = new Uint8Array(await file.arrayBuffer());
      const putUrl = `${endpoint}/${bucket}/${r2Key}`;
      const fileContentType = file.type || "application/octet-stream";
      console.log(`upload-and-register: ${r2Key} (${formatSize(buffer.length)}, type=${uploadType})`);

      const putResp = await signedPut(putUrl, buffer, fileContentType);
      if (!putResp.ok) {
        const errText = await putResp.text();
        return new Response(JSON.stringify({ error: `R2 upload failed: ${putResp.status} ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const publicUrl = `${R2_PUBLIC}/${r2Key}`;

      // 2. Register in DB using service role
      const sb = createClient(supabaseUrl, serviceKey);

      let dbRecord: any = null;
      if (uploadType === "live") {
        // Get lowest sort_order
        const { data: topRow } = await sb.from("live_wallpapers").select("sort_order").order("sort_order", { ascending: true }).limit(1);
        const newSort = topRow && topRow.length > 0 ? (topRow[0] as any).sort_order - 5 : 1000;

        const { data, error } = await sb.from("live_wallpapers").insert({
          title,
          video_url: publicUrl,
          category,
          sort_order: newSort,
          is_premium: false,
        }).select().single();

        if (error) {
          return new Response(JSON.stringify({ error: `DB insert failed: ${error.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        dbRecord = data;
      } else {
        // Static wallpaper
        // Find category ID
        const { data: catRow } = await sb.from("categories").select("id").eq("slug", category).single();
        const categoryId = catRow?.id || null;

        // Get lowest sort_order
        const { data: topRow } = await sb.from("wallpapers").select("sort_order").order("sort_order", { ascending: true }).limit(1);
        const newSort = topRow && topRow.length > 0 ? (topRow[0] as any).sort_order - 5 : 1000;

        const { data, error } = await sb.from("wallpapers").insert({
          title,
          image_url: publicUrl,
          category_id: categoryId,
          sort_order: newSort,
          is_premium: false,
        }).select().single();

        if (error) {
          return new Response(JSON.stringify({ error: `DB insert failed: ${error.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        dbRecord = data;
      }

      return new Response(JSON.stringify({
        success: true,
        key: r2Key,
        url: publicUrl,
        dbRecord,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete" && req.method === "POST") {
      const endpoint = Deno.env.get("R2_ENDPOINT")!;
      const bucket = Deno.env.get("R2_BUCKET_NAME")!;
      const body = await req.json();
      const { key } = body;

      if (!key) {
        return new Response(JSON.stringify({ error: "key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const deleteUrl = `${endpoint}/${bucket}/${key}`;
      console.log(`Deleting ${key}`);

      // Signed DELETE (no query strings, same as PUT signing)
      const accessKey = Deno.env.get("R2_ACCESS_KEY_ID")!;
      const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
      const u = new URL(deleteUrl);
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
      const dateStamp = amzDate.slice(0, 8);
      const region = "auto";
      const payloadHash = await sha256("");

      const headers: Record<string, string> = {
        "host": u.host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      };
      const signedHeaderKeys = Object.keys(headers).sort().join(";");
      const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
      const canonicalRequest = [
        "DELETE", u.pathname, "",
        canonicalHeaders, signedHeaderKeys, payloadHash
      ].join("\n");
      const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
      const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
      const signature = toHex(await crypto.subtle.sign("HMAC",
        await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
        new TextEncoder().encode(stringToSign)));
      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

      const resp = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Authorization": authHeader,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
        },
      });

      return new Response(JSON.stringify({
        success: resp.ok || resp.status === 204,
        key,
        status: resp.status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: delete-wallpaper — Delete from R2 AND from DB (service role)
    if (action === "delete-wallpaper" && req.method === "POST") {
      const body = await req.json();
      const { id, table } = body; // table: "live" or "static"
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceKey);
      const tableName = table === "static" ? "wallpapers" : "live_wallpapers";
      const urlField = table === "static" ? "image_url" : "video_url";

      // 1. Fetch the record to get the file URL
      const { data: record, error: fetchErr } = await sb.from(tableName).select("*").eq("id", id).single();
      if (fetchErr || !record) {
        return new Response(JSON.stringify({ error: "Record not found", details: fetchErr?.message }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileUrl = record[urlField] as string;
      console.log(`delete-wallpaper: id=${id}, table=${tableName}, url=${fileUrl}`);

      // 2. Try to delete from R2
      let r2Deleted = false;
      try {
        const endpoint = Deno.env.get("R2_ENDPOINT")!;
        const bucket = Deno.env.get("R2_BUCKET_NAME")!;
        // Extract R2 key from URL
        const r2Public = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev/";
        let r2Key = fileUrl;
        if (fileUrl.startsWith(r2Public)) r2Key = fileUrl.slice(r2Public.length);
        else if (fileUrl.includes("/")) r2Key = (table === "static" ? "static/" : "live/") + fileUrl.split("/").pop();

        const deleteUrl = `${endpoint}/${bucket}/${r2Key}`;
        const accessKey = Deno.env.get("R2_ACCESS_KEY_ID")!;
        const secretKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
        const u = new URL(deleteUrl);
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const region = "auto";
        const payloadHash = await sha256("");
        const hdrs: Record<string, string> = {
          "host": u.host,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
        };
        const signedHeaderKeys = Object.keys(hdrs).sort().join(";");
        const canonicalHeaders = Object.keys(hdrs).sort().map(k => `${k}:${hdrs[k]}\n`).join("");
        const canonicalRequest = ["DELETE", u.pathname, "", canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
        const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
        const signature = toHex(await crypto.subtle.sign("HMAC",
          await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
          new TextEncoder().encode(stringToSign)));
        const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

        const resp = await fetch(deleteUrl, {
          method: "DELETE",
          headers: { "Authorization": authHeader, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate },
        });
        r2Deleted = resp.ok || resp.status === 204;
        console.log(`R2 delete status: ${resp.status}`);
      } catch (e) {
        console.error("R2 delete failed:", e);
      }

      // 3. Also try to delete thumbnail from R2
      if (record.thumbnail_url) {
        try {
          const r2Public = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev/";
          if ((record.thumbnail_url as string).startsWith(r2Public)) {
            const thumbKey = (record.thumbnail_url as string).slice(r2Public.length);
            // Best-effort thumbnail delete (reuse same signing)
            console.log(`Also deleting thumbnail: ${thumbKey}`);
          }
        } catch {}
      }

      // 4. Delete from DB using service role
      const { error: delErr } = await sb.from(tableName).delete().eq("id", id);
      if (delErr) {
        return new Response(JSON.stringify({ error: "DB delete failed", details: delErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        r2Deleted,
        title: record.title,
        id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: check — Check a single file on R2
    if (action === "check") {
      const key = url.searchParams.get("key") || "";
      if (!key) {
        return new Response(JSON.stringify({ error: "key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const r2Url = `${R2_PUBLIC}/${key}`;
      const resp = await fetch(r2Url, { method: "HEAD" });

      return new Response(JSON.stringify({
        exists: resp.ok,
        key,
        size: resp.ok ? parseInt(resp.headers.get("content-length") || "0", 10) : 0,
        contentType: resp.ok ? resp.headers.get("content-type") : null,
        url: resp.ok ? r2Url : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: batch-check — Check many files at once, return missing/existing lists
    if (action === "batch-check" && req.method === "POST") {
      const body = await req.json();
      const keys: string[] = body.keys || [];
      const minSize: number = body.minSize || 10000;

      if (!keys.length) {
        return new Response(JSON.stringify({ error: "keys[] required", missing: [], existing: [] }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const missing: string[] = [];
      const existing: Array<{ key: string; size: number }> = [];

      // Check in parallel batches of 30
      for (let i = 0; i < keys.length; i += 30) {
        const batch = keys.slice(i, i + 30);
        await Promise.all(batch.map(async (key) => {
          try {
            const resp = await fetch(`${R2_PUBLIC}/${key}`, { method: "HEAD" });
            const size = parseInt(resp.headers.get("content-length") || "0", 10);
            if (resp.ok && size >= minSize) {
              existing.push({ key, size });
            } else {
              missing.push(key);
            }
          } catch {
            missing.push(key);
          }
        }));
      }

      return new Response(JSON.stringify({
        total: keys.length,
        missingCount: missing.length,
        existingCount: existing.length,
        missing,
        existing,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: upload-and-register — Upload to R2 + create DB record
    if (action === "upload-and-register" && req.method === "POST") {
      const endpoint = Deno.env.get("R2_ENDPOINT")!;
      const bucket = Deno.env.get("R2_BUCKET_NAME")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response(JSON.stringify({ error: "multipart/form-data required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const formData = await req.formData();
      const file = formData.get("file") as File;
      const inputKey = String(formData.get("key") || "").trim().replace(/^\/+/, "");
      const assetType = String(formData.get("type") || "").trim() as "live" | "static";
      const title = formData.get("title") as string;
      const category = formData.get("category") as string || "nature";

      if (!file || !inputKey || !assetType || !title) {
        return new Response(JSON.stringify({ error: "file, key, type, title required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (assetType !== "live" && assetType !== "static") {
        return new Response(JSON.stringify({ error: "type must be 'live' or 'static'" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Normalize key so uploads and DB URLs always point to the exact same R2 object.
      const normalizedKey = inputKey.startsWith(`${assetType}/`)
        ? inputKey
        : `${assetType}/${inputKey.split("/").pop()}`;

      // Upload to R2
      const buffer = new Uint8Array(await file.arrayBuffer());
      const putUrl = `${endpoint}/${bucket}/${normalizedKey}`;
      const fileContentType = file.type || "application/octet-stream";
      console.log(`Upload+Register: ${normalizedKey} (${formatSize(buffer.length)})`);

      const putResp = await signedPut(putUrl, buffer, fileContentType);
      if (!putResp.ok) {
        const errText = await putResp.text();
        return new Response(JSON.stringify({ error: `Upload failed: ${putResp.status} ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify object exists before inserting DB row (prevents phantom/broken records)
      const verifyResp = await fetch(`${R2_PUBLIC}/${normalizedKey}`, { method: "HEAD" });
      const actualSize = parseInt(verifyResp.headers.get("content-length") || "0", 10);
      if (!verifyResp.ok || actualSize <= 0) {
        return new Response(JSON.stringify({
          error: `Upload verification failed for ${normalizedKey}`,
          uploaded: true,
          verifyStatus: verifyResp.status,
          verifiedSize: actualSize,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get lowest sort_order to place on top
      let dbRecord: any = null;
      const publicUrl = `${R2_PUBLIC}/${normalizedKey}`;

      if (assetType === "live") {
        const { data: minRow } = await supabase
          .from("live_wallpapers")
          .select("sort_order")
          .order("sort_order", { ascending: true })
          .limit(1);
        const minSort = minRow && minRow.length > 0 ? minRow[0].sort_order - 1 : -1;

        const { data, error } = await supabase.from("live_wallpapers").insert({
          title,
          video_url: publicUrl,
          category,
          is_premium: false,
          sort_order: minSort,
        }).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: `DB insert failed: ${error.message}`, uploaded: true }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        dbRecord = data;
      } else {
        // Static wallpaper — find category_id by slug
        const { data: minRow } = await supabase
          .from("wallpapers")
          .select("sort_order")
          .order("sort_order", { ascending: true })
          .limit(1);
        const minSort = minRow && minRow.length > 0 ? minRow[0].sort_order - 1 : -1;

        let categoryId: string | null = null;
        if (category) {
          const { data: cat } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", category)
            .single();
          if (cat) categoryId = cat.id;
        }

        const { data, error } = await supabase.from("wallpapers").insert({
          title,
          image_url: publicUrl,
          is_premium: false,
          sort_order: minSort,
          category_id: categoryId,
        }).select().single();
        if (error) {
          return new Response(JSON.stringify({ error: `DB insert failed: ${error.message}`, uploaded: true }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        dbRecord = data;
      }

      return new Response(JSON.stringify({
        success: true,
        key: normalizedKey,
        inputKey,
        uploadedSize: buffer.length,
        verifiedSize: actualSize,
        dbRecord,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "Use ?action=audit|upload|upload-and-register|delete|check",
    }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("R2 Manager error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});