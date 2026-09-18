import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/analytics.dart';
import '../core/services/haptics.dart';
import '../core/services/rating_service.dart';
import '../core/services/revenuecat_service.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_theme.dart';
import '../state/app_providers.dart';

/// 1:1 port of `src/components/PremiumSheet.tsx`.
/// Same order of blocks, same paddings/radii/typography, same compact/tiny
/// breakpoints (<740px / <620px), same analytics event names and properties.
enum PlanId { yearly, monthly, weekly }

const _gold = Color(0xFFF0C64A); // hsl(45 85% 58%) — web's `gold` constant

class _PlanSpec {
  const _PlanSpec(this.id, this.label, this.period, this.subtitle, this.badge);
  final PlanId id;
  final String label;
  final String period;
  final String subtitle;
  final String? badge;
}

List<_PlanSpec> _buildPlans() => [
  // Yearly FIRST — the anchor & default. Trial is the hero.
  _PlanSpec(
    PlanId.yearly,
    t('premium.plan.yearly.label'),
    t('premium.period.year'),
    t('premium.plan.yearly.subtitle'),
    t('premium.plan.yearly.badge'),
  ),
  _PlanSpec(
    PlanId.monthly,
    t('premium.plan.monthly.label'),
    t('premium.period.month'),
    t('premium.plan.monthly.subtitle'),
    null,
  ),
  _PlanSpec(
    PlanId.weekly,
    t('premium.plan.weekly.label'),
    t('premium.period.week'),
    t('premium.plan.weekly.subtitle'),
    null,
  ),
];

class _Benefit {
  const _Benefit(this.icon, this.title, this.sub);
  final IconData icon;
  final String title;
  final String sub;
}

List<_Benefit> _buildBenefits() => [
  _Benefit(
    Icons.block,
    t('premium.benefit.adFree.title'),
    t('premium.benefit.adFree.sub'),
  ),
  _Benefit(
    Icons.image_outlined,
    t('premium.benefit.hdWallpapers.title'),
    t('premium.benefit.hdWallpapers.sub'),
  ),
  _Benefit(
    Icons.wb_twilight,
    t('premium.benefit.dailyVerse.title'),
    t('premium.benefit.dailyVerse.sub'),
  ),
  _Benefit(
    Icons.explore_outlined,
    t('premium.benefit.allJourneys.title'),
    t('premium.benefit.allJourneys.sub'),
  ),
  _Benefit(
    Icons.favorite_border,
    t('premium.benefit.bibleChat.title'),
    t('premium.benefit.bibleChat.sub'),
  ),
  _Benefit(
    Icons.headphones_outlined,
    t('premium.benefit.prayerAudio.title'),
    t('premium.benefit.prayerAudio.sub'),
  ),
];

/// Web parity: `premium.review.N.name` falls back to these English names.
const _reviewNames = [
  'Hannah Whitfield',
  'Elijah Thompson',
  'Ruth Donovan',
  'Caleb Beaumont',
  'Esther Lindquist',
  'Isaiah Hartwell',
  "Mary Catherine O'Sullivan",
  'Josiah Rutherford',
  'Naomi Eastwood',
  'Ezekiel Whitmore',
];

/// Money formatter — never prints a raw ISO code ("PHP 449"); reuses the
/// symbol from the store's own label when the locale has no symbol.
({String prefix, String suffix})? _affix(String? sample) {
  if (sample == null || sample.isEmpty) return null;
  final m = RegExp(
    r'^([^\d\s.,-]*)\s*[\d.,\s]+\s*([^\d\s.,-]*)$',
  ).firstMatch(sample);
  if (m == null) return null;
  final prefix = (m.group(1) ?? '').trim();
  final suffix = (m.group(2) ?? '').trim();
  if (prefix.isEmpty && suffix.isEmpty) return null;
  if (RegExp(r'^[A-Za-z]{2,}$').hasMatch(prefix) ||
      RegExp(r'^[A-Za-z]{2,}$').hasMatch(suffix)) {
    return null;
  }
  return (prefix: prefix, suffix: suffix);
}

