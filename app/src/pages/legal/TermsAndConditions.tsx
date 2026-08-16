import LegalPageLayout, { Section, P, Ul, Placeholder } from "@/components/LegalPageLayout";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

export default function TermsAndConditions() {
  return (
    <LegalPageLayout title="Terms &amp; Conditions" lastUpdated="2 August 2026">
      <Section title="1. Acceptance">
        <P>These Terms &amp; Conditions govern your use of the Ridepay app, operated by{" "}
          <Placeholder>[Ridepay Technologies Pvt. Ltd. — legal entity name to confirm]</Placeholder>. By registering an
          account, you agree to be bound by these terms. If you don't agree, please don't use the app.</P>
      </Section>

      <Section title="2. What Ridepay is">
        <P>Ridepay is a technology platform that connects riders with independent e-rickshaw/auto drivers for on-demand
          rides, parcel delivery, and recurring school transport subscriptions. Ridepay does not itself provide
          transportation — drivers on the platform are independent operators, not Ridepay employees (see our{" "}
          <a href="/legal/driver-agreement" className="text-[#FF6B00] hover:underline">Driver Agreement</a>).</P>
      </Section>

      <Section title="3. Eligibility">
        <Ul>
          <li>You must be at least 18 years old to create a Ridepay account.</li>
          <li>You must provide a valid mobile number capable of receiving SMS, and complete OTP verification.</li>
          <li>Drivers must hold a valid driving licence and vehicle registration, and pass Ridepay's document verification before going online.</li>
        </Ul>
      </Section>

      <Section title="4. Booking, fares &amp; payment">
        <P>Fares are calculated automatically based on distance, time, vehicle type, and any active surge or zone
          pricing, all shown to you before you confirm a booking. You may pay by cash, UPI, or your Ridepay wallet.
          Wallet balances are non-transferable to other accounts. Where a coupon or referral credit applies, the
          discount is validated and applied automatically at checkout.</P>
      </Section>

      <Section title="5. Cancellations">
        <P>Rides may be cancelled free of charge within the window shown in-app. Cancelling after a driver has been
          dispatched may incur a cancellation fee — see our{" "}
          <a href="/legal/cancellation-policy" className="text-[#FF6B00] hover:underline">Cancellation Policy</a> for
          the exact rules and current fee schedule.</P>
      </Section>

      <Section title="6. User conduct">
        <P>You agree to use Ridepay lawfully and respectfully. Prohibited conduct — for both riders and drivers — is
          set out in full in our <a href="/legal/community-guidelines" className="text-[#FF6B00] hover:underline">Community Guidelines</a>.
          Violations may result in a warning, suspension, or permanent removal from the platform.</P>
      </Section>

      <Section title="7. Liability">
        <P>Ridepay facilitates the connection between riders and drivers but is not a party to the transportation
          service itself. To the maximum extent permitted by law, Ridepay is not liable for the acts or omissions of
          independent drivers, delays, or losses arising from circumstances outside our reasonable control. Nothing in
          these terms limits any liability that cannot be limited under Indian law.</P>
      </Section>

      <Section title="8. Account suspension &amp; termination">
        <P>We may suspend or terminate your account for violation of these terms, fraudulent activity, or repeated
          safety complaints. You may stop using the app and request account deletion at any time — see our{" "}
          <a href="/legal/data-deletion" className="text-[#FF6B00] hover:underline">Data Deletion Policy</a>.</P>
      </Section>

      <Section title="9. Changes to these terms">
        <P>We may update these terms from time to time. Continued use of the app after an update constitutes
          acceptance of the revised terms.</P>
      </Section>

      <Section title="10. Governing law">
        <P>These terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of
          the courts of <Placeholder>[registered jurisdiction/city to confirm]</Placeholder>.</P>
      </Section>

      <Section title="11. Contact">
        <P>Questions about these terms: <a href={SUPPORT_EMAIL_MAILTO} className="text-[#FF6B00] hover:underline">{SUPPORT_EMAIL}</a> or{" "}
          <a href={SUPPORT_PHONE_TEL} className="text-[#FF6B00] hover:underline">{SUPPORT_PHONE_DISPLAY}</a></P>
      </Section>
    </LegalPageLayout>
  );
}
