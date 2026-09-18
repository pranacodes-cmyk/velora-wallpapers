import 'package:supabase_flutter/supabase_flutter.dart';

import '../env.dart';

/// Shared backend bootstrap for all Flutter screens.
///
/// Startup stays fast, while every screen that needs the backend can await the
/// same initialization instead of racing a fire-and-forget boot task.
class BackendService {
  BackendService._();

  static Future<void>? _initFuture;

  static Future<void> ensure() {
    return _initFuture ??= Supabase.initialize(
      url: Env.supabaseUrl,
      anonKey: Env.supabaseAnonKey,
    );
  }
}
