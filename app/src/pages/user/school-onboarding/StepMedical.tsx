import { HeartPulse } from "lucide-react";
import { Field, inputCls, cardCls } from "./onboardingUi";
import type { SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
}

export default function StepMedical({ data, update }: Props) {
  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-[#DC2626]" /> Medical & Instructions
        </h2>
        <p className="text-xs text-[#9CA3AF]">All optional — share anything the driver should know.</p>
        <Field label="Medical Notes">
          <textarea value={data.medicalNotes} onChange={(e) => update("medicalNotes", e.target.value)} rows={2} className={inputCls} placeholder="Any conditions the driver should know" />
        </Field>
        <Field label="Allergies">
          <input value={data.allergies} onChange={(e) => update("allergies", e.target.value)} className={inputCls} placeholder="e.g. Peanuts" />
        </Field>
        <Field label="Special Instructions">
          <textarea value={data.specialInstructions} onChange={(e) => update("specialInstructions", e.target.value)} rows={2} className={inputCls} placeholder="Anything else the driver should know" />
        </Field>
      </div>
    </div>
  );
}
