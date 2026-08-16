import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function SafetyPolicy() {
  return (
    <LegalPageLayout title="Safety Policy" lastUpdated="2 August 2026">
      <Section title="Driver verification">
        <P>Every driver must upload a valid driving licence, vehicle registration certificate (RC), and insurance
          before their account is approved. Documents are reviewed by our verification team, and drivers with expired
          or missing documents are automatically blocked from going online until re-verified.</P>
      </Section>

      <Section title="In-app safety features">
        <Ul>
          <li><strong>Live trip tracking.</strong> Every active ride shows the vehicle's real-time location and route.</li>
          <li><strong>SOS button.</strong> Available on every active-trip screen — alerts your emergency contacts and
            gives one-tap access to emergency services.</li>
          <li><strong>Share your trip.</strong> Send a live trip-tracking link to a friend or family member.</li>
          <li><strong>Emergency contacts.</strong> Add trusted contacts in the Safety Center who can be notified during an SOS.</li>
          <li><strong>PIN verification.</strong> Pickup and drop-off for school transport, and delivery confirmation for
            parcels, require a one-time PIN — so the right person is always picked up, dropped off, or receives the parcel.</li>
          <li><strong>Ratings.</strong> Both riders and drivers rate each other after every trip; a pattern of low ratings
            triggers a review.</li>
        </Ul>
      </Section>

      <Section title="School transport-specific safeguards">
        <P>School transport subscriptions go through a dedicated verification queue before approval, covering the
          student's details, guardian identity, and authorised pickup persons. Every trip requires PIN verification at
          both pickup and drop-off, and guardians can track the vehicle live and receive a notification at each stage
          of the trip.</P>
      </Section>

      <Section title="Reporting a safety incident">
        <P>Use the SOS button for anything happening right now. For anything after the fact, go to Help &amp; Support
          → Report an Issue → Safety &amp; Emergency. Safety reports are reviewed with priority and may result in
          immediate suspension of the reported account pending investigation, per our{" "}
          <a href="/legal/community-guidelines" className="text-[#FF6B00] hover:underline">Community Guidelines</a>.</P>
      </Section>

      <Section title="Emergency services">
        <P>Ridepay's in-app safety features are a supplement to, not a replacement for, contacting local emergency
          services directly. In an emergency, always call your local emergency number first.</P>
      </Section>
    </LegalPageLayout>
  );
}
