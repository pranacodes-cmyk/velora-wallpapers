import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/pray_screen_service.dart';
import '../../core/services/prayer_pause_store.dart';
import '../../core/services/rating_service.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/lucide.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';
import '../../core/services/bible_gate_service.dart';
import 'scripture_gate_screen.dart';

/// Rotating pauses, so every unlock brings a fresh verse and prayer. The copy
/// is published from the backend (`pray_pauses`) in the user's language, with
/// the bundled dictionary as the offline fallback.
PrayerPause _pauseAt(int index) => PrayerPauseStore.at(index);

class PrayScreenScreen extends ConsumerStatefulWidget {
  const PrayScreenScreen({super.key, this.launchUnlock = false});

  final bool launchUnlock;

  @override
  ConsumerState<PrayScreenScreen> createState() => _PrayScreenScreenState();
}

class _PrayScreenScreenState extends ConsumerState<PrayScreenScreen>
    with WidgetsBindingObserver {
  PrayScreenStatus _status = const PrayScreenStatus(
    usageAllowed: false,
    overlayAllowed: false,
    running: false,
  );

  /// Drives the permission sheet so it ticks green the moment the user comes
  /// back from the Android settings page — no second tap needed.
  final ValueNotifier<int> _permissionTick = ValueNotifier<int>(0);
  bool _polling = false;
  late Set<String> _selected;
  List<GuardedApp> _apps = PrayScreenService.supportedApps;
  bool _enabled = false;
  bool _busy = false;
  bool _batteryOk = true;
  int _handledLaunchToken = 0;
  int _pauseSeed = DateTime.now().day;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _selected = PrayScreenService.selectedPackages.toSet();
    _enabled = PrayScreenService.enabled;
    _refresh();
    _loadApps();
    _syncNative();
    PrayScreenService.pushBlockerCopy();
    Analytics.capture('pray_screen_viewed');
    if (widget.launchUnlock) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _maybePrimeAd();
        _unlock();
      });
    }
  }

  /// Warms the unlock ad ONLY when the user just arrived from the native
  /// Shield (they are about to unlock). Opening this tab, turning the Shield
  /// on, or finishing an unlock never requests an ad — those requests were
  /// mostly never shown and dragged the AdMob show rate down.
  void _maybePrimeAd() {
    if (!mounted) return;
    if (ref.read(premiumProvider)) return;
    if (!_enabled || _selected.isEmpty) return;
    AdsService.primeInterstitial();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _permissionTick.dispose();
    super.dispose();
  }

  String? _openedPermission;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _pollPermissions();
      _reportPermissionOutcome();
    }
  }

  /// After the user comes back from an Android settings page, give the OS a
  /// moment to report the grant, then log a clear "not granted" when it failed.
  Future<void> _reportPermissionOutcome() async {
    final opened = _openedPermission;
    if (opened == null) return;
    _openedPermission = null;
    await Future<void>.delayed(const Duration(milliseconds: 3000));
    if (!mounted) return;
    await _refresh();
    final granted = opened == 'usage_access'
        ? _status.usageAllowed
        : opened == 'display_over_apps'
        ? _status.overlayAllowed
        : _batteryOk;
    if (!granted) {
      Analytics.capture('pray_screen_permission_not_granted', {
        'permission': opened,
      });
    }
  }

  /// Android reports a freshly granted permission with a small delay, so the
  /// status is re-read a few times after the user returns from settings.
  Future<void> _pollPermissions() async {
    if (_polling) return;
    _polling = true;
    const steps = [0, 250, 450, 700, 1100, 1700, 2500];
    var usageWas = _status.usageAllowed;
    var overlayWas = _status.overlayAllowed;
    var wasReady = _status.ready;
    for (final gap in steps) {
      if (gap > 0) await Future<void>.delayed(Duration(milliseconds: gap));
      if (!mounted) break;
      await _refresh();
      _permissionTick.value++;
      if (_status.usageAllowed && !usageWas) {
        usageWas = true;
        Analytics.capture('pray_screen_permission_granted', {
          'permission': 'usage_access',
        });
        _loadApps();
      }
      if (_status.overlayAllowed && !overlayWas) {
        overlayWas = true;
        Analytics.capture('pray_screen_permission_granted', {
          'permission': 'display_over_apps',
        });
      }
      if (_status.ready && !wasReady) {
        wasReady = true;
        Analytics.capture('pray_screen_permissions_ready', {
          'app_count': _selected.length,
        });
      }
      if (_status.ready && _batteryOk) break;
    }
    _polling = false;
    if (!mounted) return;
    // Permissions complete → the Shield turns itself on, no extra tap.
    if (_status.ready && _selected.isNotEmpty && !_enabled) await _toggleShield();
  }


  /// Keeps the native watcher's app list and run state in step with the app —
  /// apps chosen during onboarding were previously never pushed to the guard.
  Future<void> _syncNative() async {
    await _enforceFreeLimit();
    if (_selected.isEmpty) return;
    await PrayScreenService.saveApps(_selected.toList());
    await PrayScreenService.ensureRunning();
    if (mounted) await _refresh();
  }

  Future<void> _refresh() async {
    final status = await PrayScreenService.status();
    final battery = await PrayScreenService.batteryUnrestricted();
    if (mounted) setState(() { _status = status; _batteryOk = battery; });
  }

  Future<void> _loadApps() async {
    final apps = await PrayScreenService.loadInstalledApps();
    if (!mounted) return;
    setState(() => _apps = apps);
    await _preselectSocialApps(apps);
  }

  /// First visit only: pre-tick Instagram, TikTok, Facebook and X when they
  /// are really installed, so the user just taps "Turn on". Free users get
  /// the first two (free limit), Pro users get all found.
  Future<void> _preselectSocialApps(List<GuardedApp> apps) async {
    if (kIsWeb) return;
    if (Prefs.getBool('ps_preselect_done') || _selected.isNotEmpty) return;
    if (identical(apps, PrayScreenService.supportedApps)) return;
    const wanted = [
      'com.instagram.android',
      'com.zhiliaoapp.musically',
      'com.facebook.katana',
      'com.twitter.android',
    ];
    final installed = apps.map((a) => a.packageName).toSet();
    var picks = wanted.where(installed.contains).toList();
    await Prefs.setBool('ps_preselect_done', true);
    if (picks.isEmpty) return;
    if (!ref.read(premiumProvider)) picks = picks.take(2).toList();
    if (!mounted) return;
    setState(() => _selected = picks.toSet());
    await PrayScreenService.saveApps(picks);
    Analytics.capture('pray_screen_apps_preselected', {
      'packages': picks.join(','),
      'app_count': picks.length,
    });
  }

  /// A lapsed Pro user kept every app they had picked while subscribed — the
  /// free tier is two, so trim back to the first two and re-push the list.
  Future<void> _enforceFreeLimit() async {
    if (ref.read(premiumProvider) || _selected.length <= 2) return;
    final trimmed = _selected.take(2).toSet();
    if (mounted) setState(() => _selected = trimmed);
    await PrayScreenService.saveApps(trimmed.toList());
  }

  Future<void> _toggleApp(GuardedApp app) async {
    final premium = ref.read(premiumProvider);
    final adding = !_selected.contains(app.packageName);
    if (adding && !premium && _selected.length >= 2) {
      Analytics.capture('pray_screen_app_limit_hit', {
        'app': app.name,
        'package': app.packageName,
        'app_count': _selected.length,
      });
      _openPremium();
      return;
    }
    setState(() {
      if (!_selected.add(app.packageName)) _selected.remove(app.packageName);
    });
    await PrayScreenService.saveApps(_selected.toList());
    Analytics.capture('pray_screen_app_toggled', {
      'app': app.name,
      'package': app.packageName,
      'action': adding ? 'locked' : 'removed',
      'app_count': _selected.length,
      'is_premium': premium,
      'permissions_ready': _status.ready,
    });
    if (!adding || !mounted) return;
    // Locking an app is the only step the user takes — permissions and the
    // Shield itself follow automatically from here.
    if (!_status.ready) await _showPermissionSheet();
    if (mounted && _status.ready && !_enabled) await _toggleShield();
  }

  Future<void> _toggleShield() async {
    if (_selected.isEmpty) return;
    if (!_status.ready) {
      await _showPermissionSheet();
      return;
    }
    setState(() => _busy = true);
    final next = !_enabled;
    final ok = await PrayScreenService.setEnabled(next);
    Analytics.capture(
      next ? 'pray_screen_activated' : 'pray_screen_paused',
      {
        'app_count': _selected.length,
        'ok': ok,
        'is_premium': ref.read(premiumProvider),
      },
    );
    if (mounted) setState(() { _enabled = ok ? next : false; _busy = false; });
  }

  Future<void> _unlock() async {
    final premium = ref.read(premiumProvider);
    Analytics.capture('pray_screen_unlock_started', {
      'is_premium': premium,
      'app_count': _selected.length,
    });
    if (!premium) {
      // The offer sheet is the last moment before the ad — warm it while the
      // user is reading, so an unwarmed entry point still shows instantly.
      AdsService.primeInterstitial();
      Analytics.capture('pray_screen_unlock_offer_shown');
      final proceed = await _showUnlockOffer();
      if (proceed != true) {
        Analytics.capture('pray_screen_unlock_offer_dismissed');
        return;
      }
      Analytics.capture('pray_screen_ad_requested', {
        'ad_type': 'interstitial',
      });
    }
    setState(() => _busy = true);
    final adStart = DateTime.now();
    // Short interstitial instead of a long rewarded video. The unlock always
    // proceeds — a missing or slow ad never blocks the prayer.
    const earned = true;
    if (!premium) {
      final shown = await AdsService.tryShowInterstitial(
        'pray_screen',
        force: true,
      );
      Analytics.capture('pray_screen_ad_finished', {
        'earned': earned,
        'ad_type': 'interstitial',
        'shown': shown,
        'seconds': DateTime.now().difference(adStart).inSeconds,
      });
    }
    if (earned) {
      await PrayScreenService.unlock();
      if (mounted) await _showPrayer();
      // Finishing a Sacred Pause is the most genuine "this app blessed me"
      // moment in the app — ask for the rating right here (throttled inside).
      Analytics.capture('pray_screen_prayer_completed');
      Future.delayed(
        const Duration(milliseconds: 900),
        RatingService.maybeRequestRating,
      );
    }
    if (mounted) setState(() => _busy = false);
  }

  /// Free users see exactly what happens next: a cross to walk away, a clear
  /// watch-to-unlock action, and the ad-free Pro route.
  Future<bool?> _showUnlockOffer() => showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => Container(
      padding: EdgeInsets.fromLTRB(22, 16, 22, 20 + MediaQuery.paddingOf(context).bottom),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppColors.goldBorder)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: IconButton(
              onPressed: () => Navigator.pop(context, false),
              icon: LucideIcon('x', size: 20, color: AppColors.mutedForeground),
            ),
          ),
          LucideIcon('sparkles', size: 30, color: AppColors.primary),
          const SizedBox(height: 14),
          Text(L10n.current.t('ps.offer.title'), textAlign: TextAlign.center, style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: AppColors.foreground)),
          const SizedBox(height: 10),
          Text(L10n.current.t('ps.offer.body'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13.5, height: 1.6, color: AppColors.fg(0.72))),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pop(context, true),
              icon: LucideIcon('play', size: 17, color: AppColors.primaryForeground),
              label: Text(L10n.current.t('ps.offer.watch')),
              style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, padding: const EdgeInsets.symmetric(vertical: 15)),
            ),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: () { Navigator.pop(context, false); _openPremium(); },
            child: Text(L10n.current.t('ps.offer.pro'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: AppColors.primary)),
          ),
        ],
      ),
    ),
  );

  /// The prayer takes the whole screen — nothing else to look at while the
  /// verse and prayer (both served from the backend) are read.
  Future<void> _showPrayer() {
    final pause = _pauseAt(_pauseSeed++);
    Analytics.capture('pray_screen_prayer_shown', {
      'reference': pause.reference,
      'lang': L10n.current.lang,
      'mode': BibleGateService.enabled ? 'scripture' : 'prayer',
    });
    return Navigator.of(context, rootNavigator: true).push<void>(
      PageRouteBuilder<void>(
        opaque: true,
        transitionDuration: const Duration(milliseconds: 420),
        reverseTransitionDuration: const Duration(milliseconds: 260),
        // Pro pauses open the Scripture Gate unless the user chose prayers.
        pageBuilder: (_, __, ___) => ScriptureGateScreen(initialBible: BibleGateService.enabled && ref.read(premiumProvider), pause: pause),
        transitionsBuilder: (_, animation, __, child) => FadeTransition(
          opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
          child: child,
        ),
      ),
    );
  }

  /// Scripture Gate showcase: Pro reads live (progress saved), free previews.
  /// The gate opens its own paywall on top and turns live the moment Pro lands.
  Future<void> _openScriptureGate(bool premium) async {
    Analytics.capture('scripture_gate_card_tapped', {'is_premium': premium});
    await Navigator.of(context, rootNavigator: true).push<void>(PageRouteBuilder<void>(
      opaque: true,
      transitionDuration: const Duration(milliseconds: 420),
      pageBuilder: (_, __, ___) => const ScriptureGateScreen(showcase: true),
      transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: child),
    ));
    if (mounted) setState(() {});
  }

  /// Two taps, in order. Each row opens the exact Android page it needs and
  /// ticks itself green when the user comes back.
  Future<void> _showPermissionSheet() async {
    Analytics.capture('pray_screen_permission_sheet_shown', {
      'usage_allowed': _status.usageAllowed,
      'overlay_allowed': _status.overlayAllowed,
      'app_count': _selected.length,
    });
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => ValueListenableBuilder<int>(
        valueListenable: _permissionTick,
        builder: (context, _, __) {
          final l = L10n.current;
          // Opening the Android page is all we do here — the lifecycle
          // observer re-reads the status when the user comes back, so a
          // granted permission ticks green without another tap.
          Future<void> after(String permission, Future<void> Function() action) async {
            Analytics.capture('pray_screen_permission_opened', {
              'permission': permission,
            });
            _openedPermission = permission;
            await action();
            _pollPermissions();
          }

          return Container(
            padding: EdgeInsets.fromLTRB(22, 24, 22, 24 + MediaQuery.paddingOf(context).bottom),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.t('ps.perm.title'), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.foreground)),
              const SizedBox(height: 8),
              Text('${l.t('ps.perm.sub')}\n${l.t('ps.perm.hint')}', style: TextStyle(fontSize: 13, height: 1.5, color: AppColors.fg(0.6))),
              const SizedBox(height: 20),
              _PermissionRow(step: '1', title: l.t('ps.perm.usage'), subtitle: l.t('ps.perm.usageSub'), done: _status.usageAllowed, onTap: () => after('usage_access', PrayScreenService.openUsageAccess)),
              const SizedBox(height: 10),
              _PermissionRow(step: '2', title: l.t('ps.perm.overlay'), subtitle: l.t('ps.perm.overlaySub'), done: _status.overlayAllowed, onTap: () => after('display_over_apps', PrayScreenService.openOverlayAccess)),
              if (_status.ready && !_batteryOk) ...[
                const SizedBox(height: 10),
                _PermissionRow(step: '3', title: l.t('ps.perm.battery'), subtitle: l.t('ps.perm.batterySub'), done: _batteryOk, onTap: () => after('battery_unrestricted', PrayScreenService.openBatterySettings)),
              ],
              const SizedBox(height: 18),
              SizedBox(width: double.infinity, child: FilledButton(onPressed: _status.ready ? () => Navigator.pop(sheetContext) : null, style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, padding: const EdgeInsets.symmetric(vertical: 15)), child: Text(_status.ready ? l.t('ps.perm.done') : l.t('ps.perm.waiting')))),
            ]),
          );
        },
      ),
    );
    await _refresh();
    await _loadApps();
  }

  void _openPremium() {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (sheetContext) => PremiumSheet(trigger: 'pray_screen', onClose: () => Navigator.pop(sheetContext), onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked()));
  }

  Future<void> _showAppPicker() async {
    var query = '';
    Analytics.capture('pray_screen_app_picker_opened', {
      'installed_count': _apps.length,
      'app_count': _selected.length,
    });
    final l = L10n.current;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          final visible = _apps.where((app) => app.name.toLowerCase().contains(query.toLowerCase())).toList(growable: false);
          return Container(
            height: MediaQuery.sizeOf(context).height * .78,
            padding: EdgeInsets.fromLTRB(18, 22, 18, 16 + MediaQuery.paddingOf(context).bottom),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(28)), border: Border(top: BorderSide(color: AppColors.goldBorder))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.t('ps.apps.title'), style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: AppColors.foreground)),
              const SizedBox(height: 5),
              Text(l.t('ps.apps.subtitle'), style: TextStyle(fontSize: 12, color: AppColors.fg(.55))),
              const SizedBox(height: 15),
              TextField(onChanged: (value) => setSheetState(() => query = value), style: TextStyle(color: AppColors.foreground), decoration: InputDecoration(prefixIcon: Icon(Icons.search, color: AppColors.mutedForeground), hintText: l.t('ps.apps.search'), hintStyle: TextStyle(color: AppColors.mutedForeground), filled: true, fillColor: AppColors.secondary, border: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: AppColors.border)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: BorderSide(color: AppColors.border)))),
              const SizedBox(height: 10),
              Expanded(child: ListView.builder(itemCount: visible.length, itemBuilder: (context, index) {
                final app = visible[index];
                final selected = _selected.contains(app.packageName);
                return InkWell(onTap: () async { await _toggleApp(app); setSheetState(() {}); }, borderRadius: BorderRadius.circular(13), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7), child: Row(children: [_PhoneAppIcon(app: app, size: 40), const SizedBox(width: 12), Expanded(child: Text(app.name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground))), Container(width: 25, height: 25, decoration: BoxDecoration(shape: BoxShape.circle, color: selected ? AppColors.primary : Colors.transparent, border: Border.all(color: selected ? AppColors.primary : AppColors.border)), child: selected ? LucideIcon('check', size: 14, color: AppColors.primaryForeground) : null)])));
              })),
            ]),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<int>(prayScreenLaunchTokenProvider, (_, token) {
      if (token <= _handledLaunchToken || _busy) return;
      _handledLaunchToken = token;
      // Real unlock intent from the native Shield — request the ad now.
      _maybePrimeAd();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _unlock();
      });
    });
    // Pro lapsed while the screen was open → fall back to the free 2-app cap.
    ref.listen<bool>(premiumProvider, (_, isPro) {
      if (!isPro) _enforceFreeLimit();
    });
    final premium = ref.watch(premiumProvider);
    final l = L10n.current;
    final until = PrayScreenService.unblockUntil;
    final unlocked = until > DateTime.now().millisecondsSinceEpoch;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.background, foregroundColor: AppColors.foreground, title: Text(l.t('nav.prayscreen'))),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 132 + MediaQuery.paddingOf(context).bottom),
          children: [
            Row(children: [
              Container(width: 42, height: 42, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), shape: BoxShape.circle, border: Border.all(color: AppColors.goldBorder)), child: LucideIcon('shield', size: 22, color: AppColors.primary)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('PrayScreen', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.foreground)), Text(l.t('ps.tagline'), style: TextStyle(fontSize: 11, color: AppColors.fg(0.5)))])),
              Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5), decoration: BoxDecoration(color: (_enabled ? AppColors.primary : AppColors.muted).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99), border: Border.all(color: _enabled ? AppColors.goldBorder : AppColors.border)), child: Text(_enabled ? l.t('ps.active') : l.t('ps.paused'), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: _enabled ? AppColors.primary : AppColors.mutedForeground))),
            ]),
            const SizedBox(height: 22),
            Container(
              padding: const EdgeInsets.all(20),
              // Web uses `radial-gradient(130% 90% at 50% 0%)` — the old
              // top-left → bottom-right linear sweep is what made the Flutter
              // card look like a harsh gold diagonal instead of the clean glow.
              decoration: BoxDecoration(gradient: RadialGradient(center: const Alignment(0, -1), radius: 1.3, colors: AppColors.tileGradient, stops: AppColors.tileGradientStops), borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.tileBorder), boxShadow: AppColors.tileShadow),
              child: Column(children: [
                Container(width: 70, height: 70, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.1), border: Border.all(color: AppColors.primary.withValues(alpha: 0.35))), child: LucideIcon(unlocked ? 'check' : 'shield', size: 34, color: AppColors.primary)),
                const SizedBox(height: 15),
                Text(unlocked ? l.t('ps.hero.open.title') : (_enabled ? l.t('ps.hero.on.title') : l.t('ps.hero.off.title')), textAlign: TextAlign.center, style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, color: AppColors.foreground)),
                const SizedBox(height: 7),
                Text(unlocked ? l.t('ps.hero.open.sub') : (_enabled ? l.t('ps.hero.on.sub') : l.t('ps.hero.off.sub')), textAlign: TextAlign.center, style: TextStyle(fontSize: 12, height: 1.5, color: AppColors.fg(0.58))),
                if (unlocked) TextButton(onPressed: _busy ? null : () async { await PrayScreenService.forceGuard(); if (mounted) setState(() {}); }, child: Text(l.t('ps.hero.guardAgain'), style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary))),
                if (!_status.ready && _selected.isNotEmpty) Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: InkWell(
                    onTap: _showPermissionSheet,
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.goldBorder)),
                      child: Row(children: [
                        LucideIcon('shield-alert', size: 19, color: AppColors.primary),
                        const SizedBox(width: 10),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(l.t('ps.setup.title'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: AppColors.foreground)),
                          Text(l.t('ps.setup.sub'), style: TextStyle(fontSize: 10.5, height: 1.35, color: AppColors.fg(0.6))),
                        ])),
                        LucideIcon('chevron-right', size: 18, color: AppColors.primary),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 16),
            const SizedBox(height: 22),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(l.t('ps.apps.top'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.4, color: AppColors.fg(0.65))), if (!premium) Text(l.t('ps.apps.free'), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.primary))]),
            const SizedBox(height: 10),
            Builder(builder: (_) {
              final top = PrayScreenService.topApps(_apps);
              return Row(children: [for (var i = 0; i < math.min(4, top.length); i++) Expanded(child: Padding(padding: EdgeInsets.only(right: i < 3 ? 7 : 0), child: _TopAppTile(app: top[i], selected: _selected.contains(top[i].packageName), locked: !premium && !_selected.contains(top[i].packageName) && _selected.length >= 2, onTap: () => _toggleApp(top[i]))))]);
            }),
            const SizedBox(height: 10),
            InkWell(onTap: _showAppPicker, borderRadius: BorderRadius.circular(13), child: Container(height: 50, padding: const EdgeInsets.symmetric(horizontal: 14), decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(13), border: Border.all(color: AppColors.border)), child: Row(children: [LucideIcon('search', size: 17, color: AppColors.primary), const SizedBox(width: 10), Expanded(child: Text(l.t('ps.apps.choose'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.foreground))), LucideIcon('chevron-right', size: 17, color: AppColors.mutedForeground)]))),
            const SizedBox(height: 18),
            _ScriptureGateCard(
              premium: premium,
              onTap: () => _openScriptureGate(premium),
              onModeChanged: (bible) async {
                if (bible && !premium) { Analytics.capture('scripture_gate_bible_locked'); _openPremium(); return; }
                await BibleGateService.setEnabled(bible);
                await PrayScreenService.pushBlockerCopy();
                Analytics.capture('scripture_gate_mode_changed', {'mode': bible ? 'bible' : 'prayer'});
                if (mounted) setState(() {});
              },
            ),
            const SizedBox(height: 18),
            _ModeRow(icon: 'bell', title: l.t('ps.reset.title'), subtitle: l.t('ps.reset.times'), trailing: l.t('ps.reset.badge')),
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: _busy || _selected.isEmpty ? null : _toggleShield, icon: LucideIcon(_enabled ? 'pause' : 'shield', size: 18, color: _enabled ? AppColors.foreground : AppColors.primaryForeground), label: Text(_enabled ? l.t('ps.btn.off') : l.t('ps.btn.on')), style: FilledButton.styleFrom(backgroundColor: _enabled ? AppColors.secondary : AppColors.primary, foregroundColor: _enabled ? AppColors.foreground : AppColors.primaryForeground, padding: const EdgeInsets.symmetric(vertical: 16), side: _enabled ? BorderSide(color: AppColors.border) : BorderSide.none))),
            if (_enabled && _status.ready && !_status.serviceRunning) Padding(padding: const EdgeInsets.only(top: 8), child: Text(l.t('ps.battery.warn'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11, height: 1.45, color: AppColors.fg(0.55)))),
          ],
        ),
      ),
    );
  }
}

