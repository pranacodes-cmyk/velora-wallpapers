import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import english from "../src/i18n/screens/missions/en";

const languages = ["en", "es", "pt", "fil", "hi", "id", "fr", "de"];
const placeholders = (value: string) => value.match(/\{\{\w+\}\}/g)?.sort() ?? [];

describe("Practical Journey mission localization", () => {
  for (const lang of languages) {
    it(`${lang}: all 75 missions, placeholder parity and exact Flutter copy`, async () => {
      const missions: Record<string, string> = (await import(`../src/i18n/screens/missions/${lang}.ts`)).default;
      const ui: Record<string, string> = (await import(`../src/i18n/screens/challenge/${lang}.ts`)).default;
      const enUi: Record<string, string> = (await import("../src/i18n/screens/challenge/en.ts")).default;
      const flutter = JSON.parse(readFileSync(new URL(`../flutter_app/assets/translations/${lang}.json`, import.meta.url), "utf8"));
      expect(Object.keys(missions).sort()).toEqual(Object.keys(english).sort());
      expect(Object.keys(missions)).toHaveLength(300);
      for (let day = 1; day <= 75; day++) {
        for (const field of ["title", "action", "why", "emoji"]) {
          const key = `chm.${day}.${field}`;
          expect(missions[key]?.trim()).toBeTruthy();
          expect(missions[key]).not.toBe(key);
          expect(flutter[key]).toBe(missions[key]);
        }
      }
      expect(Object.keys(ui).sort()).toEqual(Object.keys(enUi).sort());
      for (const [key, value] of Object.entries(ui)) {
        expect(placeholders(value)).toEqual(placeholders(enUi[key]));
        expect(flutter[key]).toBe(value);
      }
    });
  }

  it("keeps the saved live task ID and optional reflection in both platforms", () => {
    const web = readFileSync(new URL("../src/data/challenge75.ts", import.meta.url), "utf8");
    const flutter = readFileSync(new URL("../flutter_app/lib/core/services/challenge_data.dart", import.meta.url), "utf8");
    expect(web).toContain('REQUIRED_TASKS = ["read", "pray", "live"]');
    expect(flutter).toContain("kRequiredTasks = <String>['read', 'pray', 'live']");
    expect(web).toContain('missionWhy: t(`chm.${n}.why`)');
    expect(flutter).toContain("missionWhy: t('chm.$n.why')");
  });
});