String _formatMoney(double amount, String currency, [String? sampleLabel]) {
  final cur = currency.isEmpty ? 'USD' : currency;
  final aff = _affix(sampleLabel);
  final num = NumberFormat('#,##0.00').format(amount);
  try {
    final symbol = NumberFormat.simpleCurrency(name: cur).currencySymbol;
    if (symbol == cur && aff != null) return '${aff.prefix}$num${aff.suffix}';
    return '$symbol$num';
  } catch (_) {
    if (aff != null) return '${aff.prefix}$num${aff.suffix}';
    return '$num $cur';
  }
}

class PremiumSheet extends ConsumerStatefulWidget {
  const PremiumSheet({
    super.key,
    required this.onClose,
    this.onUnlock,
    this.trigger = 'unknown',
    this.journeyTitle,
    this.day,
    this.totalDays,
  });

  final VoidCallback onClose;
  final VoidCallback? onUnlock;
  final String trigger;
  final String? journeyTitle;
  final int? day;
  final int? totalDays;

  @override
  ConsumerState<PremiumSheet> createState() => _PremiumSheetState();
}

class _PremiumSheetState extends ConsumerState<PremiumSheet> {
  PlanId _selected = PlanId.yearly;
  bool _purchasing = false;
  bool _restoring = false;
  Map<PlanId, Package> _packages = const {};
  late final int _joinedToday = 2400 + Random().nextInt(600);
  int _reviewIndex = Random().nextInt(_reviewNames.length);
  bool _reviewVisible = true;
  Timer? _reviewTimer;
  double _dragY = 0;
  bool _closed = false;
  VoidCallback? _releaseRatingGate;

  @override
  void initState() {
    super.initState();
    Analytics.capture('paywall_shown', {'trigger': widget.trigger});
    // Hold back any rating prompt while the paywall owns the screen — the web
    // build does the same through `overlayQueue`.
    _releaseRatingGate = RatingOverlayGate.markVisible('paywall');
    _loadPackages();
    // Android cadence from the web build (7.5s) — fewer rebuild bursts.
    _reviewTimer = Timer.periodic(const Duration(milliseconds: 7500), (_) {
      if (!mounted) return;
      setState(() => _reviewVisible = false);
      Timer(const Duration(milliseconds: 380), () {
        if (!mounted) return;
        setState(() {
          _reviewIndex = (_reviewIndex + 1) % _reviewNames.length;
          _reviewVisible = true;
        });
      });
    });
  }

  @override
  void dispose() {
    _reviewTimer?.cancel();
    _releaseRatingGate?.call();
    super.dispose();
  }

  Future<void> _loadPackages() async {
    final pkgs = await RevenueCatService.planPackages();
    if (!mounted) return;
    setState(() {
      _packages = {
        if (pkgs['weekly'] != null) PlanId.weekly: pkgs['weekly']!,
        if (pkgs['monthly'] != null) PlanId.monthly: pkgs['monthly']!,
        if (pkgs['yearly'] != null) PlanId.yearly: pkgs['yearly']!,
      };
    });
  }

  ({double amount, String currency, String label}) _priceInfo(Package pkg) {
    final p = pkg.storeProduct;
    return (
      amount: p.price,
      currency: p.currencyCode.isEmpty ? 'USD' : p.currencyCode,
      label: p.priceString.isEmpty ? '—' : p.priceString,
    );
  }

