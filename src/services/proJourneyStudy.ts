import { readLocal, writeLocal } from "@/services/bibleReader";
import type { ProJourneyId } from "@/data/proJourneys";

export const STUDY_KEY = "prayly_pro_journey_study_v2";
type Entry = { read: boolean; note: string };
export function readStudy(id: ProJourneyId, day: number): Entry {
  const raw = readLocal<Record<string, Entry>>(STUDY_KEY, {})[`${id}:${day}`];
  return { read: raw?.read === true, note: typeof raw?.note === "string" ? raw.note.slice(0, 4000) : "" };
}
export function writeStudy(id: ProJourneyId, day: number, entry: Entry) {
  writeLocal(STUDY_KEY, { ...readLocal(STUDY_KEY, {}), [`${id}:${day}`]: { read: entry.read, note: entry.note.slice(0, 4000) } });
}
export function resetStudyReading(id: ProJourneyId) {
  const all = readLocal<Record<string, Entry>>(STUDY_KEY, {});
  for (const key of Object.keys(all)) if (key.startsWith(`${id}:`)) all[key] = { ...all[key], read: false };
  writeLocal(STUDY_KEY, all);
}