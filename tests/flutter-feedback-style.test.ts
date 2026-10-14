import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Source contracts only; native rendering requires an approved device build.
describe("Flutter feedback and Home parity", () => {
  it("pairs snackbar backgrounds and text in both themes", () => {
    const theme = source("flutter_app/lib/core/theme/app_theme.dart");
    expect(theme.match(/snackBarTheme: _snackBarTheme\(/g)?.length).toBe(2);
    expect(theme).toContain("foreground: AppColors.darkForeground");
    expect(theme).toContain("foreground: AppColors.lightForeground");
    expect(theme).toContain("contentTextStyle: TextStyle(");
    expect(theme).toContain("closeIconColor: foreground");
    expect(source("flutter_app/lib/widgets/premium_sheet.dart")).toContain(
      "content: Text(message, style: TextStyle(color: _foreground))",
    );
  });

  it("uses the Lucide gift silhouette and web gradient", () => {
    const gift = source("flutter_app/lib/screens/today/gift_button.dart");
    expect(gift).toContain("LucideIcon('gift', size: 22, strokeWidth: 2.2");
    expect(gift).toContain("colors: [gold.withValues(alpha: 0.8), gold]");
    expect(gift).not.toContain("card_giftcard_rounded");
    const paths = source("flutter_app/lib/widgets/lucide_paths.dart");
    expect(paths).toContain("'gift':");
    expect(paths).toContain('M12 8v13');
  });

  it("hides replay in both Settings screens and retains restore", () => {
    for (const path of ["src/pages/Settings.tsx", "flutter_app/lib/screens/settings/settings_screen.dart"]) {
      const settings = source(path);
      expect(settings).not.toMatch(/settings\.redoOnboarding|_redoOnboarding|REDO_ONBOARDING_EVENT/);
      expect(settings).toContain("settings.restore");
    }
  });
});