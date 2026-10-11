import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Edge function that uploads a raw ad-asset (video or image) to Cloudflare R2.
// Accepts a multipart/form-data body with a single "file" field and a "key" field.
// Uses manual AWS Signature V4 signing (no AWS SDK dependency for Deno compatibility).
//
// Used by the /test admin page (asset-bridge dev plugin streams the local file
// to the browser which forwards it here for upload). Also used by the new
// "Pending Review" admin grid for approve flow.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PREFIXES = ["live/", "static/", "pending/"];

function inferContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

// ---- AWS Signature V4 helpers (S3-compatible, same as migrate-to-r2) ----
function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: Uint8Array | string): Promise<string> {
  const encoded = typeof data === "string" ? new TextEncoder().encode(data) : data;
  // deno-lint-ignore no-explicit-any
  return toHex(await crypto.subtle.digest("SHA-256", encoded as any));
}

async function hmac(key: ArrayBuffer | Uint8Array | string, msg: string): Promise<ArrayBuffer> {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : (key instanceof Uint8Array ? key : new Uint8Array(key));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    // deno-lint-ignore no-explicit-any
    keyBytes as any,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}

async function signedPut(opts: {
  endpoint: string;
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}) {
  const region = opts.region || "auto";
  const service = "s3";
  const host = new URL(opts.endpoint).host;
  const url = `${opts.endpoint.replace(/\/$/, "")}/${opts.bucket}/${opts.key}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256(opts.body);
  const canonicalHeaders =
    `cache-control:public, max-age=31536000, immutable\n` +
    `content-type:${opts.contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    `/${opts.bucket}/${opts.key.split("/").map(encodeURIComponent).join("/")}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": opts.contentType,
      "Host": host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Authorization": authorization,
    },
    // deno-lint-ignore no-explicit-any
    body: opts.body as any,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 PUT failed [${res.status}]: ${text}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const endpoint = Deno.env.get("R2_ENDPOINT");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    const publicBase = Deno.env.get("R2_PUBLIC_URL");

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return new Response(
        JSON.stringify({ error: "R2 credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const form = await req.formData();
    const key = String(form.get("key") || "").trim();
    const file = form.get("file");

    if (!key || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return new Response(
        JSON.stringify({ error: "key must start with live/, static/, or pending/" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "file is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    await signedPut({
      endpoint,
      bucket,
      key,
      body: bytes,
      contentType: inferContentType(key),
      accessKeyId,
      secretAccessKey,
    });

    const url = publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : null;

    const seedType = String(form.get("seedType") || "").trim();
    if (seedType && url) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Database service credentials not configured");
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const title = String(form.get("title") || "").trim();
      const category = String(form.get("category") || "").trim();
      const thumbnailUrl = String(form.get("thumbnailUrl") || "").trim() || null;
      const sortOrderRaw = String(form.get("sortOrder") || "").trim();
      const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : seedType === "live" ? 70 : 0;

      if (!title || !category) {
        throw new Error("title and category are required when seeding");
      }

      if (seedType === "static") {
        const { data: categoryRow, error: categoryError } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", category)
          .maybeSingle();
        if (categoryError) throw new Error(`Category lookup failed: ${categoryError.message}`);

        const { error: insertError } = await supabase.from("wallpapers").insert({
          title,
          category_id: categoryRow?.id || null,
          image_url: url,
          is_premium: false,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        });
        if (insertError) throw new Error(`Static DB insert failed: ${insertError.message}`);
      } else if (seedType === "live") {
        const { error: insertError } = await supabase.from("live_wallpapers").insert({
          title,
          category,
          video_url: url,
          thumbnail_url: thumbnailUrl,
          is_premium: false,
          sort_order: Number.isFinite(sortOrder) ? sortOrder : 70,
        });
        if (insertError) throw new Error(`Live DB insert failed: ${insertError.message}`);
      } else {
        throw new Error("seedType must be static or live");
      }
    }

    return new Response(
      JSON.stringify({ ok: true, key, size: bytes.length, url, seeded: Boolean(seedType) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("push-ad-asset-to-r2 failed:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