  void _toast(String message) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.card,
      ),
    );
  }

  void _close() {
    if (_closed) return;
    _closed = true;
    widget.onClose();
  }

  Map<String, Object> get _planProps => {
    'trigger': widget.trigger,
    'plan': _selected.name,
  };

  Future<void> _handleContinue() async {
    haptic(HapticStyle.medium);
    Analytics.capture('paywall_cta_tapped', _planProps);
    final pkg = _packages[_selected];
    if (pkg == null) {
      _toast(t('premium.toast.notAvailable'));
      return;
    }
    final product = pkg.storeProduct;
    Analytics.capture('purchase_started', {
      ..._planProps,
      'product_id': product.identifier,
      'price': product.price,
      'currency': product.currencyCode,
    });
    setState(() => _purchasing = true);
    try {
      final ok = await RevenueCatService.purchase(pkg);
      if (!mounted) return;
      if (ok) {
        ref.read(premiumProvider.notifier).setUnlocked();
        haptic(HapticStyle.heavy);
        _toast(t('premium.toast.unlocked'));
        Analytics.capture('purchase_completed', {
          ..._planProps,
          'product_id': product.identifier,
          'price': product.price,
          'currency': product.currencyCode,
        });
        widget.onUnlock?.call();
        _close();
      } else {
        _toast(t('premium.toast.purchaseIncomplete'));
        Analytics.capture('purchase_failed', {
          ..._planProps,
          'reason': 'not_completed',
        });
      }
    } catch (e) {
      if (!mounted) return;
      if (RevenueCatService.isUserCancelled(e)) {
        _toast(t('premium.toast.purchaseCancelled'));
        Analytics.capture('purchase_cancelled', _planProps);
      } else {
        _toast(t('premium.toast.purchaseFailed'));
        Analytics.capture('purchase_failed', {
          ..._planProps,
          'reason': 'exception',
        });
      }
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  Future<void> _handleRestore() async {
    if (_restoring) return;
    haptic(HapticStyle.soft);
    setState(() => _restoring = true);
    _toast(t('premium.toast.checkingPurchases'));
    try {
      final ok = await ref.read(premiumProvider.notifier).restore();
      if (!mounted) return;
      if (ok) {
        haptic(HapticStyle.heavy);
        _toast(t('premium.toast.restored'));
        widget.onUnlock?.call();
        _close();
      } else {
        _toast(t('premium.toast.noPurchasesFound'));
      }
    } catch (_) {
      _toast(t('premium.toast.restoreFailed'));
    } finally {
      if (mounted) setState(() => _restoring = false);
    }
  }

  ({String title, String sub}) get _heroCopy {
    final trigger = widget.trigger;
    if (trigger.startsWith('journey_day_') && trigger.endsWith('_complete')) {
      final day =
          widget.day ??
          int.tryParse(
            RegExp(
                  r'journey_day_(\d+)_complete',
                ).firstMatch(trigger)?.group(1) ??
                '0',
          ) ??
          0;
      final total = widget.totalDays ?? 7;
      final title = widget.journeyTitle;
      final remaining = max(1, total - day);
      return (
        title: title != null
            ? t('premium.hero.journeyDay.titleWithTitle', {
                'day': day,
                'title': title,
              })
            : t('premium.hero.journeyDay.titleNoTitle', {'day': day}),
        sub: remaining == 1
            ? t('premium.hero.journeyDay.sub_one')
            : t('premium.hero.journeyDay.sub_other', {'remaining': remaining}),
      );
    }
    String key;
    switch (trigger) {
      case 'auto_journey_day_finished':
        key = 'autoJourneyDayFinished';
      case 'journeys':
        key = 'journeys';
      case 'favorites_limit':
        key = 'favoritesLimit';
      case 'companion_quota':
      case 'companion_limit':
        key = 'companion';
      case 'journey_locked':
      case 'journey_reflection_quota':
        key = 'journeyLocked';
      case 'premium_wallpaper':
      case 'wallpaper_locked':
        key = 'premiumWallpaper';
      case 'ad_free':
      case 'remove_ads':
        key = 'adFree';
      case 'prayer_audio':
        key = 'prayerAudio';
      default:
        key = 'default';
    }
    return (
      title: t('premium.hero.$key.title'),
      sub: t('premium.hero.$key.sub'),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Close automatically when premium turns on while the sheet is open
    // (purchase confirmed, background sync or restore) — web parity.
    ref.listen<bool>(premiumProvider, (_, isPremium) {
      if (!isPremium) return;
      Timer(const Duration(milliseconds: 400), () {
        if (!mounted) return;
        widget.onUnlock?.call();
        _close();
      });
    });

    final size = MediaQuery.sizeOf(context);
    final compact = size.height < 740;
    final tiny = size.height < 620;
    final insets = MediaQuery.viewPaddingOf(context);
    final plans = _buildPlans();
    final benefits = _buildBenefits();

    final backdropOpacity = (1 - (_dragY / 300)).clamp(0.0, 1.0);

    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: _close,
            child: ColoredBox(
              color: AppColors.background.withValues(
                alpha: 0.78 * backdropOpacity,
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: Transform.translate(
            offset: Offset(0, _dragY),
            child: Container(
              padding: EdgeInsets.only(top: max(insets.top, 10)),
              decoration: BoxDecoration(
                color: AppColors.background,
                border: Border(top: BorderSide(color: AppColors.border)),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.foreground.withValues(alpha: 0.25),
                    blurRadius: 80,
                    offset: const Offset(0, -20),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Drag handle
                  GestureDetector(
                    onVerticalDragUpdate: (d) =>
                        setState(() => _dragY = max(0, _dragY + d.delta.dy)),
                    onVerticalDragEnd: (d) {
                      if (_dragY > 100 || d.velocity.pixelsPerSecond.dy > 500) {
                        _close();
                      } else {
                        setState(() => _dragY = 0);
                      }
                    },
                    child: Container(
                      color: Colors.transparent,
                      padding: const EdgeInsets.only(top: 8, bottom: 2),
                      alignment: Alignment.center,
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.mutedForeground.withValues(
                            alpha: 0.35,
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        0,
                        20,
                        max(insets.bottom, 14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _hero(compact),
                          if (!tiny)
                            Padding(
                              padding: EdgeInsets.symmetric(
                                vertical: compact ? 6 : 8,
                              ),
                              child: _floatingSocialProof(),
                            ),
                          _benefitsGrid(benefits, compact),
                          SizedBox(height: compact ? 8 : 12),
                          _urgencyStrip(compact),
                          const SizedBox(height: 8),
                          ..._planCards(plans, compact),
                          SizedBox(height: compact ? 8 : 12),
                          _trustStrip(compact),
                          const SizedBox(height: 8),
                          _cta(compact),
                          ..._ctaFooterNotes(),
                          const SizedBox(height: 8),
                          _footer(),
                          const SizedBox(height: 8),
                          _mission(),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Close button — below the safe area, never at status-bar level.
        Positioned(
          top: max(insets.top, 10) + 4 + _dragY,
          right: 16,
          child: GestureDetector(
            onTap: _close,
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.muted.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.close_rounded,
                size: 16,
                color: AppColors.mutedForeground,
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Hero ──
  Widget _hero(bool compact) {
    final hero = _heroCopy;
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        // Soft gold radial halo (no blur — Android GPU parity).
        Positioned(
          top: -8,
          child: IgnorePointer(
            child: Container(
              width: 280,
              height: 140,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: RadialGradient(
                  colors: [
                    _gold.withValues(alpha: 0.13),
                    _gold.withValues(alpha: 0.05),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.38, 0.7],
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 2),
          child: Column(
            children: [
              Container(
                width: compact ? 32 : 40,
                height: compact ? 32 : 40,
                margin: EdgeInsets.only(bottom: compact ? 4 : 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(compact ? 11 : 14),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _gold.withValues(alpha: 0.2),
                      _gold.withValues(alpha: 0.06),
                    ],
                  ),
                  border: Border.all(
                    color: _gold.withValues(alpha: 0.33),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: _gold.withValues(alpha: 0.19),
                      blurRadius: 26,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(Icons.add, size: 18, color: _gold),
              ),
              Text(
                hero.title,
                textAlign: TextAlign.center,
                style: AppTheme.serif(
                  size: compact ? 19 : 23,
                  weight: FontWeight.w600,
                  color: AppColors.foreground,
                  height: 1.08,
                  letterSpacing: -0.5,
                ),
              ),
              Padding(
                padding: EdgeInsets.only(top: compact ? 2 : 4),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 280),
                  child: Text(
                    hero.sub,
                    textAlign: TextAlign.center,
                    style: AppTheme.serif(
                      size: compact ? 11.5 : 12.5,
                      weight: FontWeight.w400,
                      color: AppColors.mutedForeground,
                    ).copyWith(fontStyle: FontStyle.italic),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.only(top: compact ? 4 : 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ...List.generate(
                      5,
                      (_) => const Text(
                        '★',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFFE8B94A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      t('premium.social.ratingLine'),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground.withValues(alpha: 0.92),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Floating review card ──
  Widget _floatingSocialProof() {
    final name = t('premium.review.${_reviewIndex + 1}.name');
    final display = name == 'premium.review.${_reviewIndex + 1}.name'
        ? _reviewNames[_reviewIndex]
        : name;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: AnimatedOpacity(
          opacity: _reviewVisible ? 1 : 0,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeInOut,
          child: AnimatedSlide(
            offset: Offset(0, _reviewVisible ? 0 : 0.04),
            duration: const Duration(milliseconds: 450),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: AppColors.foreground.withValues(alpha: 0.04),
                border: Border.all(
                  color: AppColors.foreground.withValues(alpha: 0.1),
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 18,
                    spreadRadius: -10,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ...List.generate(
                        5,
                        (_) => const Text(
                          '★',
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0xFFE8B94A),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          display,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.foreground.withValues(alpha: 0.95),
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        t('premium.review.verified'),
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                          color: AppColors.mutedForeground.withValues(
                            alpha: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '"${t('premium.review.${_reviewIndex + 1}.text')}"',
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.4,
                      fontStyle: FontStyle.italic,
                      color: AppColors.foreground.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Benefits (2-col bento) ──
  Widget _benefitsGrid(List<_Benefit> benefits, bool compact) {
    return LayoutBuilder(
      builder: (context, c) {
        final cardWidth = (c.maxWidth - 6) / 2;
        return Wrap(
          spacing: 6,
          runSpacing: 6,
          children: benefits
              .map(
                (b) => SizedBox(
                  width: cardWidth,
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: compact ? 4 : 6,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          _gold.withValues(alpha: 0.055),
                          _gold.withValues(alpha: 0.012),
                        ],
                      ),
                      border: Border.all(color: _gold.withValues(alpha: 0.14)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                _gold.withValues(alpha: 0.18),
                                _gold.withValues(alpha: 0.06),
                              ],
                            ),
                            border: Border.all(
                              color: _gold.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Icon(b.icon, size: 13, color: _gold),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                b.title,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  height: 1.1,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.1,
                                  color: AppColors.foreground,
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                b.sub,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  height: 1.25,
                                  color: AppColors.mutedForeground,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }

  // ── Urgency strip ──
  Widget _urgencyStrip(bool compact) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: compact ? 4 : 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            _gold.withValues(alpha: 0.12),
            _gold.withValues(alpha: 0.03),
          ],
        ),
        border: Border.all(color: _gold.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: _gold,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: _gold, blurRadius: 10)],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            t('premium.urgency.badge').toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
              color: _gold,
            ),
          ),
          const Spacer(),
          Text(
            t('premium.urgency.joinedToday', {
              'count': NumberFormat('#,##0').format(_joinedToday),
            }),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: AppColors.foreground.withValues(alpha: 0.95),
            ),
          ),
        ],
      ),
    );
  }

  // ── Plans ──
  List<Widget> _planCards(List<_PlanSpec> plans, bool compact) {
    final out = <Widget>[];
    for (final plan in plans) {
      final pkg = _packages[plan.id];
      var priceLabel = '—';
      String? anchor;
      if (pkg != null) {
        final info = _priceInfo(pkg);
        priceLabel = info.label;
        if (plan.id == PlanId.yearly && info.amount > 0) {
          anchor = t('premium.plan.yearly.anchor', {
            'price': _formatMoney(info.amount / 52, info.currency, info.label),
          });
        }
      }
      final isSel = _selected == plan.id;
      final hasBadge = plan.badge != null;
      out.add(
        Padding(
          padding: EdgeInsets.only(bottom: compact ? 4 : 6),
          child: GestureDetector(
            onTap: () {
              setState(() => _selected = plan.id);
              haptic(HapticStyle.soft);
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: compact
                      ? EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: hasBadge ? 8 : 7,
                        )
                      : EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: hasBadge ? 11 : 9,
                        ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: isSel
                        ? LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              _gold.withValues(alpha: 0.16),
                              _gold.withValues(alpha: 0.05),
                            ],
                          )
                        : null,
                    color: isSel
                        ? null
                        : AppColors.muted.withValues(alpha: 0.35),
                    border: Border.all(
                      color: isSel
                          ? _gold
                          : AppColors.border.withValues(alpha: 0.6),
                      width: isSel ? 1.5 : 1,
                    ),
                    boxShadow: isSel
                        ? [
                            BoxShadow(
                              color: _gold.withValues(alpha: 0.15),
                              blurRadius: 0,
                              spreadRadius: 4,
                            ),
                            BoxShadow(
                              color: _gold.withValues(alpha: 0.15),
                              blurRadius: 28,
                              offset: const Offset(0, 10),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSel ? _gold : Colors.transparent,
                          border: isSel
                              ? null
                              : Border.all(
                                  color: AppColors.mutedForeground.withValues(
                                    alpha: 0.35,
                                  ),
                                  width: 1.5,
                                ),
                        ),
                        child: isSel
                            ? const Icon(
                                Icons.check_rounded,
                                size: 11,
                                color: Colors.black,
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              plan.label,
                              style: TextStyle(
                                fontSize: compact ? 13.5 : 14.5,
                                height: 1.1,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.1,
                                color: AppColors.foreground,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              plan.subtitle,
                              style: TextStyle(
                                fontSize: compact ? 10 : 11,
                                height: 1.1,
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (plan.id != PlanId.weekly) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    _gold.withValues(alpha: 0.15),
                                    _gold.withValues(alpha: 0.07),
                                  ],
                                ),
                                border: Border.all(
                                  color: _gold.withValues(alpha: 0.33),
                                ),
                              ),
                              child: Text(
                                t('premium.plan.trialBadge').toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.6,
                                  color: _gold,
                                ),
                              ),
                            ),
                            SizedBox(height: compact ? 4 : 6),
                          ],
                          Text(
                            priceLabel,
                            style: TextStyle(
                              fontSize: compact ? 14 : 15,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.2,
                              height: 1,
                              color: AppColors.foreground,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '/ ${plan.period}',
                            style: TextStyle(
                              fontSize: 10,
                              height: 1,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                          if (anchor != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              anchor,
                              style: const TextStyle(
                                fontSize: 9.5,
                                height: 1,
                                fontWeight: FontWeight.w600,
                                color: _gold,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                if (plan.badge != null)
                  Positioned(
                    top: -7,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(5),
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [_gold, Color(0xFFF59E17)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: _gold.withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        plan.badge!.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 8,
                          height: 1.1,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.96,
                          color: Colors.black,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }
    return out;
  }

  // ── Trust strip ──
  Widget _trustStrip(bool compact) {
    Widget item(IconData icon, String label) => Row(
      children: [
        Icon(icon, size: 12, color: _gold),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w500,
            color: AppColors.foreground.withValues(alpha: 0.92),
          ),
        ),
      ],
    );
    final dot = Text(
      '•',
      style: TextStyle(
        fontSize: 10,
        color: AppColors.mutedForeground.withValues(alpha: 0.8),
      ),
    );
    return Container(
      padding: EdgeInsets.symmetric(vertical: compact ? 4 : 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: AppColors.muted.withValues(alpha: 0.25),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          item(Icons.verified_user_outlined, t('premium.trust.cancelAnytime')),
          const SizedBox(width: 12),
          dot,
          const SizedBox(width: 12),
          item(Icons.check_rounded, t('premium.trust.noAds')),
          const SizedBox(width: 12),
          dot,
          const SizedBox(width: 12),
          item(Icons.add, t('premium.trust.faithFirst')),
        ],
      ),
    );
  }

  // ── CTA ──
  Widget _cta(bool compact) {
    final planKey = _selected.name; // weekly | monthly | yearly
    return GestureDetector(
      onTap: _purchasing ? null : _handleContinue,
      child: Opacity(
        opacity: _purchasing ? 0.7 : 1,
        child: Container(
          padding: EdgeInsets.symmetric(vertical: compact ? 8 : 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF7D253), _gold, Color(0xFFF2A007)],
              stops: [0, 0.5, 1],
            ),
            boxShadow: [
              BoxShadow(
                color: _gold.withValues(alpha: 0.33),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (_purchasing)
                Text(
                  t('premium.cta.processing'),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.black,
                  ),
                )
              else
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      t('premium.cta.$planKey.title'),
                      style: AppTheme.serif(
                        size: 16,
                        weight: FontWeight.w700,
                        color: Colors.black,
                        height: 1,
                        letterSpacing: 0.16,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      t('premium.cta.$planKey.sub'),
                      style: TextStyle(
                        fontSize: 10.5,
                        height: 1,
                        fontWeight: FontWeight.w500,
                        color: Colors.black.withValues(alpha: 0.95),
                      ),
                    ),
                  ],
                ),
              if (!_purchasing && _selected != PlanId.weekly)
                Positioned(
                  top: 0,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      color: Colors.black.withValues(alpha: 0.82),
                    ),
                    child: Text(
                      t('premium.cta.zeroToday').toUpperCase(),
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.72,
                        color: _gold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _ctaFooterNotes() {
    final out = <Widget>[];
    final yearlyPkg = _packages[PlanId.yearly];
    if (_selected == PlanId.yearly && yearlyPkg != null) {
      final info = _priceInfo(yearlyPkg);
      if (info.amount > 0) {
        out.add(
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              t('premium.perDay', {
                'price': _formatMoney(
                  info.amount / 365,
                  info.currency,
                  info.label,
                ),
              }),
              textAlign: TextAlign.center,
              style: AppTheme.serif(
                size: 11,
                weight: FontWeight.w500,
                color: AppColors.foreground.withValues(alpha: 0.92),
              ).copyWith(fontStyle: FontStyle.italic),
            ),
          ),
        );
      }
    }
    final reminderKey = _selected == PlanId.weekly
        ? 'premium.reminder.weekly'
        : 'premium.reminder.yearly';
    out.add(
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.verified_user_outlined,
              size: 12,
              color: _gold.withValues(alpha: 0.7),
            ),
            const SizedBox(width: 6),
            Text(
              t(reminderKey),
              style: TextStyle(fontSize: 11, color: AppColors.mutedForeground),
            ),
          ],
        ),
      ),
    );
    return out;
  }

  // ── Footer ──
  Widget _footer() {
    final sep = Text('·', style: TextStyle(color: AppColors.border));
    final style = TextStyle(fontSize: 11, color: AppColors.mutedForeground);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        GestureDetector(
          onTap: _restoring ? null : _handleRestore,
          child: Text(
            _restoring
                ? t('premium.footer.restoring')
                : t('premium.footer.restore'),
            style: style.copyWith(fontWeight: FontWeight.w500),
          ),
        ),
        const SizedBox(width: 14),
        sep,
        const SizedBox(width: 14),
        Text(t('premium.footer.terms'), style: style),
        const SizedBox(width: 14),
        sep,
        const SizedBox(width: 14),
        Text(t('premium.footer.privacy'), style: style),
      ],
    );
  }

  Widget _mission() {
    final line = Container(
      width: 28,
      height: 1,
      color: _gold.withValues(alpha: 0.2),
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        line,
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            t('premium.mission'),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              height: 1.35,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
              color: _gold.withValues(alpha: 0.8),
            ),
          ),
        ),
        const SizedBox(width: 8),
        line,
      ],
    );
  }
}
