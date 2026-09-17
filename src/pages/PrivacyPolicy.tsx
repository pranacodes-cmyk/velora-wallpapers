import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";

const CONTACT_EMAIL = "pranacodes@gmail.com";
const LAST_UPDATED = "April 28, 2026";
const PACKAGE_NAME = "com.jesuswallpaperbible.app";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 safe-top">
        <button onClick={() => { haptic("soft"); navigate(-1); }}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-card"
          style={{ border: "1px solid hsl(var(--border) / 0.3)" }}>
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">Privacy Policy</h1>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container px-5 pb-28">
        <p className="text-[10px] text-muted-foreground mb-4">Last updated: {LAST_UPDATED}</p>

        <p className="text-[11px] text-muted-foreground leading-relaxed mb-5">
          This Privacy Policy describes how <strong className="text-foreground">Prayly</strong> ("the App", "we", "us", or "our") collects, uses, and protects information when you use our mobile application available on Google Play. By using the App you agree to this policy.
        </p>

        <Section title="1. Who we are">
          <p>The App is published by an independent developer ("we") and is distributed via Google Play under the package name <code className="text-primary">{PACKAGE_NAME}</code>. For any privacy-related question you can reach us at <span className="text-primary">{CONTACT_EMAIL}</span>.</p>
        </Section>

        <Section title="2. Data we collect">
          <p>We designed the App to collect as little data as possible:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Device model, OS version, screen size, language</strong> — to deliver wallpapers in the right resolution. Not linked to you.</li>
            <li><strong>Anonymous usage analytics</strong> (screens viewed, wallpapers downloaded, taps) — to improve performance. Not linked to you.</li>
            <li><strong>Crash logs and diagnostics</strong> — to detect and fix bugs. Not linked to you.</li>
            <li><strong>Advertising ID</strong> — to serve ads via Google AdMob in the free version. Pseudonymous.</li>
            <li><strong>Purchase token</strong> — to verify in-app purchases via Google Play Billing. Held by Google.</li>
            <li><strong>Email you send to support</strong> — to reply to your request. Linked to you.</li>
          </ul>
          <p className="mt-2"><strong>We do NOT collect:</strong> your name, phone number, precise location, contacts, photos, files on your device, microphone, camera, or any health, financial, or biometric data.</p>
        </Section>

        <Section title="3. Permissions we request">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>INTERNET</strong> — download wallpapers and updates.</li>
            <li><strong>SET_WALLPAPER</strong> — apply images and live wallpapers to your home/lock screen.</li>
            <li><strong>FOREGROUND_SERVICE / BIND_WALLPAPER</strong> — run live wallpaper engines.</li>
            <li><strong>VIBRATE</strong> — provide subtle haptic feedback on taps.</li>
            <li><strong>POST_NOTIFICATIONS</strong> (Android 13+) — optional daily verse / prayer reminders. You can disable this at any time in system settings.</li>
            <li><strong>com.android.vending.BILLING</strong> — process in-app purchases through Google Play.</li>
          </ul>
          <p className="mt-2">The App does <strong>not</strong> request location, camera, microphone, contacts, or SMS permissions.</p>
        </Section>

        <Section title="4. How we use the data">
          <ul className="list-disc pl-4 space-y-1">
            <li>Operate, maintain, and improve the App.</li>
            <li>Personalise the experience (favourites, streaks — stored locally on your device).</li>
            <li>Show advertisements in the free version through Google AdMob.</li>
            <li>Process and verify in-app purchases through Google Play Billing.</li>
            <li>Diagnose crashes and prevent fraud or abuse.</li>
            <li>Reply to support enquiries you send us.</li>
          </ul>
          <p className="mt-2">We never sell your personal information. We never use your data for credit, lending, employment, insurance, or housing decisions.</p>
        </Section>

        <Section title="5. Advertising (Google AdMob)">
          <p>The free version of the App displays banner, interstitial, and rewarded ads served by Google AdMob. AdMob may collect and process the Android Advertising ID, IP address, and ad-interaction events to deliver and measure ads. See Google's privacy policy at policies.google.com/privacy for full details.</p>
          <p>You can reset or limit ad personalisation any time via <em>Settings → Google → Ads</em> on your Android device.</p>
        </Section>

        <Section title="6. In-app purchases">
          <p>Premium content is unlocked through Google Play Billing. We never see or store your payment card details — Google handles the transaction. We only receive a purchase token used to verify entitlement.</p>
        </Section>

        <Section title="7. Data storage & security">
          <p>Your favourites, streaks, downloaded wallpapers, and preferences are stored <strong>locally on your device</strong>. Wallpaper assets are served from Cloudflare's global CDN over encrypted HTTPS/TLS connections. Anonymous analytics and crash logs are transmitted over HTTPS and retained no longer than 90 days.</p>
        </Section>

        <Section title="8. Data sharing">
          <p>We share data only with the following service providers, strictly for the purposes listed above:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Google AdMob</strong> — advertising</li>
            <li><strong>Google Play Billing</strong> — purchase processing</li>
            <li><strong>Cloudflare</strong> — content delivery and DDoS protection</li>
            <li><strong>Supabase</strong> — anonymous analytics &amp; backend hosting</li>
          </ul>
          <p className="mt-2">We may disclose information if required by law, valid legal process, or to protect the rights, property, or safety of our users or others.</p>
        </Section>

        <Section title="9. Your rights (GDPR, CCPA & others)">
          <p>Depending on where you live you have the right to access, correct, or delete your personal data; object to or restrict certain processing; withdraw consent for personalised advertising; and lodge a complaint with your local data-protection authority. To exercise any of these rights email us at <span className="text-primary">{CONTACT_EMAIL}</span>.</p>
        </Section>

        <Section title="10. Children's privacy">
          <p>The App is rated for <strong>general audiences (3+)</strong> and is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us data, contact us and we will delete it immediately.</p>
        </Section>

        <Section title="11. International data transfers">
          <p>Our service providers may process data in the United States, European Union, or other regions. Where required, transfers are protected by Standard Contractual Clauses or equivalent safeguards.</p>
        </Section>

        <Section title="12. Data retention">
          <p>Anonymous analytics and crash logs: up to 90 days. Support emails: up to 24 months after the issue is resolved. Local data on your device persists until you uninstall the App or clear its storage.</p>
        </Section>

        <Section title="13. Account & data deletion">
          <p>The App does not require an account. To remove all locally stored data, uninstall the App or use <em>Settings → Apps → Prayly → Storage → Clear data</em>. To request deletion of any server-side anonymous identifiers tied to your device, email us at <span className="text-primary">{CONTACT_EMAIL}</span>. We respond within 30 days.</p>
        </Section>

        <Section title="14. Changes to this policy">
          <p>We may update this Privacy Policy from time to time. Material changes will be communicated via an in-app notice. The "Last updated" date at the top of this page always reflects the latest version.</p>
        </Section>

        <Section title="15. Contact us">
          <p>For privacy questions, data requests, or any other concern please email:</p>
          <p className="font-medium text-primary">{CONTACT_EMAIL}</p>
          <p>We respond to legitimate requests within 30 days.</p>
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
