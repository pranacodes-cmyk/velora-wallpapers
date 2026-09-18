import 'package:flutter/material.dart';

import 'legal_screen.dart';

const _email = 'pranacodes@gmail.com';
const _lastUpdated = 'April 28, 2026';
const _package = 'com.jesuswallpaperbible.app';

/// 1:1 port of `src/pages/PrivacyPolicy.tsx` — same sections, same wording.
class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return LegalScreen(
      title: 'Privacy Policy',
      lastUpdated: _lastUpdated,
      intro:
          'This Privacy Policy describes how **Prayly** ("the App", "we", "us", '
          'or "our") collects, uses, and protects information when you use our '
          'mobile application available on Google Play. By using the App you '
          'agree to this policy.',
      sections: const [
        LegalSection('1. Who we are', [
          LegalBlock.paragraph(
            'The App is published by an independent developer ("we") and is '
            'distributed via Google Play under the package name `$_package`. '
            'For any privacy-related question you can reach us at ~$_email~.',
          ),
        ]),
        LegalSection('2. Data we collect', [
          LegalBlock.paragraph(
            'We designed the App to collect as little data as possible:',
          ),
          LegalBlock.bullets([
            '**Device model, OS version, screen size, language** — to deliver '
                'wallpapers in the right resolution. Not linked to you.',
            '**Anonymous usage analytics** (screens viewed, wallpapers '
                'downloaded, taps) — to improve performance. Not linked to you.',
            '**Crash logs and diagnostics** — to detect and fix bugs. Not '
                'linked to you.',
            '**Advertising ID** — to serve ads via Google AdMob in the free '
                'version. Pseudonymous.',
            '**Purchase token** — to verify in-app purchases via Google Play '
                'Billing. Held by Google.',
            '**Email you send to support** — to reply to your request. Linked '
                'to you.',
          ]),
          LegalBlock.paragraph(
            '**We do NOT collect:** your name, phone number, precise location, '
            'contacts, photos, files on your device, microphone, camera, or any '
            'health, financial, or biometric data.',
          ),
        ]),
        LegalSection('3. Permissions we request', [
          LegalBlock.bullets([
            '**INTERNET** — download wallpapers and updates.',
            '**SET_WALLPAPER** — apply images and live wallpapers to your '
                'home/lock screen.',
            '**FOREGROUND_SERVICE / BIND_WALLPAPER** — run live wallpaper '
                'engines.',
            '**VIBRATE** — provide subtle haptic feedback on taps.',
            '**POST_NOTIFICATIONS** (Android 13+) — optional daily verse / '
                'prayer reminders. You can disable this at any time in system '
                'settings.',
            '**com.android.vending.BILLING** — process in-app purchases '
                'through Google Play.',
          ]),
          LegalBlock.paragraph(
            'The App does **not** request location, camera, microphone, '
            'contacts, or SMS permissions.',
          ),
        ]),
        LegalSection('4. How we use the data', [
          LegalBlock.bullets([
            'Operate, maintain, and improve the App.',
            'Personalise the experience (favourites, streaks — stored locally '
                'on your device).',
            'Show advertisements in the free version through Google AdMob.',
            'Process and verify in-app purchases through Google Play Billing.',
            'Diagnose crashes and prevent fraud or abuse.',
            'Reply to support enquiries you send us.',
          ]),
          LegalBlock.paragraph(
            'We never sell your personal information. We never use your data '
            'for credit, lending, employment, insurance, or housing decisions.',
          ),
        ]),
        LegalSection('5. Advertising (Google AdMob)', [
          LegalBlock.paragraph(
            'The free version of the App displays banner, interstitial, and '
            'rewarded ads served by Google AdMob. AdMob may collect and process '
            'the Android Advertising ID, IP address, and ad-interaction events '
            'to deliver and measure ads. See Google\'s privacy policy at '
            'policies.google.com/privacy for full details.',
          ),
          LegalBlock.paragraph(
            'You can reset or limit ad personalisation any time via *Settings → '
            'Google → Ads* on your Android device.',
          ),
        ]),
        LegalSection('6. In-app purchases', [
          LegalBlock.paragraph(
            'Premium content is unlocked through Google Play Billing. We never '
            'see or store your payment card details — Google handles the '
            'transaction. We only receive a purchase token used to verify '
            'entitlement.',
          ),
        ]),
        LegalSection('7. Data storage & security', [
          LegalBlock.paragraph(
            'Your favourites, streaks, downloaded wallpapers, and preferences '
            'are stored **locally on your device**. Wallpaper assets are served '
            'from Cloudflare\'s global CDN over encrypted HTTPS/TLS '
            'connections. Anonymous analytics and crash logs are transmitted '
            'over HTTPS and retained no longer than 90 days.',
          ),
        ]),
        LegalSection('8. Data sharing', [
          LegalBlock.paragraph(
            'We share data only with the following service providers, strictly '
            'for the purposes listed above:',
          ),
          LegalBlock.bullets([
            '**Google AdMob** — advertising',
            '**Google Play Billing** — purchase processing',
            '**Cloudflare** — content delivery and DDoS protection',
            '**Supabase** — anonymous analytics & backend hosting',
          ]),
          LegalBlock.paragraph(
            'We may disclose information if required by law, valid legal '
            'process, or to protect the rights, property, or safety of our '
            'users or others.',
          ),
        ]),
        LegalSection('9. Your rights (GDPR, CCPA & others)', [
          LegalBlock.paragraph(
            'Depending on where you live you have the right to access, correct, '
            'or delete your personal data; object to or restrict certain '
            'processing; withdraw consent for personalised advertising; and '
            'lodge a complaint with your local data-protection authority. To '
            'exercise any of these rights email us at ~$_email~.',
          ),
        ]),
        LegalSection('10. Children\'s privacy', [
          LegalBlock.paragraph(
            'The App is rated for **general audiences (3+)** and is not '
            'directed to children under 13. We do not knowingly collect '
            'personal information from children. If you believe a child has '
            'provided us data, contact us and we will delete it immediately.',
          ),
        ]),
        LegalSection('11. International data transfers', [
          LegalBlock.paragraph(
            'Our service providers may process data in the United States, '
            'European Union, or other regions. Where required, transfers are '
            'protected by Standard Contractual Clauses or equivalent '
            'safeguards.',
          ),
        ]),
        LegalSection('12. Data retention', [
          LegalBlock.paragraph(
            'Anonymous analytics and crash logs: up to 90 days. Support emails: '
            'up to 24 months after the issue is resolved. Local data on your '
            'device persists until you uninstall the App or clear its storage.',
          ),
        ]),
        LegalSection('13. Account & data deletion', [
          LegalBlock.paragraph(
            'The App does not require an account. To remove all locally stored '
            'data, uninstall the App or use *Settings → Apps → Prayly → Storage '
            '→ Clear data*. To request deletion of any server-side anonymous '
            'identifiers tied to your device, email us at ~$_email~. We respond '
            'within 30 days.',
          ),
        ]),
        LegalSection('14. Changes to this policy', [
          LegalBlock.paragraph(
            'We may update this Privacy Policy from time to time. Material '
            'changes will be communicated via an in-app notice. The "Last '
            'updated" date at the top of this page always reflects the latest '
            'version.',
          ),
        ]),
        LegalSection('15. Contact us', [
          LegalBlock.paragraph(
            'For privacy questions, data requests, or any other concern please '
            'email:',
          ),
          LegalBlock.paragraph('~$_email~'),
          LegalBlock.paragraph(
            'We respond to legitimate requests within 30 days.',
          ),
        ]),
      ],
    );
  }
}
