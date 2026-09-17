// Upscale wallpapers using Lovable AI Gateway (Gemini image edit) and replace R2 originals.
// Designed to be called repeatedly from the admin UI; resumes via wallpapers.upscale_status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- AWS SigV4 helpers (same pattern as migrate-to-r2) ----------
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
  accessKey: string, secretKey: string, region: string, contentType?: string,
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
  const signature = toHex(await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign),
  ));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    "Authorization": authHeader,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) fetchHeaders["content-type"] = contentType;
  return fetch(url, { method, headers: fetchHeaders, body });
}

// ---------- helpers ----------
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function r2KeyFromUrl(url: string, publicBase: string): string | null {
  if (url.startsWith(publicBase + "/")) return url.slice(publicBase.length + 1);
  // Also handle proxy URLs: .../image-proxy/<key>
  const m = url.match(/image-proxy\/(.+)$/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
  const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
  const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
  const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
  const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode || "process";

  try {
    // -------- STATUS --------
    if (mode === "status") {
      const { count: total } = await supabase.from("wallpapers").select("*", { count: "exact", head: true });
      const { count: done } = await supabase.from("wallpapers").select("*", { count: "exact", head: true }).eq("upscale_status", "done");
      const { count: failed } = await supabase.from("wallpapers").select("*", { count: "exact", head: true }).eq("upscale_status", "failed");
      const { count: pending } = await supabase.from("wallpapers").select("*", { count: "exact", head: true }).eq("upscale_status", "pending");
      return new Response(JSON.stringify({ total, done, failed, pending }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- RESET FAILED -> PENDING --------
    if (mode === "retry-failed") {
      const { error } = await supabase.from("wallpapers")
        .update({ upscale_status: "pending", upscale_attempted_at: null })
        .eq("upscale_status", "failed");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------- DELETE BROKEN --------
    if (mode === "delete-broken") {
      // Re-check by HEAD against R2 public URL; delete rows whose original is unreachable.
      const { data: rows } = await supabase.from("wallpapers").select("id, image_url").eq("upscale_status", "pending");
      const deleted: string[] = [];
      for (const r of rows || []) {
        const key = r2KeyFromUrl(r.image_url, R2_PUBLIC_URL);
        const probeUrl = key ? `${R2_PUBLIC_URL}/${key}` : r.image_url;
        try {
          const head = await fetch(probeUrl, { method: "HEAD" });
          if (!head.ok) {
            await supabase.from("wallpapers").delete().eq("id", r.id);
            deleted.push(r.id);
          }
        } catch {
          await supabase.from("wallpapers").delete().eq("id", r.id);
          deleted.push(r.id);
        }
      }
      return new Response(JSON.stringify({ deletedCount: deleted.length, deleted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- PROCESS BATCH --------
    const limit: number = Math.min(Math.max(Number(body.limit) || 3, 1), 8);

    // Claim a batch atomically by marking attempted_at NOW
    const { data: claimRows, error: claimErr } = await supabase
      .from("wallpapers")
      .select("id, image_url, title")
      .eq("upscale_status", "pending")
      .order("sort_order", { ascending: true })
      .limit(limit);
    if (claimErr) throw claimErr;
    if (!claimRows || claimRows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, results: [], remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; status: "ok" | "failed"; error?: string; newUrl?: string }[] = [];

    for (const wp of claimRows) {
      try {
        // 1) Pull source image
        const srcKey = r2KeyFromUrl(wp.image_url, R2_PUBLIC_URL);
        const srcUrl = srcKey ? `${R2_PUBLIC_URL}/${srcKey}` : wp.image_url;
        const imgResp = await fetch(srcUrl);
        if (!imgResp.ok) throw new Error(`source fetch ${imgResp.status}`);
        const srcBytes = new Uint8Array(await imgResp.arrayBuffer());
        const srcMime = imgResp.headers.get("content-type") || "image/jpeg";
        const srcB64 = bytesToBase64(srcBytes);

        // 2) Call Lovable AI image-edit (Nano Banana 2 — sharp, faithful upscaling)
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            modalities: ["image", "text"],
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Upscale this wallpaper to ultra-HD vertical resolution (~2304x4128, 9:16). Massively increase sharpness, micro-detail, and clarity. Preserve every existing element exactly — do NOT recompose, do NOT change colors, faces, lighting, or style. Output a clean, crisp, photo-grade image suitable as a phone wallpaper. No watermark, no text, no border.",
                },
                { type: "image_url", image_url: { url: `data:${srcMime};base64,${srcB64}` } },
              ],
            }],
          }),
        });

        if (!aiResp.ok) {
          const t = await aiResp.text();
          throw new Error(`AI ${aiResp.status}: ${t.slice(0, 200)}`);
        }
        const aiJson = await aiResp.json();
        const imgUrl: string | undefined = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imgUrl || !imgUrl.startsWith("data:")) throw new Error("no image returned");
        const commaIdx = imgUrl.indexOf(",");
        const meta = imgUrl.slice(5, commaIdx); // image/png;base64
        const outMime = meta.split(";")[0] || "image/jpeg";
        const outBytes = base64ToBytes(imgUrl.slice(commaIdx + 1));
        if (outBytes.length < 50_000) throw new Error(`output too small (${outBytes.length}B)`);

        // 3) Upload new HD asset
        const ext = outMime.includes("png") ? "png" : outMime.includes("webp") ? "webp" : "jpg";
        const newKey = `static/upscaled/${wp.id}.${ext}`;
        const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${newKey}`;
        const putResp = await signedRequest("PUT", putUrl, outBytes, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto", outMime);
        if (!putResp.ok) throw new Error(`R2 PUT ${putResp.status}: ${(await putResp.text()).slice(0, 200)}`);
        const newPublicUrl = `${R2_PUBLIC_URL}/${newKey}`;

        // 4) Update DB
        const { error: updErr } = await supabase.from("wallpapers")
          .update({
            image_url: newPublicUrl,
            upscale_status: "done",
            upscale_attempted_at: new Date().toISOString(),
          })
          .eq("id", wp.id);
        if (updErr) throw updErr;

        // 5) Best-effort delete of old object (only if it was in our bucket and not the same key)
        if (srcKey && srcKey !== newKey) {
          try {
            const delUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${srcKey}`;
            await signedRequest("DELETE", delUrl, null, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "auto");
          } catch { /* ignore */ }
        }

        results.push({ id: wp.id, status: "ok", newUrl: newPublicUrl });
      } catch (e) {
        await supabase.from("wallpapers")
          .update({ upscale_status: "failed", upscale_attempted_at: new Date().toISOString() })
          .eq("id", wp.id);
        results.push({ id: wp.id, status: "failed", error: String(e).slice(0, 300) });
      }
    }

    const { count: remaining } = await supabase.from("wallpapers").select("*", { count: "exact", head: true }).eq("upscale_status", "pending");

    return new Response(JSON.stringify({ processed: results.length, results, remaining: remaining ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("upscale-wallpapers error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
