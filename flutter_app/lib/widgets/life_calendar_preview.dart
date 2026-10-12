import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/localization/app_localizations.dart';
import '../core/theme/app_colors.dart';

const _playUrl = 'https://play.google.com/store/apps/details?id=com.mylifecalendar.app';
const _wallpaper = 'https://velora-wallpapers.lovable.app/__l5e/assets-v1/326cc379-8b94-4cf9-83e3-c174427b8a45/life-calendar-wallpaper.webp';
const _install = <String, String>{'en': 'Install on Google Play', 'hi': 'Google Play से इंस्टॉल करें', 'es': 'Instalar en Google Play', 'pt': 'Instalar no Google Play', 'fil': 'I-install sa Google Play', 'id': 'Instal di Google Play', 'fr': 'Installer sur Google Play', 'de': 'Bei Google Play installieren'};

Future<void> showLifeCalendarPreview(BuildContext context, String language) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  backgroundColor: AppColors.background,
  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
  builder: (context) => SafeArea(
    top: false,
    child: ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * .9),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            ClipRRect(borderRadius: BorderRadius.circular(8), child: CachedNetworkImage(imageUrl: 'https://velora-wallpapers.lovable.app/__l5e/assets-v1/da564128-d022-4a7c-9b69-0e7bdf16839c/life-calendar-preview.webp', width: 40, height: 40, errorWidget: (_, __, ___) => Image.asset('assets/images/promo-life-calendar.png'))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Life Calendar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.foreground)),
              const SizedBox(height: 4),
              Text(t('settings.promo.title'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            ])),
            IconButton(tooltip: t('common.close'), onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
          ]),
          const SizedBox(height: 12),
          SizedBox(height: (MediaQuery.sizeOf(context).height * .42).clamp(160.0, 320.0), width: double.infinity,
            child: CachedNetworkImage(imageUrl: _wallpaper, fit: BoxFit.contain,
              placeholder: (_, __) => const Center(child: CircularProgressIndicator()),
              errorWidget: (_, __, ___) => Image.asset('assets/images/promo-life-calendar.png', fit: BoxFit.contain))),
          const SizedBox(height: 16),
          Text(t('settings.promo.desc'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, minimumSize: const Size(0, 48), shape: const StadiumBorder()),
            icon: const Icon(Icons.download_outlined, size: 18),
            label: Text(_install[language] ?? _install['en'] ?? 'Install on Google Play', textAlign: TextAlign.center),
            onPressed: () async {
              try {
                if (Theme.of(context).platform == TargetPlatform.android && await launchUrl(Uri.parse('market://details?id=com.mylifecalendar.app'), mode: LaunchMode.externalApplication)) return;
              } catch (_) { /* Fall back to verified HTTPS listing. */ }
              await launchUrl(Uri.parse(_playUrl), mode: LaunchMode.externalApplication);
            },
          )),
        ]),
      ),
    ),
  ),
);