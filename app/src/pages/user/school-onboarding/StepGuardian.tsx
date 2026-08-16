import { Users, Mail, Phone, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Field, PhotoPicker, inputCls, cardCls } from "./onboardingUi";
import type { SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
}

export default function StepGuardian({ data, update }: Props) {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0EA5E9]" /> Guardian Details
        </h2>
        <p className="text-xs text-[#9CA3AF]">{user?.name ?? ""} · {user?.phone ? `+91 ${user.phone}` : ""}</p>
        <PhotoPicker label="Guardian Photo (optional)" value={data.guardianPhotoUrl} onChange={(v) => update("guardianPhotoUrl", v)} />
        <Field label="Email" icon={Mail}>
          <input type="email" value={data.guardianEmail} onChange={(e) => update("guardianEmail", e.target.value)} className={inputCls} placeholder="you@example.com" />
        </Field>
        <Field label="Emergency Contact" icon={Phone}>
          <input value={data.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} className={inputCls} placeholder="+91 90000 00000" />
        </Field>
        <Field label="Authorized Pickup Persons (comma separated)" icon={ShieldAlert}>
          <input value={data.authorizedPickupPersons} onChange={(e) => update("authorizedPickupPersons", e.target.value)} className={inputCls} placeholder="Grandmother, Uncle Raj" />
        </Field>
      </div>
    </div>
  );
}
