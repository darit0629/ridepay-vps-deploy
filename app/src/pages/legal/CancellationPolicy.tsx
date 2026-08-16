import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function CancellationPolicy() {
  return (
    <LegalPageLayout title="Cancellation Policy" lastUpdated="2 August 2026">
      <Section title="Free cancellation window">
        <P>You can cancel a ride at no charge any time while we're still searching for a driver. Once a driver has
          accepted and is on the way, you have a short free-cancellation window (shown at the top of the cancellation
          screen, typically the first 60 seconds after a match) to cancel without a fee.</P>
      </Section>

      <Section title="Cancelling after the free window">
        <P>If you cancel after the free window and after a driver has already been dispatched, a cancellation fee may
          apply. The fee depends on the vehicle type booked and is always shown to you before you confirm the
          cancellation — you will never be charged a fee you weren't shown first.</P>
        <Ul>
          <li>Fees are flat amounts, capped at a maximum per vehicle type (for example, an e-rickshaw ride is capped
            around ₹50, a car ride around ₹100 — exact current amounts are always shown on-screen, since they can be
            adjusted by Ridepay from time to time).</li>
          <li>A majority share of any collected cancellation fee (currently 70%) is paid to the driver as compensation
            for the wasted dispatch; the remainder is retained by Ridepay to cover platform costs.</li>
        </Ul>
      </Section>

      <Section title="Driver-initiated cancellations">
        <P>If a driver cancels your ride (for example, due to a vehicle issue), you are never charged a cancellation
          fee. If you had already been compensated less than expected due to the cancellation, contact support and
          we'll make it right.</P>
      </Section>

      <Section title="Parcel deliveries">
        <P>The same free-cancellation-then-fee structure applies to parcel bookings, using the parcel courier's
          vehicle-type fee schedule.</P>
      </Section>

      <Section title="School transport subscriptions">
        <P>School transport subscriptions can be paused, resumed, or cancelled at any time from your Subscription
          Management screen. Cancelling a subscription does not incur a fee, but any amount already paid for the
          current billing cycle is non-refundable except as described in our{" "}
          <a href="/legal/refund-policy" className="text-[#FF6B00] hover:underline">Refund Policy</a>.</P>
      </Section>
    </LegalPageLayout>
  );
}
