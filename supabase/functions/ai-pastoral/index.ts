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


const GUIDANCE_SYSTEM = `You are a warm, biblically grounded pastor responding to ONE prayer request a person has written in their private prayer book.

Return ONLY a JSON object (no markdown fence, no preamble) with EXACTLY these keys:
{"verse":"","reference":"","reflection":"","encouragement":"","prayer":"","step":"","christ":""}

RULES
• verse: one real, widely known Bible verse text that truly fits their situation. reference: e.g. "Psalm 34:18". Never invent a verse. If unsure of exact wording, choose a verse you know for certain.
• reflection: 35-55 words. Name what they are carrying, gently, using their own words.
• encouragement: 25-40 words. True hope, not hype. No promises God did not make.
• prayer: 45-70 words, addressed to God, first person, ending "In Jesus\' name, Amen."
• step: ONE small, concrete thing they can do today (under 20 words).
• christ: 25-40 words connecting their situation to who Jesus is / what He has done.
• Never mention you are an AI. Never be clinical or preachy. Plain text inside each field, no markdown.`;

// ---- Language ----------------------------------------------------------
// The app is localized in 8 languages. The AI MUST reply in the user's
// selected app language, in natural, native, everyday Christian speech —
// never a literal/translated feel.
const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish (Latin American, neutral)",
  pt: "Brazilian Portuguese",
  fil: "Filipino / Tagalog (natural Taglish-free conversational Filipino)",
  hi: "Hindi (Devanagari)",
  id: "Indonesian",
  fr: "French",
  de: "German",
};
const LANG_NOTES: Record<string, string> = {
  es: `Use "tú", never "usted". Say "Dios", "Señor", "Jesús". Warm Latin-American church speech, not literary Spanish.`,
  pt: `Use "você", never "tu"/"vós". Warm Brazilian evangelical speech ("Deus", "Senhor Jesus", "irmão/irmã" only if natural).`,
  fil: `Use conversational Filipino as spoken in church: "Diyos", "Panginoon", "Ama". Use "ka/mo" (not "po/kayo" formality overload). Avoid deep literary Tagalog.`,
  hi: `Use Christian Hindi, NOT shudh/kitabi Hindi. Say "परमेश्वर" or "प्रभु" (never "भगवान"), "वचन" for a Bible verse (never "कविता"/"श्लोक"), "प्रार्थना", "यीशु". Use "तुम/आप" naturally as a close friend would speak. Everyday spoken words are better than Sanskritized ones — write how Indian Christians actually talk.`,
  id: `Use "kamu" (not "Anda"). Say "Tuhan", "Allah", "Yesus", "Firman". Warm spoken Indonesian church language.`,
  fr: `Use "tu", never "vous". Say "Dieu", "Seigneur", "Jésus". Warm spoken French, not formal written French.`,
  de: `Use "du", never "Sie". Say "Gott", "Herr", "Jesus", "Wort". Warm spoken German, not stiff written German.`,
};
function langDirective(raw: unknown): string {
  const lang = typeof raw === "string" ? raw.slice(0, 5).toLowerCase() : "en";
  const code = LANG_NAMES[lang] ? lang : "en";
  if (code === "en") return "";
  return `

# LANGUAGE — ABSOLUTE
Reply ONLY in ${LANG_NAMES[code]}. Every single word, including greetings, Scripture quotes and the closing line.
${LANG_NOTES[code] ?? ""}
Write as a native speaker who grew up in that language's church — natural, warm, spoken rhythm. NEVER translate English phrasing word-for-word. If it would sound odd out loud, rewrite it.
When you quote Scripture, quote it from a widely used ${LANG_NAMES[code]} Bible translation, never your own literal rendering of English. If you are unsure of the exact wording, paraphrase the idea instead of quoting.
Even if the user writes to you in English, reply in ${LANG_NAMES[code]}.`;
}

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

const WEEKLY_SYSTEM = `You write a short, warm WEEKLY PRAYER REFLECTION for someone using a private prayer tracker.

You are given the list of what they are still praying for and what was answered this week.

RULES
• 70-110 words, plain prose, 2 short paragraphs.
• Paragraph 1: name gently what they have been carrying this week, using their own words.
• Paragraph 2: one true encouragement from Scripture (paraphrase the idea, never invent a verse), and one simple invitation for the week ahead.
• If something was answered, celebrate it plainly and thank God for it.
• Speak to them as "you". Never mention you are an AI. No markdown, no bullets, no headers, no "Amen".`;

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

    if (kind !== "prayer" && kind !== "reflection" && kind !== "guidance" && kind !== "weekly") {
      return new Response(JSON.stringify({ error: "kind must be 'prayer', 'reflection', 'guidance' or 'weekly'" }), {
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = (kind === "prayer"
      ? PRAYER_SYSTEM
      : kind === "guidance"
        ? GUIDANCE_SYSTEM
        : kind === "weekly"
          ? WEEKLY_SYSTEM
          : REFLECTION_SYSTEM) + langDirective(body?.lang);
    const userMessage = kind === "prayer"
      ? `Please pray with me about this: ${userText}`
      : kind === "weekly"
        ? `My prayer week: ${userText}`
        : kind === "guidance"
        ? `${context ? `(Category: ${context})\n` : ""}My prayer request: ${userText}`
        : `${context ? `(After reading: ${context})\n\n` : ""}My reflection: ${userText}`;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // cheapest Claude chat model — budget-friendly for customer use
        temperature: kind === "prayer" ? 0.85 : kind === "guidance" ? 0.6 : 0.7,
        max_tokens: kind === "guidance" ? 700 : 300,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      console.error("ai-pastoral upstream error:", upstream.status, t.slice(0, 400));
      if (upstream.status === 429) {
        return new Response(JSON.stringify({
          error: "Too many requests right now — try again in a moment.",
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 400 && /credit balance|insufficient/i.test(t)) {
        return new Response(JSON.stringify({ error: "AI is temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 401 || upstream.status === 402 || upstream.status === 403) {
        return new Response(JSON.stringify({ error: "AI is temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const content = (Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "").trim();
    if (!content) {
      return new Response(JSON.stringify({ error: "Empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (kind === "guidance") {
      // Parse the structured pastoral word; tolerate stray prose around the JSON.
      let parsed: Record<string, string> | null = null;
      try {
        const a = content.indexOf("{");
        const b = content.lastIndexOf("}");
        if (a >= 0 && b > a) parsed = JSON.parse(content.slice(a, b + 1));
      } catch { parsed = null; }
      if (!parsed?.verse || !parsed?.prayer) {
        return new Response(JSON.stringify({ error: "Could not shape a word right now. Please try again." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const clean = (v: unknown, max: number) =>
        typeof v === "string" ? v.trim().slice(0, max) : "";
      return new Response(JSON.stringify({
        guidance: {
          verse: clean(parsed.verse, 400),
          reference: clean(parsed.reference, 60),
          reflection: clean(parsed.reflection, 600),
          encouragement: clean(parsed.encouragement, 500),
          prayer: clean(parsed.prayer, 800),
          step: clean(parsed.step, 200),
          christ: clean(parsed.christ, 500),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
