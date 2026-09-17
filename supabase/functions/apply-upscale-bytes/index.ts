// Replace a wallpaper's R2 asset with HD bytes posted directly from the client.
// Same R2 key as the existing image_url → feed position unchanged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(b: ArrayBuffer): string { return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function sha256(d: Uint8Array | string): Promise<string> {
  const enc = typeof d === "string" ? new TextEncoder().encode(d) : d;
  return toHex(await crypto.subtle.digest("SHA-256", enc));
}
async function hmac(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
async function sigKey(secret: string, date: string, region: string, service: string): Promise<Uint8Array> {
  let k = await hmac(new TextEncoder().encode("AWS4" + secret), date);
  k = await hmac(k, region); k = await hmac(k, service); k = await hmac(k, "aws4_request");
  return k;
}
async function r2Put(url: string, body: Uint8Array, ct: string, ak: string, sk: string) {
  const u = new URL(url);
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amz.slice(0, 8);
  const ph = await sha256(body);
  const headers: Record<string, string> = {
    host: u.host, "x-amz-content-sha256": ph, "x-amz-date": amz, "content-type": ct,
    "cache-control": "public, max-age=31536000, immutable",
  };
  const keys = Object.keys(headers).sort().join(";");
  const canHead = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join("");
  const canReq = ["PUT", u.pathname, u.search.slice(1), canHead, keys, ph].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${await sha256(canReq)}`;
  const signing = await sigKey(sk, date, "auto", "s3");
  const sig = toHex(await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", signing, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(sts),
  ));
  const auth = `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${keys}, Signature=${sig}`;
  return fetch(url, { method: "PUT", headers: { ...headers, Authorization: auth }, body });
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
    const R2_BUCKET = Deno.env.get("R2_BUCKET_NAME")!;
    const R2_PUBLIC = Deno.env.get("R2_PUBLIC_URL")!;
    const R2_AK = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const R2_SK = Deno.env.get("R2_SECRET_ACCESS_KEY")!;

    const { wallpaperId, hdBase64 } = await req.json();
    if (!wallpaperId || !hdBase64) {
      return new Response(JSON.stringify({ error: "wallpaperId & hdBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wp, error: wpErr } = await supabase.from("wallpapers").select("id, image_url").eq("id", wallpaperId).single();
    if (wpErr || !wp) throw new Error("wallpaper not found");

    let r2Key: string | null = null;
    if (wp.image_url.includes("/image-proxy/")) r2Key = wp.image_url.split("/image-proxy/")[1];
    else if (wp.image_url.startsWith(R2_PUBLIC + "/")) r2Key = wp.image_url.slice(R2_PUBLIC.length + 1);
    else { const m = wp.image_url.match(/r2\.dev\/(.+)$/); r2Key = m ? m[1] : null; }
    if (!r2Key) throw new Error(`cannot derive R2 key from ${wp.image_url}`);

    const bytes = b64ToBytes(hdBase64);
    const ct = "image/jpeg"; // all v2 enhanced files are JPEG

    const putUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${r2Key}`;
    const putResp = await r2Put(putUrl, bytes, ct, R2_AK, R2_SK);
    if (!putResp.ok) throw new Error(`R2 PUT ${putResp.status}: ${(await putResp.text()).slice(0, 200)}`);

    await supabase.from("wallpapers")
      .update({ upscale_status: "done", upscale_attempted_at: new Date().toISOString() })
      .eq("id", wallpaperId);

    return new Response(JSON.stringify({ ok: true, r2Key, sizeKB: Math.round(bytes.length / 1024) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
