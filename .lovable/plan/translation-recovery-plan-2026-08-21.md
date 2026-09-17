# Translation Recovery Plan

## Goal
Replace the current patch-by-patch process with one controlled localization recovery. Hindi will be repaired first because it can be directly reviewed by the owner; other languages will be protected from blind bulk rewrites and validated with measurable sampling.

## What is actually broken
- The Hindi quiz pack is machine-translated and unreliable: roughly 335 questions / 5,131 fields, including wrong Bible names and wrong answer words.
- Hindi Journey basic cards and Journey rich-reading slides are separate layers. The rich slides contain literal English sentence structures, which previous audits missed.
- Several visible UI labels remain hardcoded in English, especially on Today and notification/wallpaper surfaces.
- Existing checks prove key presence, not meaning, grammar, theology, or natural tone.

## Phase 1 — Stop regressions
- Add a localization audit script that fails on missing keys, changed placeholders, untranslated English, malformed text, and forbidden terminology.
- Add canonical Christian/Bible terminology glossaries for each locale, beginning with Hindi Bible book/person names.
- Produce a machine-readable report by locale, domain, key, and issue type rather than claiming “100% translated.”

## Phase 2 — Repair Hindi completely
- Rewrite the entire Hindi quiz pack from the English source with the canonical glossary, preserving correct answer indexes and meaning.
- Rewrite all Hindi Journey rich-slide prose into natural, conversational Christian Hindi; keep Scripture quotations accurate and distinct from devotional commentary.
- Normalize pronouns and voice: respectful, warm spoken Hindi; no random switching between `आप`, `तुम`, and `तू` except direct Scripture quotations where intentional.
- Remove remaining hardcoded English from user-facing app screens and route it through localization keys.
- Re-audit prayers, verses, reflections, and basic Journey content for semantic drift instead of regenerating content that already reads well.

## Phase 3 — Validate before release
- Validate every quiz question: translated question, answer choices, correct answer, explanation, and reference must agree.
- Compare Journey English/Hindi pairs for preserved meaning and natural standalone Hindi.
- Test the Hindi app flows on mobile widths: Today question, Journey reading, Prayer, Verse packs, Quiz, Bible Chat, notifications, and premium surfaces.
- Do not publish an OTA until screenshots and generated audit reports pass.

## Phase 4 — Other languages
- Do not blindly retranslate all content. Run stratified semantic samples across Spanish, Portuguese, Filipino, Indonesian, French, and German.
- Fix confirmed defects only, then document intentional conventions such as French Scripture `vous` versus devotional `tu`, and Indonesian Scripture `Allah` versus narrative `Tuhan`.
- Treat automated checks as regression protection, not proof of native quality. Native-speaker review remains the final quality gate for marketing claims or full certification.

## Delivery boundary
The Hindi recovery is a substantial content rewrite, not a quick string patch. It should be completed and validated as one release candidate; no partial OTA will be sent. Other locales follow as a separate evidence-based QA pass so a Hindi fix cannot accidentally degrade them.

## Technical details
- Preserve the current `t()` / `tc()` loading architecture; the lookup pipeline is working correctly.
- Keep stable localization keys and English source IDs so saved progress, analytics, and quiz answer indexes remain compatible.
- Add repeatable scripts under `scripts/` and run them on every future localization change.
