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

  // Pair surface and foreground instead of Material's inverse-surface defaults.
  static SnackBarThemeData _snackBarTheme({
    required Color background,
    required Color foreground,
    required Color accent,
    required Color border,
  }) => SnackBarThemeData(
    backgroundColor: background,
    contentTextStyle: TextStyle(
      fontFamily: _bodyFamily,
      color: foreground,
      fontSize: 13,
      fontWeight: FontWeight.w600,
      height: 1.35,
    ),
    actionTextColor: accent,
    disabledActionTextColor: foreground.withValues(alpha: 0.6),
    closeIconColor: foreground,
    behavior: SnackBarBehavior.floating,
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: border),
    ),
  );

  static ThemeData dark() {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      snackBarTheme: _snackBarTheme(
        background: AppColors.darkCard,
        foreground: AppColors.darkForeground,
        accent: AppColors.darkPrimary,
        border: AppColors.darkBorder,
      ),
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
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
        // Material 3 blends `surfaceTint` (= primary, Royal Gold) into every
        // elevated surface. On web there is no such blend, so the whole app
        // rendered with a muddy gold/mustard wash. Kill the tint entirely.
        surfaceTint: Colors.transparent,
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
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.card,
        surfaceTintColor: Colors.transparent,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalElevation: 0,
      ),
      popupMenuTheme: const PopupMenuThemeData(
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: const NavigationBarThemeData(
        surfaceTintColor: Colors.transparent,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      drawerTheme: const DrawerThemeData(surfaceTintColor: Colors.transparent),
    );
  }

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      snackBarTheme: _snackBarTheme(
        background: AppColors.lightCard,
        foreground: AppColors.lightForeground,
        accent: AppColors.lightPrimary,
        border: AppColors.lightBorder,
      ),
      scaffoldBackgroundColor: AppColors.lightBackground,
      colorScheme: base.colorScheme.copyWith(
        brightness: Brightness.light,
        primary: AppColors.lightPrimary,
        onPrimary: Colors.white,
        secondary: AppColors.lightAccent,
        surface: AppColors.lightCard,
        onSurface: AppColors.lightForeground,
        outline: AppColors.lightBorder,
        surfaceTint: Colors.transparent,
      ),
      textTheme: _cleanTextTheme(base.textTheme, AppColors.lightForeground),
      primaryTextTheme: _cleanTextTheme(
        base.primaryTextTheme,
        AppColors.lightForeground,
      ),
      dividerColor: AppColors.lightBorder,
      cardTheme: CardThemeData(
        color: AppColors.lightCard,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppColors.radius),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.lightBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.lightCard,
        surfaceTintColor: Colors.transparent,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalElevation: 0,
      ),
      popupMenuTheme: const PopupMenuThemeData(
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: const NavigationBarThemeData(
        surfaceTintColor: Colors.transparent,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      drawerTheme: const DrawerThemeData(surfaceTintColor: Colors.transparent),
    );
  }
}
