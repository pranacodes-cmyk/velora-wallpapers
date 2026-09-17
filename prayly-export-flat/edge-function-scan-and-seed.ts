import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data)));
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

async function listR2Objects(prefix: string): Promise<string[]> {
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
    const qp: [string,string][] = [
      ["list-type", "2"],
      ["prefix", prefix],
      ["max-keys", "1000"],
    ];
    if (continuationToken) qp.push(["continuation-token", continuationToken]);
    const queryString = qp.sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

    const u = new URL(`${endpoint}/${bucket}`);
    const payloadHash = await sha256("");
    const headers: Record<string, string> = {
      "host": u.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate,
    };
    const signedHeaderKeys = Object.keys(headers).sort().join(";");
    const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
    const canonicalRequest = ["GET", `/${bucket}/`, queryString, canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
    const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
    const signature = toHex(await crypto.subtle.sign("HMAC",
      await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      new TextEncoder().encode(stringToSign)));
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

    const resp = await fetch(`${endpoint}/${bucket}/?${queryString}`, {
      method: "GET",
      headers: { "Authorization": authHeader, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate },
    });
    if (!resp.ok) { console.error("ListObjects error:", resp.status, await resp.text()); break; }
    const xml = await resp.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) allKeys.push(m[1]);
    const truncMatch = xml.match(/<IsTruncated>(\w+)<\/IsTruncated>/);
    if (!truncMatch || truncMatch[1] !== "true") break;
    const nextToken = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!nextToken) break;
    continuationToken = nextToken[1];
  }
  return allKeys;
}

function titleFromFilename(filename: string): string {
  // Remove extension, hashes, timestamps
  let t = filename.replace(/\.(jpg|jpeg|png|webp|mp4|webm)$/i, "");
  t = t.replace(/-\d{13}-\w{4}$/, ""); // remove timestamp-hash suffix
  t = t.replace(/-[a-f0-9]{8}$/, ""); // remove uuid suffix
  t = t.replace(/^(test|gen)-/, ""); // remove test/gen prefix
  t = t.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
  return t;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "scan";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "scan") {
      const staticFiles = await listR2Objects("static/");
      const liveFiles = await listR2Objects("live/");
      return new Response(JSON.stringify({ staticCount: staticFiles.length, liveCount: liveFiles.length, staticFiles, liveFiles }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "seed") {
      // 1. Get categories
      const { data: cats } = await sb.from("categories").select("id, slug").order("sort_order");
      if (!cats?.length) return new Response(JSON.stringify({ error: "No categories" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));

      // 2. List R2
      const staticFiles = (await listR2Objects("static/")).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      const liveFiles = (await listR2Objects("live/")).filter(f => /\.(mp4|webm)$/i.test(f));
      console.log(`Found ${staticFiles.length} static, ${liveFiles.length} live`);

      // 3. Clear existing
      await sb.from("wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("live_wallpapers").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      const proxyBase = `${supabaseUrl}/functions/v1/image-proxy`;

      // 4. Seed statics — use subfolder name as category slug
      // File pattern: static/{category}/{filename}
      const staticRecords = staticFiles.map((key, idx) => {
        const parts = key.replace("static/", "").split("/");
        const catSlug = parts.length > 1 ? parts[0] : "cross"; // default to cross
        const filename = parts.length > 1 ? parts.slice(1).join("/") : parts[0];
        const categoryId = catMap[catSlug] || catMap["cross"] || cats[0].id;
        return {
          title: titleFromFilename(filename),
          image_url: `${proxyBase}/${key}`,
          category_id: categoryId,
          is_premium: idx % 5 === 0,
          sort_order: idx,
        };
      });

      let staticInserted = 0;
      for (let i = 0; i < staticRecords.length; i += 100) {
        const batch = staticRecords.slice(i, i + 100);
        const { error } = await sb.from("wallpapers").insert(batch);
        if (error) console.error(`Static batch error:`, error.message);
        else staticInserted += batch.length;
      }

      // 5. Seed live wallpapers — use subfolder name as category
      const liveRecords = liveFiles.map((key, idx) => {
        const parts = key.replace("live/", "").split("/");
        const category = parts.length > 1 ? parts[0] : "cross";
        const filename = parts.length > 1 ? parts.slice(1).join("/") : parts[0];
        return {
          title: titleFromFilename(filename),
          video_url: `${proxyBase}/${key}`,
          category,
          is_premium: idx % 4 === 0,
          sort_order: idx,
        };
      });

      let liveInserted = 0;
      for (let i = 0; i < liveRecords.length; i += 100) {
        const batch = liveRecords.slice(i, i + 100);
        const { error } = await sb.from("live_wallpapers").insert(batch);
        if (error) console.error(`Live batch error:`, error.message);
        else liveInserted += batch.length;
      }

      // 6. Update category thumbnails
      for (const cat of cats) {
        const { data: firstWp } = await sb.from("wallpapers").select("image_url").eq("category_id", cat.id).order("sort_order").limit(1).maybeSingle();
        if (firstWp) await sb.from("categories").update({ thumbnail_url: firstWp.image_url }).eq("id", cat.id);
      }

      return new Response(JSON.stringify({ success: true, staticInserted, liveInserted, staticFiles: staticFiles.length, liveFiles: liveFiles.length }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Use ?action=scan or ?action=seed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
