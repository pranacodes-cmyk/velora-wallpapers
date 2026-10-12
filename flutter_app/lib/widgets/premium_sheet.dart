import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/analytics.dart';
import '../core/services/haptics.dart';
import '../core/services/meta_capi.dart';
import '../core/services/meta_events.dart';
import '../core/services/rating_service.dart';
import 'lucide_cross.dart';
import '../core/services/revenuecat_service.dart';
import '../core/theme/app_colors.dart';
import 'lucide.dart';
import 'price_shimmer.dart';
import 'paywall_welcome_film.dart';
import '../core/theme/app_theme.dart';
import '../state/app_providers.dart';

/// 1:1 port of `src/components/PremiumSheet.tsx`.
/// Same order of blocks, same paddings/radii/typography, same compact/tiny
/// breakpoints (<740px / <620px), same analytics event names and properties.
enum PlanId { yearly, monthly, weekly }

/// Solid royal gold fill — identical in both themes, so the CTA and badges
/// never read washed out. Black type always sits on top of it.
const _goldFill = Color(0xFFE5A70E);

/// Gold used for type, icons and hairlines. On the light ivory surface the
/// bright tone loses all contrast, so it darkens there.
Color get _gold => AppColors.darkPrimary;

/// Review stars: the same gold, darkened on ivory.
Color get _stars =>
    AppColors.isLight ? const Color(0xFFB8860B) : const Color(0xFFE0A200);

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
  // Monthly is hidden from the UI only — the store product stays live so
  // existing monthly subscribers keep renewing normally.
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

