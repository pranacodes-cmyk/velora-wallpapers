import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const R2_PUBLIC = "https://pub-18077520a8e74aa2b98a5f6cbdcff2de.r2.dev";

// ── R2 signed PUT helper ──
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
  const canonicalRequest = ["PUT", u.pathname, "", canonicalHeaders, signedHeaderKeys, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "s3");
  const signature = toHex(await crypto.subtle.sign("HMAC",
    await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new TextEncoder().encode(stringToSign)));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;
  return fetch(url, {
    method: "PUT",
    headers: { "Authorization": authHeader, "content-type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate },
    body,
  });
}

async function saveManifestToR2(table: string, orderedItems: { id: string; title: string; sort_order: number }[]) {
  try {
    const endpoint = Deno.env.get("R2_ENDPOINT");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    if (!endpoint || !bucket) {
      console.log("R2 not configured, skipping manifest save");
      return;
    }
    const key = table === "wallpapers" ? "manifests/static-order.json" : "manifests/live-order.json";
    const manifest = {
      updatedAt: new Date().toISOString(),
      table,
      count: orderedItems.length,
      order: orderedItems.map((item, idx) => ({
        position: idx + 1,
        id: item.id,
        title: item.title,
        sort_order: item.sort_order,
      })),
    };
    const body = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    const putUrl = `${endpoint}/${bucket}/${key}`;
    const resp = await signedPut(putUrl, body, "application/json");
    console.log(`R2 manifest saved: ${key}, status: ${resp.status}`);
  } catch (err) {
    console.error("Failed to save R2 manifest:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const table = body.table === "static" ? "wallpapers" : "live_wallpapers";

    // Format: { rankings: [{ id, position }], table?: "live" | "static" }
    if (body.rankings && Array.isArray(body.rankings)) {
      const results = [];

      for (const r of body.rankings) {
        if (!r.id || !r.position) continue;
        const targetPos = Math.max(1, r.position); // 1-indexed

        // 1. Fetch ALL items ordered by sort_order
        const { data: allRows, error: fetchErr } = await supabaseAdmin
          .from(table)
          .select("id, title, sort_order")
          .order("sort_order", { ascending: true });

        if (fetchErr) throw fetchErr;
        if (!allRows || allRows.length === 0) continue;

        // 2. Remove the target item from the list
        const targetIndex = allRows.findIndex(row => row.id === r.id);
        if (targetIndex === -1) continue;

        const targetItem = allRows[targetIndex];
        const withoutTarget = [...allRows];
        withoutTarget.splice(targetIndex, 1);

        // 3. Insert at the desired position (1-indexed → 0-indexed)
        const insertAt = Math.min(targetPos - 1, withoutTarget.length);
        withoutTarget.splice(insertAt, 0, targetItem);

        // 4. Reassign sequential sort_orders (1000, 2000, 3000, ...)
        //    Only update rows whose sort_order actually changed
        const updates: { id: string; sort_order: number }[] = [];
        for (let i = 0; i < withoutTarget.length; i++) {
          const newOrder = (i + 1) * 1000;
          if (withoutTarget[i].sort_order !== newOrder) {
            updates.push({ id: withoutTarget[i].id, sort_order: newOrder });
          }
        }

        // 5. Batch update in groups of 50
        for (let i = 0; i < updates.length; i += 50) {
          const batch = updates.slice(i, i + 50);
          await Promise.all(
            batch.map(u =>
              supabaseAdmin.from(table).update({ sort_order: u.sort_order }).eq("id", u.id)
            )
          );
        }

        const finalOrder = (insertAt + 1) * 1000;
        results.push({ id: r.id, position: targetPos, sort_order: finalOrder, updatedRows: updates.length });
      }

      // 6. Save manifest to R2 with final order
      const { data: finalRows } = await supabaseAdmin
        .from(table)
        .select("id, title, sort_order")
        .order("sort_order", { ascending: true });

      if (finalRows) {
        await saveManifestToR2(table, finalRows);
      }

      return new Response(
        JSON.stringify({ success: true, ranked: results.length, table, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "rankings required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
