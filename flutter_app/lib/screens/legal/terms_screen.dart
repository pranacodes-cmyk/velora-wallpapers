import 'package:flutter/material.dart';

import 'legal_screen.dart';

const _email = 'pranacodes@gmail.com';
const _lastUpdated = 'April 28, 2026';

/// 1:1 port of `src/pages/TermsOfService.tsx` — same sections, same wording.
class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return LegalScreen(
      title: 'Terms of Service',
      lastUpdated: _lastUpdated,
      sections: const [
        LegalSection('1. Acceptance of Terms', [
          LegalBlock.paragraph(
            'By downloading, installing, or using Prayly ("the App"), you agree '
            'to be bound by these Terms of Service ("Terms"). If you do not '
            'agree, please do not use the App.',
          ),
        ]),
        LegalSection('2. Description of Service', [
          LegalBlock.paragraph(
            'The App provides curated Christian-themed static and live '
            'wallpapers, daily Bible verses, prayers, and faith-based '
            'devotional content for Android devices.',
          ),
        ]),
        LegalSection('3. Eligibility', [
          LegalBlock.paragraph(
            'You must be at least 13 years of age to use this App. If you are '
            'under 18, you must have permission from a parent or legal '
            'guardian. The App is rated for general audiences (3+) on Google '
            'Play.',
          ),
        ]),
        LegalSection('4. Premium Content & In-App Purchases', [
          LegalBlock.paragraph(
            'Premium features are available through one-time and subscription '
            'in-app purchases processed by Google Play Billing. Premium '
            'benefits include:',
          ),
          LegalBlock.bullets([
            'Access to all premium static and live wallpapers',
            'Ad-free experience throughout the App',
            'Early access to new wallpaper collections',
            'Full HD/4K resolution downloads',
          ]),
          LegalBlock.paragraph(
            'All purchases are processed and managed by Google Play. Refunds, '
            'billing disputes, and tax concerns are handled under Google '
            'Play\'s policies.',
          ),
        ]),
        LegalSection('5. Subscriptions: renewal & cancellation', [
          LegalBlock.paragraph(
            'If you purchase a subscription, it auto-renews at the end of each '
            'billing period at the price disclosed at purchase, until '
            'cancelled. You can manage or cancel your subscription at any time '
            'via *Google Play Store → Profile → Payments & subscriptions → '
            'Subscriptions*. Cancellation takes effect at the end of the '
            'current billing period; you will retain premium access until then. '
            'Deleting the App does **not** cancel a subscription.',
          ),
        ]),
        LegalSection('6. Free Trials', [
          LegalBlock.paragraph(
            'If a free trial is offered, you will not be charged during the '
            'trial period. The subscription will automatically convert to a '
            'paid subscription at the end of the trial unless you cancel at '
            'least 24 hours before the trial ends.',
          ),
        ]),
        LegalSection('7. Intellectual Property', [
          LegalBlock.paragraph(
            'All wallpapers, graphics, verses, prayers, and content within the '
            'App are protected by applicable copyright and intellectual '
            'property laws. You are granted a limited, non-exclusive, '
            'non-transferable license to use wallpapers solely for personal, '
            'non-commercial use on your own devices. Bible text is in the '
            'public domain.',
          ),
        ]),
        LegalSection('8. Prohibited Conduct', [
          LegalBlock.paragraph(
            'You agree not to: (a) reverse engineer, decompile, or extract '
            'source code from the App; (b) redistribute, resell, or '
            'commercially exploit any content; (c) use the App to harass others '
            'or violate any law; (d) circumvent ads, premium gating, or '
            'licensing controls.',
          ),
        ]),
        LegalSection('9. Disclaimer of Warranties', [
          LegalBlock.paragraph(
            'THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES '
            'OF ANY KIND, EITHER EXPRESS OR IMPLIED. We do not guarantee '
            'uninterrupted, secure, or error-free service.',
          ),
        ]),
        LegalSection('10. Limitation of Liability', [
          LegalBlock.paragraph(
            'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR '
            'ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE '
            'DAMAGES ARISING FROM YOUR USE OF THE APP. Our total liability '
            'shall not exceed the amount you paid us in the 12 months preceding '
            'the claim.',
          ),
        ]),
        LegalSection('11. Termination', [
          LegalBlock.paragraph(
            'We may suspend or terminate your access to the App if you breach '
            'these Terms. You may terminate by uninstalling the App. Sections '
            'that by their nature should survive (IP, disclaimers, liability) '
            'shall survive termination.',
          ),
        ]),
        LegalSection('12. Changes to Terms', [
          LegalBlock.paragraph(
            'We may update these Terms from time to time. Material changes will '
            'be communicated via an in-app notice. Your continued use after '
            'changes constitutes acceptance of the modified Terms.',
          ),
        ]),
        LegalSection('13. Governing Law', [
          LegalBlock.paragraph(
            'These Terms shall be governed by the laws of the jurisdiction in '
            'which the developer resides, without regard to conflict-of-law '
            'principles. Disputes shall be resolved in the competent courts of '
            'that jurisdiction, except where mandatory consumer-protection law '
            'in your country of residence provides otherwise.',
          ),
        ]),
        LegalSection('14. Contact', [
          LegalBlock.paragraph(
            'For questions about these Terms of Service, please contact us at:',
          ),
          LegalBlock.paragraph('~$_email~'),
        ]),
      ],
    );
  }
}
