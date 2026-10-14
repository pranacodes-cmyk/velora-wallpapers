import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/daily_reminder_service.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/services/share_service.dart';
import '../../core/services/user_profile.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../../widgets/screen_scaffold.dart';
import '../favorites/favorites_screen.dart';
import '../bible_reader/bible_reader_screen.dart';
import '../legal/privacy_policy_screen.dart';
import '../legal/terms_screen.dart';
import '../today/today_shared.dart';
import '../today/prayer_alarm_toggles.dart';
import '../pray_screen/pray_screen_screen.dart';

/// 1:1 port of `src/pages/Settings.tsx`.
///
/// Same sections in the same order (premium card, profile, appearance,
/// language, library, more from us, support, legal, about, footer), same
/// copy keys, same glass card styling and the same side effects.
const _lifeCalendarUrl =
    'https://play.google.com/store/apps/details?id=com.mylifecalendar.app';
const _supportEmail = 'pranacodes@gmail.com';
const _playStoreUrl =
    'https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app';
const _appVersionFallback = '1.0';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  String _appVersion = _appVersionFallback;
  bool _showAbout = false;
  bool _editingName = false;
  bool _adPrefsAvailable = false;
  late TextEditingController _nameCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: UserProfile.name() ?? '');
    _loadVersion();
    _loadAdPrefs();
  }

  Future<void> _loadAdPrefs() async {
    final available = await AdsService.isPrivacyOptionsRequired();
    if (mounted && available) setState(() => _adPrefsAvailable = true);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      // e.g. "1.0 (1163)" — matches Play's versionName + versionCode, same
      // format the web build renders from `App.getInfo()`.
      if (mounted) {
        setState(() {
          _appVersion = info.buildNumber.isEmpty
              ? info.version
              : '${info.version} (${info.buildNumber})';
        });
      }
    } catch (_) {
      /* keep fallback */
    }
  }

  Future<void> _open(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      /* ignore — same silent behaviour as window.open failing on web */
    }
  }

  void _saveName() {
    final trimmed = _nameCtrl.text.trim();
    final capped = trimmed.length > 24 ? trimmed.substring(0, 24) : trimmed;
    if (capped.length < 2) {
      AppToast.error(context, t('settings.profile.tooShort'));
      return;
    }
    UserProfile.setName(capped);
    ref.read(userNameProvider.notifier).state = capped;
    setState(() => _editingName = false);
    haptic(HapticStyle.medium);
    AppToast.success(context, t('settings.profile.updated'));
  }

  void _openPremiumSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PremiumSheet(
        trigger: 'settings',
        onClose: () => Navigator.of(sheetContext).maybePop(),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
  }

  Future<void> _restore() async {
    AppToast.success(context, t('settings.restore.loading'));
    try {
      final ok = await ref.read(premiumProvider.notifier).restore();
      if (!mounted) return;
      if (ok) {
        AppToast.success(context, t('settings.restore.success'));
      } else {
        AppToast.success(context, t('settings.restore.none'));
      }
    } catch (_) {
      if (mounted) AppToast.error(context, t('settings.restore.error'));
    }
  }

  Future<void> _deleteData() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(
          t('settings.delete'),
          style: TextStyle(fontSize: 16, color: AppColors.foreground),
        ),
        content: Text(
          t('settings.delete.confirm'),
          style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(t('common.cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(t('common.continue')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      // Preserve the theme preference; wipe everything else (same as web).
      final theme = Prefs.getString('cw-theme');
      await Prefs.clearExcept(const {'cw-theme'});
      if (theme != null) await Prefs.setString('cw-theme', theme);
      ChallengeStore.reload();
      ProJourneyStore.reload();
      if (mounted) AppToast.success(context, t('settings.delete.success'));
    } catch (_) {
      if (mounted) AppToast.error(context, t('settings.delete.error'));
    }
    await _open(
      'mailto:$_supportEmail?subject=Data%20Deletion%20Request'
      '&body=Please%20delete%20any%20anonymous%20identifiers%20associated%20with%20my%20device.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final lang = ref.watch(languageProvider);
    final themeMode = ref.watch(themeModeProvider);
    final name = ref.watch(userNameProvider);

    return Container(
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 112),
          children: [
            // ---------------- Header ----------------
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
              decoration: BoxDecoration(
                color: AppColors.glass,
                border: Border(
                  bottom: BorderSide(color: AppColors.glassBorder),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t('settings.title'),
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.4,
                            color: AppColors.foreground,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          t('settings.subtitle'),
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TapScale(
                    scale: 0.92,
                    onTap: () {
                      haptic(HapticStyle.soft);
                      Navigator.of(context).maybePop();
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.muted.withValues(alpha: 0.5),
                      ),
                      child: LucideIcon(
                        'x',
                        size: 18,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ---------------- Premium card ----------------
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 20, 12, 20),
              child: TapScale(
                onTap: () {
                  haptic(HapticStyle.medium);
                  if (!isPremium) _openPremiumSheet();
                },
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: isPremium
                        ? LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [AppColors.glassRaised, AppColors.card],
                          )
                        : null,
                    color: isPremium ? null : AppColors.glass,
                    border: Border.all(
                      color: isPremium
                          ? AppColors.primary.withValues(alpha: 0.25)
                          : AppColors.glassBorder,
                    ),
                    boxShadow: isPremium
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.5),
                              blurRadius: 24,
                              offset: const Offset(0, 6),
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [AppColors.primary, AppColors.accent],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.4),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: LucideIcon(
                          'crown',
                          size: 20,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isPremium
                                  ? t('settings.premium.active')
                                  : t('settings.premium.go'),
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: isPremium
                                    ? AppColors.primary
                                    : AppColors.foreground,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isPremium
                                  ? t('settings.premium.activeDesc')
                                  : t('settings.premium.goDesc'),
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: isPremium
                              ? AppColors.primary.withValues(alpha: 0.12)
                              : null,
                          gradient: isPremium
                              ? null
                              : LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [AppColors.primary, AppColors.accent],
                                ),
                          border: isPremium
                              ? Border.all(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.2,
                                  ),
                                )
                              : null,
                        ),
                        child: Text(
                          isPremium
                              ? t('settings.premium.badgePro')
                              : t('settings.premium.badgeUpgrade'),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: isPremium ? AppColors.primary : Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ---------------- Profile ----------------
            _Section(
              title: t('settings.section.profile'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: AppColors.primary.withValues(alpha: 0.15),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        size: 18,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('settings.profile.yourName'),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.4,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                          if (_editingName)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: TextField(
                                controller: _nameCtrl,
                                autofocus: true,
                                maxLength: 24,
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => _saveName(),
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.foreground,
                                ),
                                decoration: InputDecoration(
                                  isDense: true,
                                  counterText: '',
                                  hintText: t('settings.profile.placeholder'),
                                  hintStyle: TextStyle(
                                    fontSize: 14,
                                    color: AppColors.mutedForeground,
                                  ),
                                  contentPadding: const EdgeInsets.only(
                                    bottom: 4,
                                  ),
                                  enabledBorder: UnderlineInputBorder(
                                    borderSide: BorderSide(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.4,
                                      ),
                                    ),
                                  ),
                                  focusedBorder: UnderlineInputBorder(
                                    borderSide: BorderSide(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.4,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            )
                          else
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                name.trim().isNotEmpty
                                    ? name.trim()
                                    : t('settings.profile.notSet'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.foreground,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (_editingName)
                      Row(
                        children: [
                          TapScale(
                            scale: 0.92,
                            onTap: () {
                              haptic(HapticStyle.soft);
                              _nameCtrl.text = name;
                              setState(() => _editingName = false);
                            },
                            child: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.muted.withValues(alpha: 0.4),
                              ),
                              child: LucideIcon(
                                'x',
                                size: 16,
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          TapScale(
                            scale: 0.92,
                            onTap: _saveName,
                            child: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primary,
                              ),
                              child: LucideIcon(
                                'check',
                                size: 16,
                                color: hsl(220, 65, 8),
                              ),
                            ),
                          ),
                        ],
                      )
                    else
                      TapScale(
                        scale: 0.94,
                        onTap: () {
                          haptic(HapticStyle.soft);
                          _nameCtrl.text = name;
                          setState(() => _editingName = true);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: AppColors.primary.withValues(alpha: 0.12),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Text(
                            t('settings.profile.edit'),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ---------------- Appearance ----------------
            _Section(
              title: t('settings.section.appearance'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('settings.theme'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        for (final opt
                            in <
                              ({ThemeMode mode, String label, IconData icon})
                            >[
                              (
                                mode: ThemeMode.system,
                                label: t('settings.theme.system'),
                                icon: Icons.desktop_windows_rounded,
                              ),
                              (
                                mode: ThemeMode.light,
                                label: t('settings.theme.light'),
                                icon: Icons.wb_sunny_rounded,
                              ),
                              (
                                mode: ThemeMode.dark,
                                label: t('settings.theme.dark'),
                                icon: Icons.nightlight_round,
                              ),
                            ])
                          Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(
                                right: opt.mode == ThemeMode.dark ? 0 : 8,
                              ),
                              child: TapScale(
                                scale: 0.95,
                                onTap: () {
                                  haptic(HapticStyle.soft);
                                  ref
                                      .read(themeModeProvider.notifier)
                                      .change(opt.mode);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(16),
                                    color: themeMode == opt.mode
                                        ? AppColors.primary.withValues(
                                            alpha: 0.15,
                                          )
                                        : AppColors.muted.withValues(
                                            alpha: 0.3,
                                          ),
                                    border: themeMode == opt.mode
                                        ? Border.all(
                                            color: AppColors.primary.withValues(
                                              alpha: 0.3,
                                            ),
                                          )
                                        : null,
                                  ),
                                  child: Column(
                                    children: [
                                      Icon(
                                        opt.icon,
                                        size: 20,
                                        color: themeMode == opt.mode
                                            ? AppColors.primary
                                            : AppColors.mutedForeground,
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        opt.label,
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: themeMode == opt.mode
                                              ? AppColors.primary
                                              : AppColors.mutedForeground,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ---------------- Language ----------------
            _Section(
              title: t('settings.section.language'),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('settings.language'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.foreground,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      t('settings.language.desc'),
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.4,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 3.6,
                      children: [
                        for (final opt in kLanguages)
                          TapScale(
                            scale: 0.96,
                            onTap: () async {
                              if (lang == opt.code) return;
                              haptic(HapticStyle.soft);
                              await ref
                                  .read(languageProvider.notifier)
                                  .change(opt.code);
                              if (!mounted) return;
                              AppToast.success(
                                context,
                                t('settings.language.changed'),
                              );
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                color: lang == opt.code
                                    ? AppColors.primary.withValues(alpha: 0.15)
                                    : AppColors.muted.withValues(alpha: 0.3),
                                border: lang == opt.code
                                    ? Border.all(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.3,
                                        ),
                                      )
                                    : null,
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    opt.flag,
                                    style: const TextStyle(fontSize: 15),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      opt.native,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                        color: lang == opt.code
                                            ? AppColors.primary
                                            : AppColors.foreground.withValues(
                                                alpha: 0.8,
                                              ),
                                      ),
                                    ),
                                  ),
                                  if (lang == opt.code)
                                    LucideIcon(
                                      'check',
                                      size: 14,
                                      color: AppColors.primary,
                                    ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ---------------- Daily Prayer Reminder ----------------
            _Section(
              title: t('reminder.section'),
              child: ValueListenableBuilder<int>(
                valueListenable: DailyReminder.revision,
                builder: (context, _, _) {
                  final on = DailyReminder.enabled;
                  return _Row(
                    icon: Icons.wb_twilight_rounded,
                    iconColor: AppColors.primary,
                    label: t('reminder.settings.title'),
                    desc: t('reminder.settings.desc'),
                    onTap: () => DailyReminder.setEnabled(!on),
                    trailing: Switch.adaptive(
                      value: on,
                      activeTrackColor: AppColors.primary,
                      onChanged: (v) => DailyReminder.setEnabled(v),
                    ),
                  );
                },
              ),
            ),

            const PrayerAlarmToggles(),
            _Section(
              title: t('nav.prayscreen'),
              child: _Row(
                icon: Icons.shield_outlined,
                iconColor: AppColors.primary,
                label: t('nav.prayscreen'),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PrayScreenScreen())),
              ),
            ),

            // ---------------- My Library ----------------
            _Section(
              title: t('bible.title'),
              child: _Row(icon: Icons.menu_book, iconColor: AppColors.primary, label: t('bible.read'), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const BibleReaderScreen()))),
            ),
            _Section(
              title: t('settings.section.library'),
              child: _Row(
                icon: Icons.favorite_rounded,
                iconColor: hsl(0, 70, 60),
                label: t('settings.saved'),
                desc: t('settings.savedDesc'),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                ),
              ),
            ),

            // ---------------- More from us ----------------
            _Section(
              title: t('settings.section.more'),
              child: TapScale(
                onTap: () {
                  haptic(HapticStyle.medium);
                  _open(_lifeCalendarUrl);
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: hsl(35, 90, 55, 0.35),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.asset(
                          'assets/images/promo-life-calendar.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    t('settings.promo.title'),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.foreground,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(6),
                                    color: hsl(35, 90, 55, 0.18),
                                  ),
                                  child: Text(
                                    t('settings.promo.badge'),
                                    style: TextStyle(
                                      fontSize: 8,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                      color: hsl(35, 90, 55),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              t('settings.promo.desc'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 14,
                        color: AppColors.mutedForeground.withValues(alpha: 0.4),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ---------------- Support ----------------
            _Section(
              title: t('settings.section.support'),
              child: Column(
                children: [
                  _Row(
                    icon: Icons.star_rounded,
                    iconColor: AppColors.primary,
                    label: t('settings.rate'),
                    desc: t('settings.rateDesc'),
                    trailing: _externalIcon,
                    onTap: () => _open(_playStoreUrl),
                  ),
                  const _Divider(),
                  _Row(
                    icon: Icons.ios_share_rounded,
                    iconColor: hsl(160, 55, 45),
                    label: t('settings.share'),
                    desc: t('settings.shareDesc'),
                    trailing: const SizedBox.shrink(),
                    onTap: () => ShareService.share(
                      title: t('share.title'),
                      text: t('share.text'),
                      url: _playStoreUrl,
                      dialogTitle: t('share.dialogTitle'),
                    ),
                  ),
                  const _Divider(),
                  _Row(
                    icon: Icons.restore_rounded,
                    iconColor: hsl(45, 90, 55),
                    label: t('settings.restore'),
                    desc: t('settings.restoreDesc'),
                    onTap: _restore,
                  ),
                  const _Divider(),
                  _Row(
                    icon: Icons.mail_rounded,
                    iconColor: hsl(200, 65, 50),
                    label: t('settings.contact'),
                    desc: t('settings.contactDesc'),
                    trailing: _externalIcon,
                    onTap: () => _open('mailto:$_supportEmail'),
                  ),
                ],
              ),
            ),

            // ---------------- Legal ----------------
            _Section(
              title: t('settings.section.legal'),
              child: Column(
                children: [
                  _Row(
                    icon: Icons.shield_rounded,
                    iconColor: AppColors.mutedForeground,
                    label: t('settings.privacy'),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const PrivacyPolicyScreen(),
                      ),
                    ),
                  ),
                  const _Divider(),
                  _Row(
                    icon: Icons.description_rounded,
                    iconColor: AppColors.mutedForeground,
                    label: t('settings.terms'),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TermsScreen()),
                    ),
                  ),
                  if (_adPrefsAvailable && !isPremium) ...[
                    const _Divider(),
                    _Row(
                      icon: Icons.tune_rounded,
                      iconColor: hsl(200, 65, 50),
                      label: t('settings.adPrefs'),
                      desc: t('settings.adPrefsDesc'),
                      onTap: () async {
                        final shown = await AdsService.showPrivacyOptionsForm();
                        if (!shown && mounted) {
                          AppToast.error(context, t('settings.adPrefs.error'));
                        }
                      },
                    ),
                  ],
                  const _Divider(),
                  _Row(
                    icon: Icons.delete_rounded,
                    iconColor: hsl(0, 65, 55),
                    label: t('settings.delete'),
                    desc: t('settings.deleteDesc'),
                    onTap: _deleteData,
                  ),
                ],
              ),
            ),

            // ---------------- About ----------------
            _Section(
              title: t('settings.section.about'),
              child: Column(
                children: [
                  _Row(
                    icon: Icons.info_rounded,
                    iconColor: AppColors.primary,
                    label: t('settings.about'),
                    desc: t('settings.version', {'version': _appVersion}),
                    trailing: AnimatedRotation(
                      turns: _showAbout ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: AppColors.mutedForeground.withValues(alpha: 0.4),
                      ),
                    ),
                    onTap: () => setState(() => _showAbout = !_showAbout),
                  ),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOut,
                    child: _showAbout
                        ? Padding(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                            child: Text(
                              t('settings.aboutBody'),
                              style: TextStyle(
                                fontSize: 10,
                                height: 1.6,
                                color: AppColors.mutedForeground.withValues(
                                  alpha: 0.6,
                                ),
                              ),
                            ),
                          )
                        : const SizedBox(width: double.infinity, height: 0),
                  ),
                ],
              ),
            ),

            // ---------------- Footer ----------------
            Padding(
              padding: const EdgeInsets.only(top: 24, bottom: 32),
              child: Column(
                children: [
                  Text(
                    'Prayly v$_appVersion',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: AppColors.mutedForeground.withValues(alpha: 0.3),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 16,
                        height: 1,
                        color: AppColors.primary.withValues(alpha: 0.2),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        t('settings.madeBy'),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                          color: AppColors.primary.withValues(alpha: 0.6),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '✝︎',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.primary.withValues(alpha: 0.7),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 16,
                        height: 1,
                        color: AppColors.primary.withValues(alpha: 0.2),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    t('settings.tagline'),
                    style: TextStyle(
                      fontSize: 9,
                      fontStyle: FontStyle.italic,
                      color: AppColors.mutedForeground.withValues(alpha: 0.25),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget get _externalIcon => Icon(
  Icons.open_in_new_rounded,
  size: 14,
  color: AppColors.mutedForeground.withValues(alpha: 0.4),
);

/// `SettingSection` — 10px uppercase label + glass card with 20px radius.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 20, right: 20, bottom: 6),
            child: Text(
              title.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.4,
                color: AppColors.mutedForeground,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: AppColors.glass,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

/// `SettingRow` — 36px tinted icon tile, 13px label, 10px description.
class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.label,
    required this.onTap,
    this.desc,
    this.iconColor,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? desc;
  final Color? iconColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tint = iconColor ?? AppColors.mutedForeground;
    return TapScale(
      scale: 0.99,
      onTap: () {
        haptic(HapticStyle.soft);
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: tint.withValues(alpha: 0.08),
              ),
              child: Icon(icon, size: 18, color: tint),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.foreground,
                    ),
                  ),
                  if (desc != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        desc!,
                        style: TextStyle(
                          fontSize: 10,
                          height: 1.35,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            trailing ??
                Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: AppColors.mutedForeground.withValues(alpha: 0.4),
                ),
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) => Container(
    height: 0.5,
    margin: const EdgeInsets.symmetric(horizontal: 16),
    color: AppColors.border.withValues(alpha: 0.15),
  );
}
