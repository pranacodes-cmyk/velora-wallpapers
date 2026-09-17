// Unified pastoral AI endpoint — handles two non-streaming modes:
//   kind: "prayer"     → generate a personal prayer
//   kind: "reflection" → respond to a journal reflection after a devotional
// JSON in, JSON out. No streaming — both UIs render in one shot.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRAYER_SYSTEM = `You write deeply personal, reverent Christian prayers in the warm voice of a trusted friend.

RULES
• Address God or Jesus directly (Heavenly Father, Lord Jesus, Father). Never use "Dear Diary" tone.
• Length: 90–140 words. 3–5 short paragraphs. Each paragraph 1–3 sentences.
• Reflect the user's situation specifically — use their words back to them.
• Quiet reverence + hope. Never sappy. Never preachy. Never start with "Dear God,".
• If you reference Scripture, weave the *idea* in — do NOT quote verses verbatim (no inventing).
• End with "In Jesus' name, Amen." on its own line.
• Plain text only. No markdown, no headers, no bullet points.
• Do not include any preamble or "Here is your prayer:" — start directly with the prayer.`;

const REFLECTION_SYSTEM = `You are a warm Christian companion responding to someone's reflection after their daily devotional / Bible reading.

RULES
• 80–130 words. Conversational, present, deeply kind.
• Reflect their feeling back first — show you heard them.
• Offer ONE short, true thought from Scripture — paraphrase the idea, do NOT invent verses or quote unless certain.
• If quoting, use this exact format on its own line:
  > "Verse text" — Reference (NIV)
• Close with a single soft sentence of blessing or invitation (no "Amen" — this is reflection, not prayer).
• Plain prose. At most one blockquote. No headers, no bullets.
• Never mention you're an AI. Never say "I'm sorry to hear that" — be present, not clinical.`;

// Per-IP rate limit (best-effort, in-memory). 10 calls per rolling 10 min.
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX = 10;
const rlBuckets = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rlBuckets.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) { rlBuckets.set(ip, arr); return true; }
  arr.push(now); rlBuckets.set(ip, arr); return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      || req.headers.get("cf-connecting-ip") || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Slow down — try again in a few minutes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind = body?.kind as string;
    const userText = (body?.text as string)?.trim();
    const context = (body?.context as string)?.trim() || ""; // e.g. day title

    if (kind !== "prayer" && kind !== "reflection") {
      return new Response(JSON.stringify({ error: "kind must be 'prayer' or 'reflection'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!userText || userText.length < 2 || userText.length > 1200) {
      return new Response(JSON.stringify({ error: "text required (2–1200 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = kind === "prayer" ? PRAYER_SYSTEM : REFLECTION_SYSTEM;
    const userMessage = kind === "prayer"
      ? `Please pray with me about this: ${userText}`
      : `${context ? `(After reading: ${context})\n\n` : ""}My reflection: ${userText}`;

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: kind === "prayer" ? 0.85 : 0.7,
        presence_penalty: 0.3,
        frequency_penalty: 0.2,
        max_tokens: 380,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests right now — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("ai-pastoral upstream error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!content) {
      return new Response(JSON.stringify({ error: "Empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-pastoral error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
