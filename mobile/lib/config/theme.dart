import 'package:flutter/material.dart';

class AppTheme {
  static const _primaryColor = Color(0xFF6C5CE7);
  static const _secondaryColor = Color(0xFF00CEC9);
  static const _errorColor = Color(0xFFFF6B6B);
  static const _successColor = Color(0xFF00B894);
  static const _warningColor = Color(0xFFFDCB6E);

  static ThemeData get light {
    final colorScheme = ColorScheme.light(
      primary: _primaryColor,
      secondary: _secondaryColor,
      error: _errorColor,
      surface: const Color(0xFFF8F9FA),
      onPrimary: Colors.white,
      onSecondary: Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colorScheme.surface,
      textTheme: ThemeData.light().textTheme.copyWith(
        headlineLarge: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineMedium: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3),
        headlineSmall: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        titleLarge: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        titleMedium: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        titleSmall: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        bodyLarge: const TextStyle(fontSize: 16, fontWeight: FontWeight.w400),
        bodyMedium: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
        bodySmall: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400),
        labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        labelMedium: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        labelSmall: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
      ),
      cardTheme: CardTheme(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        clipBehavior: Clip.antiAlias,
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 1,
        backgroundColor: colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF2D3436),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 72,
        indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: MaterialStateProperty.resolveWith((states) {
          if (states.contains(MaterialState.selected)) {
            return const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _primaryColor);
          }
          return const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFFB2BEC3));
        }),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF1F2F6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: _primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFFB2BEC3)),
      ),
      extensions: const [
        AppColors(
          primary: _primaryColor,
          secondary: _secondaryColor,
          error: _errorColor,
          success: _successColor,
          warning: _warningColor,
        ),
      ],
    );
  }
}

class AppColors extends ThemeExtension<AppColors> {
  final Color primary;
  final Color secondary;
  final Color error;
  final Color success;
  final Color warning;

  const AppColors({
    required this.primary,
    required this.secondary,
    required this.error,
    required this.success,
    required this.warning,
  });

  @override
  AppColors copyWith({
    Color? primary,
    Color? secondary,
    Color? error,
    Color? success,
    Color? warning,
  }) {
    return AppColors(
      primary: primary ?? this.primary,
      secondary: secondary ?? this.secondary,
      error: error ?? this.error,
      success: success ?? this.success,
      warning: warning ?? this.warning,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) => this;
}
