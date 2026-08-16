import LegalPageLayout, { Section, P, Ul } from "@/components/LegalPageLayout";

export default function CommunityGuidelines() {
  return (
    <LegalPageLayout title="Community Guidelines" lastUpdated="2 August 2026">
      <Section title="Our expectation">
        <P>Ridepay connects real people — riders, drivers, and families booking school transport. These guidelines
          apply to everyone on the platform and exist to keep every trip safe and respectful.</P>
      </Section>

      <Section title="For riders">
        <Ul>
          <li>Treat your driver with courtesy — no verbal abuse, discrimination, or threatening behaviour.</li>
          <li>Don't request your driver to break traffic laws or take unsafe routes.</li>
          <li>Don't carry prohibited, illegal, or hazardous items in a ride or parcel booking.</li>
          <li>Be ready at the pickup point at the scheduled time.</li>
          <li>Rate and review honestly — false reports harm real people's livelihoods.</li>
        </Ul>
      </Section>

      <Section title="For drivers">
        <Ul>
          <li>Arrive in the vehicle registered on your profile, in roadworthy condition.</li>
          <li>Follow the app's suggested route unless the rider requests otherwise.</li>
          <li>Never ask a rider to pay outside the app for a booking made through Ridepay.</li>
          <li>Treat every rider with respect regardless of gender, religion, caste, or destination.</li>
          <li>Keep your documents (licence, RC, insurance) current and re-upload before they expire.</li>
          <li>School transport drivers must follow all PIN-verification steps for every pickup and drop-off, without exception.</li>
        </Ul>
      </Section>

      <Section title="Zero tolerance">
        <P>The following result in immediate account suspension pending investigation, and may lead to permanent
          removal from the platform:</P>
        <Ul>
          <li>Physical violence, sexual harassment, or threats of either.</li>
          <li>Driving under the influence of alcohol or drugs.</li>
          <li>Discrimination based on gender, religion, caste, disability, or destination.</li>
          <li>Fraud — fake trips, manipulated fares, or fraudulent wallet activity.</li>
          <li>Any incident involving a minor's safety on a school-transport trip.</li>
        </Ul>
      </Section>

      <Section title="Reporting a violation">
        <P>Use the in-app SOS button for an active emergency, or Help &amp; Support → Report an Issue for anything
          else. Every report is reviewed by our safety team.</P>
      </Section>
    </LegalPageLayout>
  );
}
