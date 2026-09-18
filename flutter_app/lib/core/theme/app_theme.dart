import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography parity with the web build: Inter for UI/body text and Cormorant
/// Garamond for scripture / headline serif. Both are bundled as assets so the
/// very first frame already uses the right faces (no network font fetch).
class AppTheme {
  const AppTheme._();

  static const _bodyFamily = 'Inter';
  static const _serifFamily = 'Cormorant Garamond';
  static const _serifFallback = <String>['Georgia', 'Times New Roman', 'serif'];

  static TextStyle serif({
    double size = 20,
    FontWeight weight = FontWeight.w600,
    Color? color,
    double height = 1.3,
    double letterSpacing = 0,
  }) => TextStyle(
    fontFamily: _serifFamily,
    fontFamilyFallback: _serifFallback,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: letterSpacing,
    decoration: TextDecoration.none,
  );

  static TextTheme _cleanTextTheme(TextTheme base, Color color) {
    return base.apply(
      fontFamily: _bodyFamily,
      bodyColor: color,
      displayColor: color,
      decoration: TextDecoration.none,
    );
  }

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.dark,
        primary: AppColors.primary,
        onPrimary: AppColors.primaryForeground,
        secondary: AppColors.accent,
        onSecondary: AppColors.accentForeground,
        surface: AppColors.card,
        onSurface: AppColors.foreground,
        error: AppColors.destructive,
        outline: AppColors.border,
      ),
      splashFactory: InkRipple.splashFactory,
      textTheme: _cleanTextTheme(base.textTheme, AppColors.foreground),
      primaryTextTheme: _cleanTextTheme(
        base.primaryTextTheme,
        AppColors.foreground,
      ),
      dividerColor: AppColors.border,
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
      ),
    );
  }

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.lightBackground,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.light,
        primary: AppColors.lightPrimary,
        onPrimary: Colors.white,
        secondary: AppColors.lightAccent,
        surface: AppColors.lightCard,
        onSurface: AppColors.lightForeground,
        outline: AppColors.lightBorder,
      ),
      textTheme: _cleanTextTheme(base.textTheme, AppColors.lightForeground),
      primaryTextTheme: _cleanTextTheme(
        base.primaryTextTheme,
        AppColors.lightForeground,
      ),
      dividerColor: AppColors.lightBorder,
    );
  }
}
