import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Typography parity: body/UI uses the system sans stack, scripture/headline
/// serif uses Cormorant Garamond (same font the web app imports in index.css).
class AppTheme {
  const AppTheme._();

  static TextStyle serif({
    double size = 20,
    FontWeight weight = FontWeight.w600,
    Color? color,
    double height = 1.3,
    double letterSpacing = 0,
  }) => GoogleFonts.cormorantGaramond(
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: letterSpacing,
  );

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
      splashFactory: InkSparkle.splashFactory,
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.foreground,
        displayColor: AppColors.foreground,
      ),
      dividerColor: AppColors.border,
      cardTheme: CardTheme(
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
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.lightForeground,
        displayColor: AppColors.lightForeground,
      ),
      dividerColor: AppColors.lightBorder,
    );
  }
}
