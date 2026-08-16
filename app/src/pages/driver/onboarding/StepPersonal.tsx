import { useState } from "react";
import { User, Calendar, Mail, Phone, Check } from "lucide-react";
import type { OnboardingData } from "./onboardingTypes";

const GENDERS = ["Male", "Female", "Other"];

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function FieldCard({
  icon: Icon, label, valid, children,
}: { icon: typeof User; label: string; valid: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
      <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{children}</div>
        {valid && <Check className="w-4 h-4 text-[#138808] flex-shrink-0" />}
      </div>
    </div>
  );
}

export default function StepPersonal({ data, update }: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Personal Details</h2>
      <p className="text-white/50 text-sm mb-4">Tell us a bit about yourself</p>

      <FieldCard icon={User} label="Full Name" valid={data.name.trim().length > 1}>
        <input
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          onBlur={() => touch("name")}
          placeholder="Enter your full name"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>
      {touched.name && data.name.trim().length <= 1 && <p className="text-xs text-[#FF6B6B] px-1">Enter your full name</p>}

      <FieldCard icon={Calendar} label="Date of Birth" valid={data.dob.length > 0}>
        <input
          type="date"
          value={data.dob}
          onChange={(e) => update("dob", e.target.value)}
          onBlur={() => touch("dob")}
          className="w-full bg-transparent text-base font-medium outline-none [color-scheme:dark]"
        />
      </FieldCard>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-2 block">Gender</label>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => update("gender", g)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                data.gender === g ? "bg-[#FF6B00] text-white" : "bg-white/5 text-white/60 border border-white/10"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <FieldCard icon={Mail} label="Email (optional)" valid={!!data.email && /\S+@\S+\.\S+/.test(data.email)}>
        <input
          type="email"
          value={data.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>

      <FieldCard icon={Phone} label="Emergency Contact" valid={data.emergencyContact.trim().length >= 10}>
        <input
          type="tel"
          value={data.emergencyContact}
          onChange={(e) => update("emergencyContact", e.target.value.replace(/[^\d+]/g, ""))}
          onBlur={() => touch("emergencyContact")}
          placeholder="A family member or friend's number"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>
      {touched.emergencyContact && data.emergencyContact.trim().length < 10 && (
        <p className="text-xs text-[#FF6B6B] px-1">Enter a valid 10-digit number</p>
      )}
    </div>
  );
}
