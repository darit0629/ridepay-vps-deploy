import { Pencil, Check } from "lucide-react";
import { DOCUMENT_LABELS, requiredDocumentsFor, type OnboardingData } from "./onboardingTypes";

interface Props {
  data: OnboardingData;
  onEditStep: (step: number) => void;
}

function Section({
  title, step, onEditStep, children,
}: { title: string; step: number; onEditStep: (step: number) => void; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">{title}</h3>
        <button onClick={() => onEditStep(step)} className="flex items-center gap-1 text-xs font-semibold text-[#FF6B00]">
          <Pencil className="w-3 h-3" /> Edit
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-medium text-right truncate max-w-[60%]">{value || "—"}</span>
    </div>
  );
}

export default function StepReview({ data, onEditStep }: Props) {
  const required = requiredDocumentsFor(data.vehicleType);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Review Your Details</h2>
      <p className="text-white/50 text-sm mb-4">Make sure everything looks right before you submit</p>

      <Section title="Personal" step={3} onEditStep={onEditStep}>
        <Row label="Name" value={data.name} />
        <Row label="Date of Birth" value={data.dob} />
        <Row label="Gender" value={data.gender} />
        <Row label="Emergency Contact" value={data.emergencyContact} />
        <Row label="Email" value={data.email} />
      </Section>

      <Section title="Address" step={4} onEditStep={onEditStep}>
        <Row label="Address" value={data.address} />
        <Row label="City" value={data.city} />
        <Row label="State" value={data.state} />
        <Row label="PIN Code" value={data.pincode} />
      </Section>

      <Section title="Vehicle" step={5} onEditStep={onEditStep}>
        <Row label="Type" value={data.vehicleType} />
        <Row label="Number" value={data.vehicleNumber} />
        <Row label="Brand & Model" value={`${data.vehicleBrand} ${data.vehicleModel}`.trim()} />
        <Row label="Year" value={data.manufacturingYear} />
        <Row label="Color" value={data.vehicleColor} />
      </Section>

      <Section title="Documents" step={7} onEditStep={onEditStep}>
        {required.map((key) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-white/50">{DOCUMENT_LABELS[key]}</span>
            {data.documents[key] ? (
              <span className="flex items-center gap-1 text-[#138808] font-medium"><Check className="w-3.5 h-3.5" /> Uploaded</span>
            ) : (
              <span className="text-[#FF6B6B] font-medium">Missing</span>
            )}
          </div>
        ))}
      </Section>

      <Section title="Bank" step={8} onEditStep={onEditStep}>
        <Row label="Account Holder" value={data.bankAccountHolderName} />
        <Row label="Bank" value={data.bankName} />
        <Row label="Account Number" value={data.bankAccountNumber.replace(/.(?=.{4})/g, "•")} />
        <Row label="IFSC" value={data.bankIfscCode} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">Verified</span>
          <span className={`font-medium ${data.bankVerified ? "text-[#138808]" : "text-white/40"}`}>{data.bankVerified ? "Yes" : "Not verified"}</span>
        </div>
      </Section>

      <Section title="Preferences" step={9} onEditStep={onEditStep}>
        <Row label="Service" value={data.serviceType === "both" ? "Ride + Parcel" : data.serviceType === "ride" ? "Ride Only" : "Parcel Only"} />
        <Row label="Availability" value={data.availability === "fulltime" ? "Full Time" : "Part Time"} />
        <Row label="Operating Areas" value={data.operatingAreas.join(", ")} />
      </Section>
    </div>
  );
}