class _PhoneAppIcon extends StatelessWidget {
  const _PhoneAppIcon({required this.app, this.size = 44});
  final GuardedApp app; final double size;
  String? get _asset {
    final packageName = app.packageName;
    if (packageName.contains('instagram')) return 'assets/images/social/instagram.svg';
    if (packageName.contains('musically')) return 'assets/images/social/tiktok.svg';
    if (packageName.contains('youtube')) return 'assets/images/social/youtube.svg';
    if (packageName.contains('facebook')) return 'assets/images/social/facebook.svg';
    if (packageName.contains('snapchat')) return 'assets/images/social/snapchat.svg';
    if (packageName.contains('twitter')) return 'assets/images/social/x.svg';
    return null;
  }
  @override Widget build(BuildContext context) {
    // The web mirror only draws a tile behind the initials fallback — a real
    // app icon fills the rounded square edge to edge, which is why the Flutter
    // icons looked smaller and boxed-in next to the web screen.
    Widget? icon;
    final encodedIcon = app.iconBase64;
    if (encodedIcon != null && encodedIcon.isNotEmpty) {
      try { icon = Image.memory(base64Decode(encodedIcon), fit: BoxFit.cover, gaplessPlayback: true); } catch (_) { icon = null; }
    }
    if (icon == null && _asset != null) icon = SvgPicture.asset(_asset!, fit: BoxFit.cover);
    final radius = BorderRadius.circular(size * .28);
    if (icon != null) {
      return SizedBox(width: size, height: size, child: ClipRRect(borderRadius: radius, child: icon));
    }
    return Container(width: size, height: size, alignment: Alignment.center, padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: AppColors.secondary, borderRadius: radius, border: Border.all(color: AppColors.border)), child: Text(app.shortLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppColors.foreground)));
  }
}

