import LegalPageLayout, { Section, P, Ul, Placeholder } from "@/components/LegalPageLayout";

export default function DriverAgreement() {
  return (
    <LegalPageLayout title="Driver Agreement" lastUpdated="2 August 2026">
      <Section title="1. Independent contractor relationship">
        <P>By registering as a driver ("captain") on Ridepay, you acknowledge that you are an independent operator
          providing transportation and delivery services, not an employee, agent, or partner of Ridepay. You are
          responsible for your own vehicle, fuel, maintenance, and compliance with local transport regulations and
          licensing requirements.</P>
      </Section>

      <Section title="2. Eligibility &amp; documents">
        <Ul>
          <li>A valid driving licence for your vehicle category.</li>
          <li>A registered vehicle matching the type declared on your profile.</li>
          <li>Valid vehicle insurance.</li>
          <li>Any Aadhaar or identity document requested for verification.</li>
        </Ul>
        <P>You must re-upload any document before it expires. Ridepay may suspend your ability to go online if a
          required document lapses.</P>
      </Section>

      <Section title="3. Commission &amp; earnings">
        <P>For every completed, paid ride or parcel delivery, the fare is split automatically at settlement: a driver
          share (currently 80% of the amount remaining after payment-gateway and platform charges), with the balance
          distributed to platform, referral, and other configured shares. Your exact share for a given trip is always
          visible in your Earnings screen. Ridepay may adjust the commission structure from time to time; any change
          will be reflected in the app before it takes effect on new trips.</P>
      </Section>

      <Section title="4. Payouts &amp; wallet">
        <P>Your earnings are credited to your Ridepay driver wallet immediately after each trip settles. You can
          request a withdrawal to your bank account at any time from your wallet, subject to admin approval and any
          minimum withdrawal amount shown in-app. Cancellation compensation and bonuses/incentives are credited the
          same way.</P>
      </Section>

      <Section title="5. Cancellation compensation">
        <P>If a rider cancels after you've been dispatched and outside the free-cancellation window, you are
          compensated a share of the collected cancellation fee (currently 70%), credited to your wallet automatically.</P>
      </Section>

      <Section title="6. Conduct &amp; standards">
        <P>You agree to follow our <a href="/legal/community-guidelines" className="text-[#FF6B00] hover:underline">Community Guidelines</a>,
          arrive in the registered vehicle, follow in-app PIN-verification steps for school transport and parcel
          deliveries without exception, and never solicit payment outside the app for a Ridepay booking.</P>
      </Section>

      <Section title="7. Suspension &amp; termination">
        <P>Ridepay may suspend or deactivate your driver account for document non-compliance, safety violations,
          fraudulent activity, or a sustained pattern of complaints, per our{" "}
          <a href="/legal/community-guidelines" className="text-[#FF6B00] hover:underline">Community Guidelines</a>. You may stop
          driving and close your account at any time — any wallet balance owed to you will be settled before closure.</P>
      </Section>

      <Section title="8. Taxes">
        <P>As an independent operator, you are responsible for your own income tax, GST (if applicable), and any other
          statutory obligations arising from your earnings on the platform.</P>
      </Section>

      <Section title="9. Governing law">
        <P>This agreement is governed by the laws of India, with disputes subject to the courts of{" "}
          <Placeholder>[registered jurisdiction/city to confirm]</Placeholder>.</P>
      </Section>
    </LegalPageLayout>
  );
}
