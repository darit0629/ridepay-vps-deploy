import LegalPageLayout, { Section, P, Ul, Placeholder } from "@/components/LegalPageLayout";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="2 August 2026">
      <Section title="1. Who we are">
        <P>
          This Privacy Policy explains how <Placeholder>[Ridepay Technologies Pvt. Ltd. — legal entity name to confirm]</Placeholder> ("Ridepay",
          "we", "us") collects, uses, stores and shares information when you use the Ridepay app as a rider, driver
          ("captain"), or guardian booking school transport, and any related website.
        </P>
        <P>By creating an account or using the app, you agree to the collection and use of information as described here.</P>
      </Section>

      <Section title="2. Information we collect">
        <P><strong>Account &amp; identity.</strong> Your mobile number (verified by SMS OTP), name, email address (optional),
          date of birth and gender (optional, collected during registration), and profile photo if you add one.</P>
        <P><strong>Location.</strong> Pickup and drop-off coordinates for every ride or parcel you book; a driver's live
          location while online and during an active trip, so riders can track their vehicle in real time. We do not
          collect background location when the app is closed.</P>
        <P><strong>Driver-specific information.</strong> Vehicle type, model and registration number, driving licence
          number, and verification documents (licence, RC, insurance, Aadhaar) uploaded for approval.</P>
        <P><strong>Payments &amp; wallet.</strong> Your wallet balance and transaction history within the app (recharges,
          ride/parcel payments, refunds, withdrawals). Card, UPI and net-banking details are entered directly into our
          payment processor's (Razorpay) secure checkout — Ridepay's servers never receive or store your full card number,
          CVV or bank credentials, only the payment confirmation and a transaction reference.</P>
        <P><strong>Communications.</strong> Support tickets and messages you send us, including any details you include
          when reporting an issue (subject, description, and — if relevant — the ride/parcel it concerns).</P>
        <P><strong>Device &amp; notifications.</strong> A push-notification subscription (web push endpoint/keys, or a
          Firebase Cloud Messaging token if you're using the Android app) so we can deliver ride, payment and account
          notifications. Basic device information such as app version and platform, used only for delivering the correct
          type of notification and for troubleshooting.</P>
        <P><strong>Usage information.</strong> Your ride, parcel-delivery and school-transport-subscription history within
          the app, including status, fare and timestamps, so you can view your own trip history and receipts.</P>
      </Section>

      <Section title="3. How we use your information">
        <Ul>
          <li>To create and manage your account, and verify your identity via OTP.</li>
          <li>To match riders with drivers, calculate fares, and process payments and payouts.</li>
          <li>To show live vehicle location and estimated arrival time during a trip.</li>
          <li>To send ride, payment, and account notifications you've opted into.</li>
          <li>To respond to support requests and investigate complaints or safety reports.</li>
          <li>To verify driver documents and vehicle eligibility before approving a driver account.</li>
          <li>To detect and prevent fraud, abuse, and violations of our Terms &amp; Conditions.</li>
          <li>To comply with applicable law, including tax and accounting record-keeping requirements.</li>
        </Ul>
      </Section>

      <Section title="4. Third-party services we use">
        <P><strong>Google Maps.</strong> Used to render maps, calculate routes/ETAs, and power address search. Your
          pickup/drop location and, while a trip is active, live position are sent to Google's Maps API to provide this
          functionality, subject to Google's own privacy policy.</P>
        <P><strong>Razorpay.</strong> Our payment gateway. When you add money to your wallet or pay for a ride/parcel via
          UPI, card or net banking, that payment is processed entirely within Razorpay's secure checkout, governed by
          Razorpay's own privacy policy.</P>
        <P><strong>Firebase Cloud Messaging (FCM) / Web Push.</strong> Used solely to deliver push notifications to your
          device. We do not currently use Firebase Analytics, Crashlytics, or any other Firebase product beyond
          messaging.</P>
        <P><strong>Twilio.</strong> Used to send the one-time password (OTP) SMS to your phone number during login and
          registration.</P>
        <P><strong>Analytics &amp; crash reporting.</strong> We do not currently integrate a third-party analytics or
          crash-reporting SDK. If we add one in the future, we will update this policy and, where required, ask for your
          consent first.</P>
      </Section>

      <Section title="5. How we share information">
        <Ul>
          <li>With the driver or rider you're matched with, to the extent needed to complete a trip (name, photo, rating, live location, and phone number for calling/messaging within the app).</li>
          <li>With Razorpay, Twilio, and Google, as described above, solely to provide the functionality they power.</li>
          <li>With law enforcement or regulators, only where required by law or to protect the safety of our users.</li>
          <li>We do not sell your personal information, and we do not share it with third parties for their own marketing purposes.</li>
        </Ul>
      </Section>

      <Section title="6. Data retention">
        <P>We keep your account and trip information for as long as your account is active, and for a reasonable period
          afterwards where required for accounting, tax, dispute-resolution, or fraud-prevention purposes — typically
          up to <Placeholder>[retention period to confirm, e.g. 7 years]</Placeholder> for financial transaction records, consistent with
          applicable Indian law. You can request deletion of your account at any time — see our <a href="/legal/data-deletion" className="text-[#FF6B00] hover:underline">Data Deletion Policy</a>.</P>
      </Section>

      <Section title="7. Security">
        <P>All traffic between the app and our servers is encrypted (HTTPS/TLS). Your session is authenticated using a
          secure, HTTP-only cookie that cannot be read by scripts running in the app. Passwords are never used or stored —
          login is by SMS OTP only. Access to production data is restricted to authorised personnel.</P>
      </Section>

      <Section title="8. Your rights">
        <Ul>
          <li>Access and review the personal information we hold about you, via your in-app profile.</li>
          <li>Correct inaccurate information directly in your profile, or by contacting support.</li>
          <li>Request deletion of your account and personal data (see our Data Deletion Policy).</li>
          <li>Withdraw consent for optional data (such as your profile photo or notification preferences) at any time in Settings.</li>
        </Ul>
      </Section>

      <Section title="9. Children's privacy">
        <P>Ridepay is not intended for use by children under 18. Our School Transport feature is booked and managed
          exclusively by a parent/guardian account — students themselves do not create Ridepay accounts.</P>
      </Section>

      <Section title="10. Changes to this policy">
        <P>We may update this policy from time to time. If we make material changes, we'll notify you in the app before
          they take effect.</P>
      </Section>

      <Section title="11. Contact us">
        <P>For any privacy questions or to exercise your rights, contact us at <a href={SUPPORT_EMAIL_MAILTO} className="text-[#FF6B00] hover:underline">{SUPPORT_EMAIL}</a> or{" "}
          <a href={SUPPORT_PHONE_TEL} className="text-[#FF6B00] hover:underline">{SUPPORT_PHONE_DISPLAY}</a>, or
          our grievance officer at <Placeholder>[Grievance Officer name and registered address to confirm]</Placeholder>.</P>
      </Section>
    </LegalPageLayout>
  );
}
