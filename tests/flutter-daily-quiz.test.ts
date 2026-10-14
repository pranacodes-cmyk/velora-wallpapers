import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const source = (path: string) =>
  readFileSync(new URL(`../flutter_app/lib/${path}`, import.meta.url), "utf8");
const checklist = source("screens/today/today_checklist.dart");
const today = source("screens/today/today_screen.dart");
const route = source("screens/quiz/quiz_route.dart");
const quiz = source("screens/quiz/quiz_screen.dart");
const prayer = source("screens/devotional/devotional_screen.dart");

// Source-contract guards only: native runtime coverage requires Flutter CI.
describe("Flutter pushed daily-quiz wiring", () => {
  it("passes daily intent directly from route to the newly mounted quiz", () => {
    expect(route).toContain("child: QuizScreen(autoDaily: widget.autoDaily)");
    expect(quiz).toContain("if (widget.autoDaily) _startDailyQuiz();");
    expect(quiz).toContain("if (!mounted) return;");
    expect(quiz).toContain("if (_quiz.state != QuizState.idle) return;");
    expect(quiz).toContain("if (_quiz.dailyCompleted) return;");
  });

  it("keeps unfinished checklist quiz direct and completed quiz on the hub", () => {
    expect(today).toContain("onOpenDailyQuiz: () => openQuiz(context, autoDaily: true)");
    expect(checklist).toMatch(
      /if \(tasks\.quiz\) \{\s*widget\.onOpenQuiz\(\);\s*\} else \{\s*widget\.onOpenDailyQuiz\(\);/,
    );
  });

  it("uses the daily route for reflection Continue and pending quiz handoff", () => {
    expect(checklist).toContain("onContinueToQuiz: widget.onOpenDailyQuiz");
    expect(checklist).toContain("if (mounted) widget.onOpenDailyQuiz();");
  });

  it("retains prayer replacement without any shared start broadcast/listener", () => {
    expect(prayer).toContain("pushReplacement(quizRoute(autoDaily: true))");
    for (const file of [checklist, route, quiz, source("core/services/daily_funnel.dart")]) {
      expect(file).not.toMatch(/autoStartQuiz|requestAutoStartQuiz/);
    }
  });
});