import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { ArrowLeft, HelpCircle, MessageCircle, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const role = (location.state?.role as string) || searchParams.get("role") || "user";
  const { theme, toggleTheme } = useTheme();

  // Admin no longer goes through phone+OTP at all (verifyOtp's role schema
  // rejects "admin" server-side now) — a stray ?role=admin link or old
  // bookmark redirects straight to the real admin login instead of showing
  // an OTP screen that would just fail with a confusing error at the end.
  useEffect(() => {
    if (role === "admin") navigate("/admin/login", { replace: true });
  }, [role, navigate]);

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  // Remembers which channel the code was actually sent on, so "Resend"
  // and the "sent to..." copy on the OTP screen stay accurate.
  const [otpChannel, setOtpChannel] = useState<"sms" | "whatsapp">("sms");

  const sendOtpMutation = trpc.auth.sendOtp.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();
  const loading = sendOtpMutation.isPending || verifyOtpMutation.isPending;

  const handleSendOtp = (channel: "sms" | "whatsapp" = otpChannel) => {
    if (phone.length !== 10) return;
    setError("");
    setOtpChannel(channel);
    sendOtpMutation.mutate(
      { phone, channel },
      {
        onSuccess: () => setStep("otp"),
        onError: (err) => setError(err.message || "Couldn't send the OTP — please try again."),
      }
    );
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);
    if (value && index < 3) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Box already empty (its own digit was already cleared by a prior
    // backspace) — step back a box and clear that one too, so backspace
    // walks the whole code away digit by digit instead of getting stuck
    // once it hits an empty box.
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      document.getElementById(`otp-${index - 1}`)?.focus();
    } else if (e.key === "Enter") {
      handleVerify();
    }
  };

  const handleVerify = () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 4) return;
    setError("");
    verifyOtpMutation.mutate(
      { phone, code: enteredOtp, role: role as "user" | "driver", channel: otpChannel },
      {
        onSuccess: (result) => {
          // The real session cookie (set server-side, 1 year) is now the
          // source of truth for "am I logged in" — these localStorage keys
          // stay in sync purely so the rest of the app's many existing
          // pages (which all read identity from localStorage) keep working
          // unchanged.
          localStorage.setItem("userRole", role);
          localStorage.setItem("userPhone", phone);

          if (result.isNewUser) {
            // Drivers get the full step-by-step onboarding wizard instead of
            // the rider's single-page profile form — Register.tsx only
            // handles the rider path now.
            if (role === "driver") navigate("/driver/onboarding", { replace: true });
            else navigate("/register", { state: { role, phone }, replace: true });
            return;
          }

          // Collapses the whole auth flow (landing/intro/login/otp) out of
          // history so the back button on the home screen exits the app
          // instead of stepping back into login. A driver who signed up
          // before but never finished the wizard (or was rejected and needs
          // to fix something) lands back in it — DriverDashboard.tsx itself
          // redirects there once it knows the onboarding status.
          if (role === "user") navigate("/user/home", { replace: true });
          else if (role === "driver") navigate("/driver/dashboard", { replace: true });
        },
        onError: (err) => setError(err.message || "That code is incorrect or has expired."),
      }
    );
  };

  const roleLabels: Record<string, { title: string; subtitle: string }> = {
    user: { title: "Rider Login", subtitle: "Book your ride in seconds" },
    driver: { title: "Driver Login", subtitle: "Start earning today" },
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A]">
      {/* Tricolor divider */}
      <div className="tricolor-divider" />

      <div className="max-w-md mx-auto px-6 py-6">
        {/* Header — a 3-column grid, not flex justify-between, so the logo
            stays truly centered no matter how wide either side's button
            group is (justify-between only splits the *remaining* space,
            which drifts the moment the two sides aren't equal width). */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-8">
          <button
            onClick={() => navigate("/app")}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm justify-self-start"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
          <img src={theme === "dark" ? "/assets/logo-light.png" : "/assets/logo.png"} alt="Ridepay" className="w-28 justify-self-center" />
          <div className="flex items-center gap-2 justify-self-end">
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              ) : (
                <Moon className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              )}
            </button>
            <button
              onClick={() => navigate("/help/faq")}
              aria-label="Help"
              className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm"
            >
              <HelpCircle className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">
          {step === "phone" ? "Login" : "Verify OTP"}
        </h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-8">
          {step === "phone"
            ? roleLabels[role]?.subtitle || "Enter your mobile number to continue"
            : `Enter the 4-digit code sent to ${otpChannel === "whatsapp" ? "your WhatsApp at" : ""} +91 ${phone}`}
        </p>

        {step === "phone" ? (
          <div className="space-y-6">
            {/* Phone Input */}
            <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Mobile Number</label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-[#E8F5E8] dark:bg-[#1A3A22] px-3 py-2.5 rounded-lg flex-shrink-0">
                  <span className="text-lg">
                    <svg width="20" height="14" viewBox="0 0 640 480">
                      <path fill="#f93" d="M0 0h640v160H0z" />
                      <path fill="#fff" d="M0 160h640v160H0z" />
                      <path fill="#138808" d="M0 320h640v160H0z" />
                      <circle cx="320" cy="240" r="60" fill="#008" />
                    </svg>
                  </span>
                  <span className="font-semibold text-[#138808] text-sm">+91</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Enter mobile number"
                  className="flex-1 min-w-0 text-lg font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF]"
                  maxLength={10}
                />
              </div>
            </div>

            {error && <p className="text-sm text-[#DC2626]">{error}</p>}

            {/* Send OTP Button */}
            <button
              onClick={() => handleSendOtp("sms")}
              disabled={phone.length !== 10 || loading}
              className="w-full btn-saffron py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && otpChannel === "sms" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                "Send OTP via SMS"
              )}
            </button>

            <button
              onClick={() => handleSendOtp("whatsapp")}
              disabled={phone.length !== 10 || loading}
              className="w-full flex items-center justify-center gap-2 py-4 text-base font-medium rounded-xl border-2 border-[#25D366] text-[#128C7E] dark:text-[#25D366] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && otpChannel === "whatsapp" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  Send OTP via WhatsApp
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* OTP Input */}
            <div className="flex justify-center gap-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-14 h-16 bg-white dark:bg-[#1E293B] rounded-xl text-center text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#FF6B00] outline-none shadow-sm transition-colors"
                  maxLength={1}
                />
              ))}
            </div>

            {error && <p className="text-center text-sm text-[#DC2626]">{error}</p>}

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={otp.some((d) => !d) || loading}
              className="w-full btn-green py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify & Continue"
              )}
            </button>

            {/* Resend */}
            <p className="text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Didn&apos;t receive?{" "}
              <button onClick={() => handleSendOtp()} disabled={loading} className="text-[#FF6B00] font-medium disabled:opacity-50">
                Resend via {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}
              </button>
            </p>
          </div>
        )}

        {/* Terms */}
        <p className="text-center text-xs text-[#9CA3AF] dark:text-[#64748B] mt-8">
          By continuing, you agree to our{" "}
          <button onClick={() => navigate("/legal/terms")} className="text-[#FF6B00] hover:underline">Terms & Conditions</button> &{" "}
          <button onClick={() => navigate("/legal/privacy-policy")} className="text-[#FF6B00] hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
}
