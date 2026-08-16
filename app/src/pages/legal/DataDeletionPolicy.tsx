import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function DataDeletionPolicy() {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Data Deletion Policy" lastUpdated="2 August 2026">
      <Section title="Your right to delete">
        <P>You can permanently delete your Ridepay account and personal data at any time, directly from the app —
          no need to email support or wait for a manual process.</P>
      </Section>

      <Section title="How to delete your account">
        <Ul>
          <li>Open <strong>Settings → Delete Account</strong>.</li>
          <li>Review what will be deleted and what's retained (below), and confirm.</li>
          <li>Your account is deactivated immediately and your personal data is deleted or anonymised within 30 days.</li>
        </Ul>
        <button
          onClick={() => navigate("/account/delete")}
          className="mt-2 flex items-center gap-2 text-sm font-medium text-[#DC2626] bg-[#FEE2E2] dark:bg-[#3A1A1A] px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          <Trash2 className="w-4 h-4" /> Go to Delete Account
        </button>
      </Section>

      <Section title="What gets deleted">
        <Ul>
          <li>Your name, email, date of birth, gender, and profile photo.</li>
          <li>Your phone number is removed from your profile (though we retain a non-reversible record that this
            number was once verified, to prevent abuse of our OTP system).</li>
          <li>Saved places, emergency contacts, and app preferences.</li>
          <li>Driver documents (licence, RC, insurance, Aadhaar) if you had a driver account.</li>
          <li>Push-notification subscriptions and device tokens.</li>
        </Ul>
      </Section>

      <Section title="What's retained, and why">
        <P>Indian tax and accounting law requires us to retain financial transaction records (wallet transactions,
          commission ledger entries, ride/parcel payment history) for a minimum retention period even after account
          deletion. These records remain associated with the name on your account at the time of each transaction —
          that's how our accounting ledger is organised — but your account itself is permanently deactivated, your
          phone number and contact details are removed, and you will not be able to log back in. This transaction
          history is retained solely for legal, tax, and fraud-prevention purposes and is not used for any other
          purpose after deletion.</P>
        <P>If you have a pending wallet balance or an active withdrawal request at the time of deletion, we'll
          contact you to settle it before your account is closed.</P>
      </Section>

      <Section title="What happens to your wallet balance">
        <P>Any remaining wallet balance must be withdrawn or used before deleting your account — deletion does not
          automatically forfeit it, but you won't be able to access or withdraw it afterwards, so please settle your
          balance first.</P>
      </Section>
    </LegalPageLayout>
  );
}
