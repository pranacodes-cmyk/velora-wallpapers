// Content localization helpers (Bible text, verse references, reflections…).
// The English source of truth stays in src/data/*. Translated packs live in
// src/i18n/content/<domain>/<lang>.ts and load lazily with the language.
//
// Key shape:
//   v.<Reference>      → translated verse text        (domain: verses)
//   r.<Reference>      → translated reference label   (domain: verses)
//   rf.<Reference>.m   → reflection "meaning"         (domain: reflections)
//   rf.<Reference>.a   → reflection "apply"           (domain: reflections)

import { tc } from "./index";
import type { QuizQuestion } from "@/data/quizQuestions";
import type { Journey, JourneyDay } from "@/data/journeys";

export interface VerseLike { text: string; reference: string; refKey?: string }

/** Localized reference label ("Jeremiah 29:11" → "Jeremías 29:11"). */
export function localizeRef(reference: string): string {
  return tc(`r.${reference}`) ?? reference;
}

/** Localized verse text, falling back to the English original. */
export function localizeVerseText(verse: VerseLike): string {
  return tc(`v.${verse.refKey ?? verse.reference}`) ?? verse.text;
}

/**
 * Localized copy of a verse object. `refKey` always keeps the original English
 * reference so downstream lookups (reflections, analytics) stay stable.
 */
export function localizeVerse<T extends VerseLike>(verse: T): T {
  const key = verse.refKey ?? verse.reference;
  const text = tc(`v.${key}`) ?? verse.text;
  const reference = localizeRef(key);
  if (text === verse.text && reference === verse.reference && verse.refKey) return verse;
  return { ...verse, text, reference, refKey: key };
}


/** Localized reflection fields for a reference. */
export function localizeReflection(
  reference: string,
  reflection: { meaning: string; apply: string },
): { meaning: string; apply: string } {
  return {
    meaning: tc(`rf.${reference}.m`) ?? reflection.meaning,
    apply: tc(`rf.${reference}.a`) ?? reflection.apply,
  };
}

export function localizeQuizQuestion(question: QuizQuestion): QuizQuestion {
  const base = `q.${question.id}`;
  return {
    ...question,
    category: tc(`${base}.category`) ?? question.category,
    question: tc(`${base}.question`) ?? question.question,
    reference: tc(`${base}.reference`) ?? question.reference,
    explanation: tc(`${base}.explanation`) ?? question.explanation,
    options: question.options.map((option, index) => tc(`${base}.o${index}`) ?? option),
    correctWord: question.correctWord
      ? tc(`${base}.correctWord`) ?? question.correctWord
      : undefined,
  };
}

export function localizeJourneyDay(journeyId: string, day: JourneyDay): JourneyDay {
  const base = `j.${journeyId}.d${day.day}`;
  return {
    ...day,
    title: tc(`${base}.title`) ?? day.title,
    opening: tc(`${base}.opening`) ?? day.opening,
    verse: tc(`${base}.verse`) ?? day.verse,
    reference: tc(`${base}.reference`) ?? day.reference,
    explanation: tc(`${base}.explanation`) ?? day.explanation,
    prayer: tc(`${base}.prayer`) ?? day.prayer,
  };
}

export function localizeJourney(journey: Journey): Journey {
  const base = `j.${journey.id}`;
  return {
    ...journey,
    title: tc(`${base}.title`) ?? journey.title,
    subtitle: tc(`${base}.subtitle`) ?? journey.subtitle,
    description: tc(`${base}.description`) ?? journey.description,
    days: journey.days.map((day) => localizeJourneyDay(journey.id, day)),
  };
}
