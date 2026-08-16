import { useState } from "react";
import { User, Landmark, Hash, KeyRound, Smartphone, ShieldCheck, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { OnboardingData } from "./onboardingTypes";

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function FieldCard({
  icon: Icon, label, children,
}: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
      <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}

export default function StepBank({ data, update }: Props) {
  const [verifyError, setVerifyError] = useState("");
  const verifyMutation = trpc.driver.verifyBankIfsc.useMutation();

  const ifscFormatValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(data.bankIfscCode.trim().toUpperCase());

  const handleVerify = async () => {
    setVerifyError("");
    try {
      const result = await verifyMutation.mutateAsync({ ifscCode: data.bankIfscCode });
      update("bankVerified", true);
      update("bankBranchName", result.branchName);
      if (!data.bankName.trim()) update("bankName", result.bankName);
    } catch (err) {
      update("bankVerified", false);
      setVerifyError(err instanceof Error ? err.message : "Couldn't verify that IFSC code.");
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Bank Details</h2>
      <p className="text-white/50 text-sm mb-4">Where your earnings will be paid out</p>

      <FieldCard icon={User} label="Account Holder Name">
        <input
          value={data.bankAccountHolderName}
          onChange={(e) => update("bankAccountHolderName", e.target.value)}
          placeholder="As shown on your bank passbook"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>

      <FieldCard icon={Landmark} label="Bank Name">
        <input
          value={data.bankName}
          onChange={(e) => update("bankName", e.target.value)}
          placeholder="e.g. State Bank of India"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>

      <FieldCard icon={Hash} label="Account Number">
        <input
          value={data.bankAccountNumber}
          onChange={(e) => update("bankAccountNumber", e.target.value.replace(/\D/g, ""))}
          placeholder="Bank account number"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> IFSC Code</label>
        <div className="flex items-center gap-2 mb-1">
          <input
            value={data.bankIfscCode}
            onChange={(e) => { update("bankIfscCode", e.target.value.toUpperCase()); update("bankVerified", false); }}
            placeholder="e.g. SBIN0001234"
            maxLength={11}
            className="flex-1 min-w-0 bg-transparent text-base font-medium outline-none placeholder:text-white/30 tracking-wider"
          />
          {data.bankVerified ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-[#138808] flex-shrink-0">
              <ShieldCheck className="w-4 h-4" /> Verified
            </span>
          ) : (
            <button
              onClick={handleVerify}
              disabled={!ifscFormatValid || verifyMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B00] text-white text-xs font-semibold flex-shrink-0 disabled:opacity-40"
            >
              {verifyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Verify Bank
            </button>
          )}
        </div>
        {data.bankVerified && data.bankBranchName && (
          <p className="text-xs text-white/50">{data.bankName} · {data.bankBranchName}</p>
        )}
        {verifyError && <p className="text-xs text-[#FF6B6B]">{verifyError}</p>}
      </div>

      <FieldCard icon={Smartphone} label="UPI ID (optional)">
        <input
          value={data.upiId}
          onChange={(e) => update("upiId", e.target.value)}
          placeholder="yourname@upi"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>
    </div>
  );
}
