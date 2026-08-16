import { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { ArrowLeft, User, Calendar, Mail, Gift } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/providers/trpc";

const genders = ["Male", "Female", "Other", "Prefer not to say"];

interface RegisterForm {
  name: string;
  dob: string;
  gender: string;
  email: string;
}

const emptyForm: RegisterForm = { name: "", dob: "", gender: "", email: "" };

// Rider registration only — a driver signing up gets the full step-by-step
// DriverOnboarding.tsx wizard instead (Login.tsx routes them there directly).
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const phone = (location.state?.phone as string) || "";
  const { theme } = useTheme();

  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  // Prefills a code shared via a deep link (?ref=CODE from the Refer & Earn
  // page's share buttons / QR) — still editable, still optional.
  const [referralCode, setReferralCode] = useState(() => (searchParams.get("ref") || "").trim().toUpperCase());
  const [referralError, setReferralError] = useState("");
  const [saveError, setSaveError] = useState("");

  const applyReferralMutation = trpc.referral.applyCode.useMutation();
  const updateUserProfileMutation = trpc.user.updateProfile.useMutation();

  const update = (field: keyof RegisterForm, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.name.trim().length > 1 && form.dob.length > 0 && form.gender.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setReferralError("");
    setSaveError("");

    try {
      // Session cookie set during OTP verification is what makes ctx.user
      // resolve here — the phone passed through navigation state is only
      // used for the localStorage mirror the rest of the app still reads.
      // Saved before applying a referral code so the referral record picks
      // up the name just typed above, not a stale/blank one from ctx.user.
      await updateUserProfileMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        dob: form.dob,
        gender: form.gender,
      });
    } catch (error) {
      setLoading(false);
      setSaveError(error instanceof Error ? error.message : "Couldn't save your profile — please try again.");
      return;
    }

    // Referral code entered at signup: both sides' bonuses go through the
    // real referral engine. An invalid code blocks the final step (so typos
    // don't silently lose the friend's bonus) — clearing the field lets
    // registration proceed without one.
    const code = referralCode.trim().toUpperCase();
    if (code) {
      const result = await applyReferralMutation.mutateAsync({ code });
      if (!result.ok) {
        setReferralError(result.error);
        setLoading(false);
        return;
      }
    }

    localStorage.setItem(`ridepay_profile_user_${phone}`, JSON.stringify({ ...form, phone }));
    setLoading(false);
    // replace: true keeps the auth flow out of history so the back
    // button on the home screen exits the app instead of returning here.
    navigate("/user/home", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A]">
      <div className="tricolor-divider" />

      <div className="max-w-md mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
          <img src={theme === "dark" ? "/assets/logo-light.png" : "/assets/logo.png"} alt="Ridepay" className="w-28" />
          <div className="w-10 h-10" />
        </div>

        <h1 className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Create Your Profile</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-8">Just a few details before your first ride</p>

        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Enter your full name"
              className="w-full text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date of Birth
            </label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => update("dob", e.target.value)}
              className="w-full text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] mb-2 block">Gender</label>
            <div className="flex flex-wrap gap-2">
              {genders.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update("gender", g)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.gender === g
                      ? "bg-[#FF6B00] text-white"
                      : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1a2540]"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email <span className="text-[#9CA3AF]">(optional)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="w-full text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5" /> Referral Code <span className="text-[#9CA3AF]">(optional)</span>
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => {
                setReferralCode(e.target.value.toUpperCase());
                setReferralError("");
              }}
              placeholder="Have a friend's code? Enter it here"
              className="w-full text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF] font-mono tracking-wider"
            />
            {referralError && <p className="text-xs text-[#DC2626] mt-2">{referralError}</p>}
          </div>

          {saveError && <p className="text-sm text-[#DC2626] text-center">{saveError}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full btn-green py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Profile...
              </span>
            ) : (
              "Continue to Home"
            )}
          </button>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] dark:text-[#64748B] mt-8">
          By continuing, you agree to our{" "}
          <span className="text-[#FF6B00]">Terms & Conditions</span> &{" "}
          <span className="text-[#FF6B00]">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
