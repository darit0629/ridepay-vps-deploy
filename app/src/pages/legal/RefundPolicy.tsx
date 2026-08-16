import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function RefundPolicy() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="2 August 2026">
      <Section title="How refunds are issued">
        <P>Where you're entitled to a refund, it is credited to your Ridepay wallet, usually within a few minutes of
          approval. Wallet credit can be used immediately for your next ride, parcel, or subscription payment, or
          withdrawn subject to our standard withdrawal process. If a wallet credit isn't suitable for your situation,
          contact support and we'll review reversing the charge to your original payment method on a case-by-case
          basis.</P>
      </Section>

      <Section title="When you're eligible for a refund">
        <Ul>
          <li><strong>Duplicate or failed payment.</strong> If a payment was deducted but the transaction shows as
            failed or was charged twice, report it via Help &amp; Support with your transaction details — we verify and
            refund confirmed duplicate/failed charges.</li>
          <li><strong>Overcharge.</strong> If you were charged more than the fare shown at booking (outside of tolls,
            waiting charges, or surcharges you were shown and accepted), the difference is refunded.</li>
          <li><strong>Service not delivered.</strong> If a ride or parcel pickup never happened due to a platform or
            driver issue and you were still charged, the full amount is refunded.</li>
          <li><strong>Cancellation fees.</strong> Cancellation fees are charged per our{" "}
            <a href="/legal/cancellation-policy" className="text-[#FF6B00] hover:underline">Cancellation Policy</a> and
            are refundable only if charged in error.</li>
        </Ul>
      </Section>

      <Section title="When refunds don't apply">
        <Ul>
          <li>Rides, parcels, or subscription cycles that were completed as booked.</li>
          <li>Cancellation fees correctly charged per policy.</li>
          <li>Promotional or referral credits already used or expired.</li>
        </Ul>
      </Section>

      <Section title="How to request a refund">
        <P>Go to Help &amp; Support → Report an Issue, select "Payment Problem", and describe what happened. We aim to
          review payment-related complaints within 48 hours.</P>
      </Section>
    </LegalPageLayout>
  );
}
