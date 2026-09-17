import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";

const CONTACT_EMAIL = "pranacodes@gmail.com";
const LAST_UPDATED = "April 28, 2026";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 safe-top">
        <button onClick={() => { haptic("soft"); navigate(-1); }}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-card"
          style={{ border: "1px solid hsl(var(--border) / 0.3)" }}>
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">Terms of Service</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container px-5 pb-28">
        <p className="text-[10px] text-muted-foreground mb-4">Last updated: {LAST_UPDATED}</p>

        <Section title="1. Acceptance of Terms">
          <p>By downloading, installing, or using Prayly ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, please do not use the App.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>The App provides curated Christian-themed static and live wallpapers, daily Bible verses, prayers, and faith-based devotional content for Android devices.</p>
        </Section>

        <Section title="3. Eligibility">
          <p>You must be at least 13 years of age to use this App. If you are under 18, you must have permission from a parent or legal guardian. The App is rated for general audiences (3+) on Google Play.</p>
        </Section>

        <Section title="4. Premium Content & In-App Purchases">
          <p>Premium features are available through one-time and subscription in-app purchases processed by Google Play Billing. Premium benefits include:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Access to all premium static and live wallpapers</li>
            <li>Ad-free experience throughout the App</li>
            <li>Early access to new wallpaper collections</li>
            <li>Full HD/4K resolution downloads</li>
          </ul>
          <p>All purchases are processed and managed by Google Play. Refunds, billing disputes, and tax concerns are handled under Google Play's policies.</p>
        </Section>

        <Section title="5. Subscriptions: renewal & cancellation">
          <p>If you purchase a subscription, it auto-renews at the end of each billing period at the price disclosed at purchase, until cancelled. You can manage or cancel your subscription at any time via <em>Google Play Store → Profile → Payments &amp; subscriptions → Subscriptions</em>. Cancellation takes effect at the end of the current billing period; you will retain premium access until then. Deleting the App does <strong>not</strong> cancel a subscription.</p>
        </Section>

        <Section title="6. Free Trials">
          <p>If a free trial is offered, you will not be charged during the trial period. The subscription will automatically convert to a paid subscription at the end of the trial unless you cancel at least 24 hours before the trial ends.</p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>All wallpapers, graphics, verses, prayers, and content within the App are protected by applicable copyright and intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use wallpapers solely for personal, non-commercial use on your own devices. Bible text is in the public domain.</p>
        </Section>

        <Section title="8. Prohibited Conduct">
          <p>You agree not to: (a) reverse engineer, decompile, or extract source code from the App; (b) redistribute, resell, or commercially exploit any content; (c) use the App to harass others or violate any law; (d) circumvent ads, premium gating, or licensing controls.</p>
        </Section>

        <Section title="9. Disclaimer of Warranties">
          <p>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. We do not guarantee uninterrupted, secure, or error-free service.</p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
        </Section>

        <Section title="11. Termination">
          <p>We may suspend or terminate your access to the App if you breach these Terms. You may terminate by uninstalling the App. Sections that by their nature should survive (IP, disclaimers, liability) shall survive termination.</p>
        </Section>

        <Section title="12. Changes to Terms">
          <p>We may update these Terms from time to time. Material changes will be communicated via an in-app notice. Your continued use after changes constitutes acceptance of the modified Terms.</p>
        </Section>

        <Section title="13. Governing Law">
          <p>These Terms shall be governed by the laws of the jurisdiction in which the developer resides, without regard to conflict-of-law principles. Disputes shall be resolved in the competent courts of that jurisdiction, except where mandatory consumer-protection law in your country of residence provides otherwise.</p>
        </Section>

        <Section title="14. Contact">
          <p>For questions about these Terms of Service, please contact us at:</p>
          <p className="font-medium text-primary">{CONTACT_EMAIL}</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-[13px] font-bold text-foreground mb-2">{title}</h2>
      <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}
