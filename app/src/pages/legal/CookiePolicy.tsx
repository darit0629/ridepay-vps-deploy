import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function CookiePolicy() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="2 August 2026">
      <Section title="What we use, and why">
        <P>Ridepay uses a small amount of local storage on your device — we don't use third-party advertising cookies
          or cross-site trackers.</P>
        <Ul>
          <li><strong>Session cookie.</strong> A single, secure, HTTP-only cookie that keeps you signed in after OTP
            verification, for up to a year, so you don't have to log in again on the same device. It cannot be read by
            scripts running on the page, and is essential for the app to function.</li>
          <li><strong>Local storage.</strong> Used on your device to remember your role, theme (light/dark), language,
            and a few UI preferences (like whether you've dismissed a notification prompt). This never leaves your
            device.</li>
        </Ul>
      </Section>

      <Section title="What we don't use">
        <P>We don't use advertising or cross-site tracking cookies, and we don't share cookie or local-storage data
          with third-party ad networks.</P>
      </Section>

      <Section title="Managing cookies">
        <P>Because the session cookie is essential to staying logged in, clearing it (or your browser's site data)
          will simply sign you out — you can log back in with OTP at any time. If you're using the Ridepay Android
          app, the same applies to the app's storage, which you can clear from your device's app settings.</P>
      </Section>
    </LegalPageLayout>
  );
}
