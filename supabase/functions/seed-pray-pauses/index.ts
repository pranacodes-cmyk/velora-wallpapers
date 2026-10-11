// One-shot seeder: loads the Sacred Pause prayer library from private storage
// (seed-data/pauses-all.json) and republishes the `pray_pauses` table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const file = await admin.storage.from("seed-data").download("pauses-all.json");
    if (file.error) throw file.error;
    const packs = JSON.parse(await file.data.text()) as Record<
      string,
      { slot: number; verse: string; reference: string; prayer: string }[]
    >;

    const rows = Object.entries(packs).flatMap(([lang, list]) =>
      list.map((p) => ({
        lang,
        slot: p.slot,
        verse: p.verse,
        reference: p.reference,
        prayer: p.prayer,
        active: true,
      })),
    );

    const del = await admin.from("pray_pauses").delete().neq("slot", -1);
    if (del.error) throw del.error;
    const ins = await admin.from("pray_pauses").insert(rows);
    if (ins.error) throw ins.error;

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
