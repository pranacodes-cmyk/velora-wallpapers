// Generates an ElevenLabs MP3 for a single daily prayer and caches it on R2.
//
// Convention: prayers/daily-prayer-{index}.mp3
// The client probes that path; the moment a file exists, the Listen button
// appears for everyone — no app rebuild required.
//
// Voice + settings match the Brian narrator used for journey narrations so
// the prayer voice feels consistent with the rest of the app.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;

// Brian — warm, fatherly. Tuned here for a seasoned-priest delivery:
// slow reverent pacing, pastoral expressiveness, no theatrical drift.
const VOICE_ID = "nPczCjzI2devNBz1zQrb";
const MODEL_ID = "eleven_multilingual_v2";
const OUTPUT_FORMAT = "mp3_44100_128";

const VOICE_SETTINGS = {
  stability: 0.42,
  similarity_boost: 0.85,
  style: 0.55,
  use_speaker_boost: true,
  speed: 0.85,
};

const MAX_CHARS = 4000;

// ── R2 / S3 v4 signing ────────────────────────────────────────────────
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(data: Uint8Array | string): Promise<string> {
  const enc = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", enc));
}
async function hmacSha256(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
async function getSigKey(key: string, date: string, region: string, service: string) {
  let k = await hmacSha256(new TextEncoder().encode("AWS4" + key), date);
  k = await hmacSha256(k, region);
  k = await hmacSha256(k, service);
  k = await hmacSha256(k, "aws4_request");
  return k;
}
async function signedRequest(method: string, url: string, body: Uint8Array | null, contentType?: string): Promise<Response> {
  const u = new URL(url);
  const region = "auto";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = body ? await sha256(body) : await sha256("");
  const headers: Record<string, string> = {
    host: u.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaderKeys = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = [method, u.pathname, u.search.slice(1), canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  const signingKey = await getSigKey(R2_SECRET_ACCESS_KEY, dateStamp, region, "s3");
  const sigKey = await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = toHex(await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(stringToSign)));
  const auth = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;
  const fetchHeaders: Record<string, string> = {
    Authorization: auth,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) fetchHeaders["content-type"] = contentType;
  return fetch(url, { method, headers: fetchHeaders, body: body ?? undefined });
}
async function r2Exists(key: string): Promise<boolean> {
  const r = await signedRequest("HEAD", `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, null);
  return r.ok;
}
async function r2Put(key: string, body: Uint8Array, ct: string): Promise<void> {
  const r = await signedRequest("PUT", `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, body, ct);
  if (!r.ok) throw new Error(`R2 upload failed: ${r.status} ${await r.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    const body = await req.json().catch(() => ({}));
    const index = Number(body?.index);
    const text = body?.text;
    const force = body?.force === true;

    if (!Number.isFinite(index) || index < 0 || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "index, text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > MAX_CHARS) {
      return new Response(JSON.stringify({ error: `text too long (${text.length} > ${MAX_CHARS})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = `prayers/daily-prayer-${index}.mp3`;
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    if (!force && (await r2Exists(key))) {
      return new Response(JSON.stringify({ url: publicUrl, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
      },
    );
    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("ElevenLabs error", ttsRes.status, errText);
      return new Response(JSON.stringify({ error: "TTS failed", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());
    await r2Put(key, audioBytes, "audio/mpeg");

    return new Response(JSON.stringify({ url: publicUrl, cached: false, bytes: audioBytes.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