class _TopAppTile extends StatelessWidget {
  const _TopAppTile({required this.app, required this.selected, required this.locked, required this.onTap});
  final GuardedApp app; final bool selected; final bool locked; final VoidCallback onTap;
  @override Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16), child: Container(height: 100, padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: selected ? AppColors.primary.withValues(alpha: .1) : AppColors.glassRaised, borderRadius: BorderRadius.circular(16), border: Border.all(color: selected ? AppColors.primary.withValues(alpha: .5) : AppColors.glassBorder)), child: Stack(alignment: Alignment.center, children: [Column(mainAxisAlignment: MainAxisAlignment.center, children: [_PhoneAppIcon(app: app), const SizedBox(height: 7), Text(app.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.foreground))]), if (selected) Positioned(right: 0, top: 0, child: CircleAvatar(radius: 10, backgroundColor: AppColors.primary, child: LucideIcon('lock', size: 10, color: AppColors.primaryForeground))), if (locked) Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: AppColors.background.withValues(alpha: .62), borderRadius: BorderRadius.circular(15)), child: Center(child: LucideIcon('lock', size: 16, color: AppColors.mutedForeground))))])));
}

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({required this.step, required this.title, required this.subtitle, required this.done, required this.onTap});
  final String step, title, subtitle; final bool done; final VoidCallback onTap;
  @override Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppColors.secondary, borderRadius: BorderRadius.circular(14), border: Border.all(color: done ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border)), child: Row(children: [Container(width: 26, height: 26, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, color: done ? AppColors.primary : AppColors.primary.withValues(alpha: 0.14)), child: done ? LucideIcon('check', size: 15, color: AppColors.primaryForeground) : Text(step, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: AppColors.primary))), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.foreground)), Text(subtitle, style: TextStyle(fontSize: 11, color: AppColors.fg(0.5)))])), LucideIcon(done ? 'check' : 'chevron-right', size: 19, color: done ? AppColors.primary : AppColors.mutedForeground)])));
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({required this.icon, required this.title, required this.subtitle, required this.trailing, this.onTap});
  final String icon, title, subtitle, trailing; final VoidCallback? onTap;
  @override Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppColors.glassRaised, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.glassBorder)), child: Row(children: [LucideIcon(icon, size: 20, color: AppColors.primary), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.foreground)), Text(subtitle, style: TextStyle(fontSize: 10.5, color: AppColors.fg(0.5)))])), Text(trailing, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.primary))])));
}
/// Full-screen Sacred Pause. A radial gold glow, the served verse, the prayer,
/// and one gold action — the same frame the web preview shows.
class _SacredPauseScreen extends StatelessWidget {
  const _SacredPauseScreen({required this.pause});
  final PrayerPause pause;

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0, -.55),
            radius: 1.15,
            colors: [
              AppColors.primary.withValues(alpha: .16),
              AppColors.background,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 18, 28, 22),
            child: Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 34),
                        LucideIcon('shield', size: 42, color: AppColors.primary),
                        const SizedBox(height: 20),
                        Text(
                          l.t('ps.prayer.kicker'),
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, letterSpacing: 2, color: AppColors.primary),
                        ),
                        const SizedBox(height: 26),
                        Text(
                          '“${pause.verse}”',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontFamily: 'Cormorant Garamond', fontSize: 30, height: 1.24, fontWeight: FontWeight.w700, color: AppColors.foreground),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          pause.reference.toUpperCase(),
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.6, color: AppColors.primary),
                        ),
                        const SizedBox(height: 30),
                        Container(width: 44, height: 1, color: AppColors.goldBorder),
                        const SizedBox(height: 30),
                        Text(
                          pause.prayer,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, height: 1.7, color: AppColors.fg(0.78)),
                        ),
                        const SizedBox(height: 34),
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.primaryForeground,
                      padding: const EdgeInsets.symmetric(vertical: 17),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    ),
                    child: Text(l.t('ps.prayer.done'), style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ScriptureGateCard extends StatelessWidget {
  const _ScriptureGateCard({required this.premium, required this.onTap, required this.onModeChanged});
  final bool premium;
  final VoidCallback onTap;
  final ValueChanged<bool> onModeChanged;

  @override
  Widget build(BuildContext context) {
    final pct = BibleGateService.percent;
    final bibleOn = BibleGateService.enabled && premium;
    Widget seg({required String label, required String icon, required String sub, required bool active, required VoidCallback tap, bool proBadge = false}) => Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: tap,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 48,
              decoration: BoxDecoration(color: active ? AppColors.primary : Colors.transparent, borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                LucideIcon(icon, size: 16, color: active ? AppColors.primaryForeground : AppColors.fg(0.7)),
                const SizedBox(width: 7),
                Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: active ? AppColors.primaryForeground : AppColors.fg(0.7))),
                const SizedBox(width: 6),
                proBadge
                    ? Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1), decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: AppColors.primary.withValues(alpha: .5))), child: Text('PRO', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w900, color: AppColors.primary)))
                    : Text(sub, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: active ? AppColors.primaryForeground.withValues(alpha: .7) : AppColors.fg(0.4))),
              ]),
            ),
          ),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(children: [
          Text(L10n.current.t('ps.mode.title'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.4, color: AppColors.fg(0.65))),
          const Spacer(),
          if (bibleOn) Text('${BibleGateService.versesRead} verses · ${pct.toStringAsFixed(1)}%', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.fg(0.5))),
        ]),
      ),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: AppColors.card.withValues(alpha: .7), borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          seg(label: L10n.current.t('ps.mode.prayer'), icon: 'bell', sub: '', active: !bibleOn, tap: () => onModeChanged(false)),
          const SizedBox(width: 4),
          seg(label: L10n.current.t('bible.title'), icon: 'book-open', sub: '', active: bibleOn, tap: () => onModeChanged(true)),
        ]),
      ),
    ]);
  }
}