/// Only features that actually ship today. Shield leads — it's the reason
/// people pay, and the removed Journeys / Bible Chat rows are gone for good.
List<_Benefit> _buildBenefits() => [
  _Benefit(
    Icons.route_outlined,
    t('premium.benefit.journeys.title'),
    t('premium.benefit.journeys.sub'),
  ),
  _Benefit(
    Icons.shield_outlined,
    t('premium.benefit.shield.title'),
    t('premium.benefit.shield.sub'),
  ),
  _Benefit(
    Icons.menu_book_outlined,
    t('premium.benefit.bible.title'),
    t('premium.benefit.bible.sub'),
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
    Icons.headphones_outlined,
    t('premium.benefit.prayerAudio.title'),
    t('premium.benefit.prayerAudio.sub'),
  ),
  _Benefit(
    Icons.auto_awesome_outlined,
    t('premium.benefit.versePacks.title'),
    t('premium.benefit.versePacks.sub'),
  ),
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

String _formatZeroMoney(String currency, [String? sampleLabel]) {
  final cur = currency.isEmpty ? 'USD' : currency;
  final aff = _affix(sampleLabel);
  try {
    final symbol = NumberFormat.simpleCurrency(name: cur).currencySymbol;
    if (symbol == cur && aff != null) return '${aff.prefix}0${aff.suffix}';
    return '${symbol}0';
  } catch (_) {
    if (aff != null) return '${aff.prefix}0${aff.suffix}';
    return '0 $cur';
  }
}

class PremiumSheet extends ConsumerStatefulWidget {
  const PremiumSheet({
    super.key,
    required this.onClose,
    this.onUnlock,
    this.trigger = 'unknown',
  });

  final VoidCallback onClose;
  final VoidCallback? onUnlock;
  final String trigger;

  @override
  ConsumerState<PremiumSheet> createState() => _PremiumSheetState();
}

class _PremiumSheetState extends ConsumerState<PremiumSheet> {
  PlanId _selected = PlanId.yearly;
  bool _purchasing = false;
  bool _restoring = false;
  Map<PlanId, Package> _packages = const {};
  // Prices come from the store over the network. Until they land we show a
  // shimmer instead of a dead "—", and we keep retrying with backoff so a
  // slow connection never leaves the paywall looking broken.
  bool _pricesLoading = true;
  bool _priceFailed = false;
  late final int _joinedToday = 2400 + Random().nextInt(600);

  double _dragY = 0;
  bool _closed = false;
  VoidCallback? _releaseRatingGate;

  // Only the onboarding handoff remains midnight-themed. Paywalls opened from
  // inside the app follow the user's active light/dark theme.
  bool get _forceDark => widget.trigger == 'post_onboarding';
  Color get _background =>
      _forceDark ? AppColors.darkBackground : AppColors.background;
  Color get _foreground =>
      _forceDark ? AppColors.darkForeground : AppColors.foreground;
  Color get _card => _forceDark ? AppColors.darkCard : AppColors.card;
  Color get _muted => _forceDark ? AppColors.darkMuted : AppColors.muted;
  Color get _mutedForeground =>
      _forceDark ? AppColors.darkMutedForeground : AppColors.mutedForeground;
  Color get _border => _forceDark ? AppColors.darkBorder : AppColors.border;
  Color get _glassRaised =>
      _forceDark ? AppColors.darkGlassRaised : AppColors.glassRaised;

  @override
  void initState() {
    super.initState();
    Analytics.capture('paywall_shown', {'trigger': widget.trigger});
    // Meta funnel signal: ViewContent on premium offer view (web parity).
    MetaCapi.viewContent(
      contentId: 'premium_offer',
      contentName: 'Premium Sheet',
    );
    // Hold back any rating prompt while the paywall owns the screen — the web
    // build does the same through `overlayQueue`.
    _releaseRatingGate = RatingOverlayGate.markVisible('paywall');
    _loadPackages();
  }

  @override
  void dispose() {
    _releaseRatingGate?.call();

    super.dispose();
  }

  Future<void> _loadPackages({int attempt = 0}) async {
    if (!mounted) return;
    if (!_pricesLoading || _priceFailed) {
      setState(() {
        _pricesLoading = true;
        _priceFailed = false;
      });
    }
    final pkgs = await RevenueCatService.planPackages();
    if (!mounted) return;
    final mapped = <PlanId, Package>{
      if (pkgs['weekly'] != null) PlanId.weekly: pkgs['weekly']!,
      if (pkgs['monthly'] != null) PlanId.monthly: pkgs['monthly']!,
      if (pkgs['yearly'] != null) PlanId.yearly: pkgs['yearly']!,
    };
    // Empty result = offline, store hiccup or offerings not cached yet.
    // Retry a few times with growing delays before admitting failure.
    if (mapped.isEmpty && attempt < 3) {
      await Future<void>.delayed(Duration(milliseconds: 700 * (attempt + 1)));
      if (!mounted) return;
      return _loadPackages(attempt: attempt + 1);
    }
    setState(() {
      _packages = mapped;
      _pricesLoading = false;
      _priceFailed = mapped.isEmpty;
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

  String _zeroTodayLabel() {
    final pkg = _packages[_selected];
    if (pkg == null) return t('premium.cta.zeroTodayFallback');
    final info = _priceInfo(pkg);
    return t('premium.cta.zeroToday', {
      'price': _formatZeroMoney(info.currency, info.label),
    });
  }

  void _toast(String message) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: _card,
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
    var pkg = _packages[_selected];
    if (pkg == null) {
      // Tapped before the store answered (or after it failed): fetch once more
      // with the CTA in its busy state instead of dead-ending on a toast.
      setState(() => _purchasing = true);
      await _loadPackages();
      if (!mounted) return;
      setState(() => _purchasing = false);
      pkg = _packages[_selected];
      if (pkg == null) {
        _toast(t('premium.toast.notAvailable'));
        return;
      }
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
      MetaEvents.initiatedCheckout(pkg.storeProduct.identifier);
      MetaCapi.initiateCheckout(
        product.price,
        product.currencyCode,
        productId: product.identifier,
      );
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
    String key;
    switch (trigger) {
      case 'favorites_limit':
        key = 'favoritesLimit';
      case 'premium_wallpaper':
      case 'wallpaper_locked':
        key = 'premiumWallpaper';
      case 'ad_free':
      case 'remove_ads':
        key = 'adFree';
      case 'prayer_audio':
        key = 'prayerAudio';
      case 'pray_screen':
      case 'pray_screen_limit':
      case 'shield':
        key = 'prayScreen';
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
    // When the sheet is opened from inside the app, a parent Scaffold/SafeArea
    // has usually already consumed the status-bar padding, so MediaQuery
    // reports 0 and the close cross ends up glued to the status bar. Fall back
    // to the real hardware insets from the root view so the sheet looks
    // identical everywhere (post-onboarding root mount and in-app taps).
    final mqInsets = MediaQuery.viewPaddingOf(context);
    final view = View.of(context);
    final dpr = view.devicePixelRatio == 0 ? 1.0 : view.devicePixelRatio;
    final insets = EdgeInsets.only(
      top: max(mqInsets.top, view.viewPadding.top / dpr),
      bottom: max(mqInsets.bottom, view.viewPadding.bottom / dpr),
    );
    final plans = _buildPlans();
    final benefits = _buildBenefits();

    return Material(
      color: _background,
      child: Stack(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520, maxHeight: 940),
              child: Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _hero(compact),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(24, 20, 24, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _benefitsGrid([benefits[2], benefits[0], benefits[1], benefits[4]], compact),


                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.fromLTRB(20, 8, 20, max(insets.bottom, 8)),
                    decoration: BoxDecoration(color: _background),
                    child: Column(
                      children: [
                        ..._planCards(plans, compact),
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.lock_open, size: 12, color: _gold),
                          const SizedBox(width: 8),
                          Flexible(child: Text(t('premium.offer.today'), textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _gold))),
                        ]),
                        const SizedBox(height: 12),
                        _cta(compact),
                        const SizedBox(height: 8),
                        Text('${_selected == PlanId.yearly ? '${_zeroTodayLabel()} · ' : ''}${t(_selected == PlanId.weekly ? 'premium.reminder.weekly' : 'premium.reminder.yearly')}',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 10, height: 1.5, color: _mutedForeground)),
                        const SizedBox(height: 6),
                        _footer(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: max(insets.top, 14), right: 16,
            child: IconButton(
              tooltip: t('premium.aria.close'),
              onPressed: _close,
              style: IconButton.styleFrom(backgroundColor: _background.withValues(alpha: 0.65)),
              icon: Icon(Icons.close, size: 16, color: _foreground),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(bool compact) {
    final height = MediaQuery.sizeOf(context).height;
    final filmHeight = height < 660 ? 180.0 : (height * 0.30).clamp(190.0, 300.0);
    final hero = _heroCopy;
    return SizedBox(
      height: filmHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const PaywallWelcomeFilm(),
          DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            stops: const [0, 0.35, 0.57, 0.87],
            colors: [_background.withValues(alpha: 0.12), _background.withValues(alpha: 0),
              _background.withValues(alpha: 0.4), _background],
          ))),
           Positioned(left: 20, right: 20, bottom: 4,
            child: Column(children: [
               Text('Prayly · PRO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _gold)),
               const SizedBox(height: 6),
              Text(hero.title, textAlign: TextAlign.center,
                 style: TextStyle(fontSize: height < 660 ? 22 : 28, height: 1.15, fontWeight: FontWeight.w600, color: _foreground)),
               const SizedBox(height: 6),
              ConstrainedBox(constraints: const BoxConstraints(maxWidth: 340),
                child: Text(hero.sub, textAlign: TextAlign.center,
                   style: TextStyle(fontSize: 12, height: 1.35, color: _mutedForeground))),
            ]),
          ),
        ],
      ),
    );
  }

  // Review card removed from the paywall — social proof now lives only in
  // onboarding (web parity).

  // ── Benefits (2-col bento) ──
  Widget _benefitsGrid(List<_Benefit> benefits, bool compact) => Column(
    children: [0, 2].map((start) => Padding(
      padding: EdgeInsets.only(bottom: start == 0 ? 14 : 0),
      child: Row(children: benefits.skip(start).take(2).map((b) => Expanded(
        child: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Row(children: [
            Container(width: 28, height: 28,
              decoration: BoxDecoration(shape: BoxShape.circle, color: _gold.withValues(alpha: 0.1)),
              child: Icon(b.icon, size: 14, color: _gold)),
            const SizedBox(width: 9),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b.title,
                style: TextStyle(fontSize: 11, height: 1.15, fontWeight: FontWeight.w600, color: _foreground)),
              const SizedBox(height: 2),
              Text(b.sub,
                style: TextStyle(fontSize: 10, height: 1.35, color: _mutedForeground)),
            ])),
          ]),
        ),
      )).toList()),
    )).toList(),
  );

  // ── Limited offer ribbon ──
  Widget _trialTimeline(bool compact) {
    final raw = t('premium.offer.today');
    final sep = raw.indexOf('·');
    final badge = sep > 0 ? raw.substring(0, sep).trim() : '';
    final headline = sep > 0 ? raw.substring(sep + 1).trim() : raw;
    return Container(
      constraints: const BoxConstraints(minHeight: 38),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            _gold.withValues(alpha: 0.09),
            _gold.withValues(alpha: 0.025),
          ],
        ),
        border: Border.all(color: _gold.withValues(alpha: 0.24)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.local_offer_rounded, size: 12, color: _gold),
          const SizedBox(width: 7),
          if (badge.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: 0.11),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                badge.toUpperCase(),
                style: TextStyle(
                  fontSize: 7.5,
                  height: 1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.9,
                  color: _gold.withValues(alpha: 0.86),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Text(
              headline,
              maxLines: 2,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: compact ? 10.5 : 11,
                height: 1,
                fontWeight: FontWeight.w800,
                color: _gold,
              ),
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
      var periodLabel = plan.period;
      String? anchor;
      if (pkg != null) {
        final info = _priceInfo(pkg);
        priceLabel = info.label;
        // Annual and monthly both lead with the weekly equivalent — the
        // smallest true number — and keep the billed total right underneath.
        if (plan.id == PlanId.yearly && info.amount > 0) {
          priceLabel = _formatMoney(
            info.amount / 52,
            info.currency,
            info.label,
          );
          periodLabel = t('premium.period.week');
          anchor = '${info.label} / ${t('premium.period.year')}';
        } else if (plan.id == PlanId.monthly && info.amount > 0) {
          priceLabel = _formatMoney(
            info.amount / 4.345,
            info.currency,
            info.label,
          );
          periodLabel = t('premium.period.week');
          anchor = '${info.label} / ${t('premium.period.month')}';
        }
      }

      final isSel = _selected == plan.id;
      out.add(Padding(
         padding: const EdgeInsets.only(bottom: 8),
        child: Semantics(
          selected: isSel,
          child: OutlinedButton(
            onPressed: () { setState(() => _selected = plan.id); haptic(HapticStyle.soft); },
            style: OutlinedButton.styleFrom(
               minimumSize: Size(double.infinity, 54),
               padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              backgroundColor: isSel ? _gold.withValues(alpha: AppColors.isLight && !_forceDark ? 0.055 : 0.055) : _card,
              side: BorderSide(color: isSel ? _gold : _border),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: isSel ? 1 : 0,
              shadowColor: _gold.withValues(alpha: 0.18),
            ),
            child: Row(children: [
               Container(width: 18, height: 18,
                decoration: BoxDecoration(shape: BoxShape.circle,
                  color: isSel ? _gold : Colors.transparent,
                  border: Border.all(color: isSel ? _gold : _mutedForeground.withValues(alpha: 0.5))),
                child: isSel ? Icon(Icons.check, size: 13, color: AppColors.darkBackground) : null),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                 Text(plan.label, style: TextStyle(fontSize: 14, height: 1.15, fontWeight: FontWeight.w600, color: _foreground)),
                 const SizedBox(height: 4),
                Text(plan.id == PlanId.yearly ? t('premium.plan.trialBadge') : plan.subtitle,
                    style: TextStyle(fontSize: 10, height: 1.25, fontWeight: FontWeight.w500, color: _mutedForeground)),
              ])),
               const SizedBox(width: 12),
              Flexible(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (pkg == null && _pricesLoading)
                  PriceShimmer(width: 52, height: 15, base: _mutedForeground)
                else Text('$priceLabel / $periodLabel', textAlign: TextAlign.right,
                   style: TextStyle(fontSize: 14, height: 1.1, fontWeight: FontWeight.w600, color: _foreground)),
                if (anchor != null) ...[
                  const SizedBox(height: 4),
                  Text(anchor, textAlign: TextAlign.right, style: TextStyle(fontSize: 9, height: 1.3, fontWeight: FontWeight.w500, color: _mutedForeground)),
                ],
              ])),
            ]),
          ),
        ),
      ));
    }
    return out;
  }

  // ── Trust strip ──
  Widget _trustStrip(bool compact) {
    Widget item(IconData icon, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: _gold),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w500,
            color: _foreground.withValues(alpha: 0.92),
          ),
        ),
      ],
    );
    final dot = Text(
      '•',
      style: TextStyle(
        fontSize: 10,
        color: _mutedForeground.withValues(alpha: 0.8),
      ),
    );
    return Container(
      padding: EdgeInsets.symmetric(vertical: compact ? 3 : 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: _muted.withValues(alpha: 0.25),
        border: Border.all(color: _border.withValues(alpha: 0.4)),
      ),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 4,
        children: [
          item(Icons.verified_user_outlined, t('premium.trust.cancelAnytime')),
          dot,
          item(Icons.check_rounded, t('premium.trust.noAds')),
          dot,
          item(Icons.add, t('premium.trust.faithFirst')),
        ],
      ),
    );
  }

  // ── CTA ──
  Widget _cta(bool compact) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(999),
      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: AppColors.paywallButtonGradient),
      boxShadow: AppColors.paywallButtonShadow,
    ),
    child: SizedBox(width: double.infinity, child: FilledButton(
      onPressed: _purchasing ? null : _handleContinue,
      style: FilledButton.styleFrom(backgroundColor: Colors.transparent,
        disabledBackgroundColor: Colors.transparent, foregroundColor: AppColors.darkBackground,
        minimumSize: const Size(double.infinity, 48),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12), shape: const StadiumBorder()),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
        Flexible(child: Text(t(_purchasing ? 'premium.cta.processing' : 'premium.cta.${_selected.name}.title'),
          textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
        const SizedBox(width: 12), const Icon(Icons.arrow_forward_rounded, size: 16),
      ]),
    )),
  );

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
                color: _foreground.withValues(alpha: 0.92),
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
            Flexible(
              child: Text(
                t(reminderKey),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: _mutedForeground),
              ),
            ),
          ],
        ),
      ),
    );
    return out;
  }

  // ── Footer ──
  Widget _footer() {
    final sep = Text('·', style: TextStyle(color: _border));
    final style = TextStyle(fontSize: 11, color: _mutedForeground);
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 10,
      runSpacing: 4,
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
        sep,
        Text(t('premium.footer.terms'), style: style),
        sep,
        Text(t('premium.footer.privacy'), style: style),
      ],
    );
  }
}
