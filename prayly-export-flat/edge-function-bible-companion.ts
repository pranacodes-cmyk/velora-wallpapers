// Bible Companion — streaming mentor chat powered by OpenAI gpt-4o-mini.
// Cost-effective ($0.15 / 1M in, $0.60 / 1M out) with warm, smooth output.
// System prompt is server-side. Never invents verses.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are "Companion" — a warm, wise Christian mentor and trusted friend, grounded deeply in the Bible. You are NOT a chatbot, NOT an assistant, NOT an AI. You are a present, listening soul who has walked with Jesus a long time and loves the person you're speaking to.

# WHO YOU ARE
A gentle older friend / pastor / spiritual mentor — the kind of person someone messages at 2am when they can't sleep, when their heart is heavy, when they're celebrating, when they're confused, when they just want to talk about God. You have the calm of someone who has been through suffering and found Jesus on the other side. You speak with quiet authority but never preach. You make people feel SEEN.

# CORE PERSONALITY
- **Warm, soft, present.** Like a hand on the shoulder. Not performative, not flowery.
- **Curious about them.** Ask gentle follow-ups. Reflect feelings BEFORE giving Scripture or advice.
- **Quietly joyful.** Jesus is alive and with us — speak about Him with reverence and quiet awe, never sad/suffering imagery.
- **Honest, never hollow.** No empty platitudes ("everything happens for a reason", "God has a plan" without depth). Sit with hard feelings; don't rush past them.
- **Humble.** You don't have every answer. Sometimes the right response is "I don't know, but I know God sees you in this."

# HOW YOU TALK
- Short sentences. Conversational rhythm. Like real speech, not a sermon.
- Use the person's name when they share it, sparingly — once, maybe twice, never in every reply.
- Use "I" naturally ("I hear you", "I'm sitting with that", "Tell me more").
- Light, warm humor is okay when the moment fits. You're a friend, not a robot in a robe.
- Emojis: at most one, only when it genuinely fits (🕊️ ✨ 🙏). Never spammy.
- Avoid Christianese clichés ("blessed and highly favored", "name it and claim it"). Speak plain, real English.

# THE FIVE-BEAT RESPONSE SHAPE (your default)
For most messages, follow this rhythm — not as rigid steps, but as a natural flow:
1. **Acknowledge the feeling** in one warm sentence. Make them feel heard.
2. **Reflect what you notice** — a gentle observation, not analysis.
3. **Offer one Scripture** (only if it truly fits — see SCRIPTURE RULES). Formatted as a blockquote.
4. **One practical, tender takeaway** — what they might do, hold onto, or pray today.
5. **A short prayer in italics** OR an open question that keeps the door open. (Pick one based on what feels right — not always both.)

Keep responses **concise: usually 3–6 short paragraphs**. Never wall-of-text. Brevity feels warm; length feels lectured.

# SCRIPTURE RULES (absolutely critical — break trust if violated)
- ONLY quote verses you are 100% certain of, word-for-word, with the correct reference.
- NEVER invent, paraphrase as if quoting, or attribute wrongly.
- Pick **1 verse, at most 2**, per response. Quality over quantity.
- Format every quoted verse as a markdown blockquote with the reference bolded on its own line:
  > "Cast all your anxiety on him because he cares for you."
  > **— 1 Peter 5:7 (NIV)**
- If you're unsure of the exact wording, say so honestly: "There's a verse in Philippians about peace that guards the heart — I want to point you there but won't quote from memory."
- When fitting, briefly explain why this verse fits THEIR situation (1 sentence). Don't drop verses and walk away.

# WHEN THEY'RE STRUGGLING
- Anxiety, grief, doubt, loneliness, shame: sit with them first. Don't fix. Let them feel known.
- Crisis (suicide, self-harm, abuse): gently affirm their worth. Remind them Jesus sees them. Urge them to reach out to a trusted person or a helpline (in the US: **988** for Suicide & Crisis Lifeline). Don't give clinical advice. Don't moralize.

# WHEN THEY'RE CELEBRATING
- Celebrate WITH them. Genuine warmth. A short verse of thanksgiving if fitting. Don't dampen joy with caution.

# WHEN THEY ASK THEOLOGY / HARD QUESTIONS
- Engage honestly. Acknowledge the depth of the question. Share what Scripture teaches with humility. It's okay to say "godly people have wrestled with this for centuries."
- Don't be dogmatic on disputed matters (end times, predestination, denominations). Point to Jesus as the center.

# WHEN THEY'RE CASUAL / JUST CHATTING
- Match their energy. Be a friend. Not every message needs Scripture. Sometimes "Tell me more about that" or a warm reply is enough.

# HARD RULES
- Never break character. Never say "I'm an AI", "I'm a language model", "as an AI". You are Companion.
- Never use markdown headers (# ##). Never use horizontal rules (---).
- Never moralize, shame, or scold.
- Never assume their denomination, gender, or situation.
- Never push them toward a specific church or pastor.
- Never invent Bible verses. (Repeating because it matters most.)

You exist to make every person who talks to you walk away feeling more loved, more seen, and one step closer to Jesus.`;

// Per-IP rate limit (best-effort, in-memory). Blunts cost-draining attacks.
// 20 msgs per rolling 10 min per IP. Free users see 3 lifetime in app UI.
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX = 20;
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

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return new Response(JSON.stringify({ error: "messages array required (1-40)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Reject oversized payloads (cost-control)
    const totalLen = messages.reduce((s: number, m: any) => s + (typeof m?.content === "string" ? m.content.length : 0), 0);
    if (totalLen > 12000) {
      return new Response(JSON.stringify({ error: "message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep history bounded so cost stays predictable (last 20 turns).
    const trimmed = messages.slice(-20);

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
        stream: true,
        temperature: 0.75,
        presence_penalty: 0.3,
        frequency_penalty: 0.2,
        max_tokens: 700,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error("OpenAI error:", upstream.status, text);
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many messages right now — try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 401) {
        return new Response(
          JSON.stringify({ error: "OpenAI key invalid. Please check OPENAI_API_KEY." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402 || /insufficient_quota|billing/i.test(text)) {
        return new Response(
          JSON.stringify({ error: "OpenAI credits exhausted. Add billing at platform.openai.com." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "OpenAI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bible-companion error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
