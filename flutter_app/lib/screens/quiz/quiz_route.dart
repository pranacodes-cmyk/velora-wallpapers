import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/app_providers.dart';
import 'quiz_screen.dart';

/// Bible Quiz as a pushed page (the bottom-nav slot now belongs to Journey).
/// Web mirror: the `/quiz` route, reached from Home's daily question card.
Route<void> quizRoute({bool autoDaily = false}) =>
    MaterialPageRoute<void>(builder: (_) => QuizRoutePage(autoDaily: autoDaily));

Future<void> openQuiz(BuildContext context, {bool autoDaily = false}) =>
    Navigator.of(context).push(quizRoute(autoDaily: autoDaily));

class QuizRoutePage extends ConsumerStatefulWidget {
  const QuizRoutePage({super.key, this.autoDaily = false});

  /// Web `?auto=daily`: drop straight into the running daily quiz.
  final bool autoDaily;

  @override
  ConsumerState<QuizRoutePage> createState() => _QuizRoutePageState();
}

class _QuizRoutePageState extends ConsumerState<QuizRoutePage> {
  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // A running quiz / results screen consumes back first (same steps
        // as the header arrow); only an idle quiz leaves the page.
        final handler = ref.read(quizBackHandlerProvider);
        if (handler != null && handler()) return;
        Navigator.of(context).pop();
      },
      child: QuizScreen(autoDaily: widget.autoDaily),
    );
  }
}
