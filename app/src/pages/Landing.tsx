import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Car, Shield, User, Heart, Package, GraduationCap, MapPin, Bot, Wallet, Gift, ShieldAlert, Crown, Mic,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

// Computed once at module load (not during render) so the component body
// stays pure — the particle field doesn't need to vary per mount.
const particles = Array.from({ length: 15 }).map((_, i) => ({
  width: 4 + Math.random() * 8,
  height: 4 + Math.random() * 8,
  left: Math.random() * 100,
  top: Math.random() * 100,
  color: i % 3 === 0 ? "#FF6B00" : i % 3 === 1 ? "#FFFFFF" : "#138808",
  animationDelay: Math.random() * 3,
  animationDuration: 2 + Math.random() * 3,
}));

const FEATURES = [
  { icon: Car, color: "#FF6B00", bg: "#FFF5EB", darkBg: "#3A2A1A", title: "Auto & E-Rickshaw Rides", desc: "Share, reserve or book instantly" },
  { icon: Package, color: "#138808", bg: "#E8F5E8", darkBg: "#1A3A22", title: "Parcel Delivery", desc: "Send or receive parcels fast" },
  { icon: GraduationCap, color: "#1E3A5F", bg: "#E8EEF5", darkBg: "#1A2A3A", title: "School Transport", desc: "PIN-verified daily rides for kids" },
  { icon: MapPin, color: "#0EA5E9", bg: "#E0F2FE", darkBg: "#0C2536", title: "Live 3D Tracking", desc: "Watch your ride move in real time" },
  { icon: Bot, color: "#7C3AED", bg: "#F3E8FF", darkBg: "#2D1B4E", title: "Wingman AI", desc: "Chat or speak — English, हिंदी, বাংলা" },
  { icon: Wallet, color: "#EAB308", bg: "#FEF9C3", darkBg: "#3A3212", title: "Wallet & UPI", desc: "Cashless payments, instant payouts" },
  { icon: Gift, color: "#DB2777", bg: "#FCE7F3", darkBg: "#3A1A2A", title: "Offers & Referral", desc: "Coupons + earn ₹100 per invite" },
  { icon: ShieldAlert, color: "#DC2626", bg: "#FEE2E2", darkBg: "#3A1A1A", title: "Safety First", desc: "SOS button & verified drivers" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Lets a role-specific app build (e.g. a separate driver APK pointed at
  // /app?role=driver) skip straight into that role's intro/login on a fresh
  // install too, instead of always showing the generic role picker below —
  // without this, only the "already signed in" case below was skippable.
  const presetRole = searchParams.get("role");

  // A valid session cookie (set for a year at OTP verification) already
  // identifies this device — skip role selection/login/OTP entirely instead
  // of asking a returning user to log in again. `retry: false` since a 401
  // here (no session yet) is the expected, common case, not a real error.
  const { data: session, isLoading: sessionLoading } = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (session) {
      localStorage.setItem("userRole", session.role);
      const rawPhone = (session.phone ?? "").replace(/^\+91/, "");
      if (rawPhone) localStorage.setItem("userPhone", rawPhone);

      if (!session.name) {
        navigate("/register", { state: { role: session.role, phone: rawPhone }, replace: true });
        return;
      }
      // Session role is authoritative — a stored login always wins over
      // whatever ?role= this particular launch URL happens to carry.
      if (session.role === "driver") navigate("/driver/dashboard", { replace: true });
      else if (session.role === "admin") navigate("/admin/dashboard", { replace: true });
      else navigate("/user/home", { replace: true });
      return;
    }

    // No session yet on this device — if the app build already knows which
    // role it's for, skip the picker below and go straight into that role's
    // flow. Only decide this once the session check has actually resolved
    // (sessionLoading false), so a fresh launch doesn't flash the picker.
    if (!sessionLoading && presetRole) {
      if (presetRole === "admin") navigate("/admin/login", { replace: true });
      else if (presetRole === "driver" || presetRole === "user") navigate("/intro", { state: { role: presetRole }, replace: true });
    }
  }, [session, sessionLoading, presetRole, navigate]);

  // Don't render the "Choose Your Role" picker at all while we might still
  // redirect away from it — previously this rendered immediately and only
  // navigated once the session check resolved, so every returning user saw
  // a visible flash of the picker before landing on their real dashboard.
  const willRedirect = sessionLoading || !!session || (!!presetRole && ["admin", "driver", "user"].includes(presetRole));
  if (willRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-tricolor-animated">
        <img src="/assets/logo.png" alt="Ridepay" className="w-32 h-auto drop-shadow-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gradient-tricolor-animated relative overflow-hidden">
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: `${particle.width}px`,
              height: `${particle.height}px`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              backgroundColor: particle.color,
              opacity: 0.3,
              animationDelay: `${particle.animationDelay}s`,
              animationDuration: `${particle.animationDuration}s`,
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <div className="flex flex-col items-center px-6 pt-10 pb-4 relative z-10">
        {/* Logo */}
        <img src="/assets/logo.png" alt="Ridepay" className="w-28 h-auto drop-shadow-lg mb-3" />

        {/* Ashoka Chakra watermark */}
        <div className="absolute top-6 opacity-[0.06] pointer-events-none">
          <svg width="180" height="180" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#1E3A5F" strokeWidth="2" />
            {Array.from({ length: 24 }).map((_, i) => (
              <line key={i} x1="100" y1="30" x2="100" y2="100" stroke="#1E3A5F" strokeWidth="1.5" transform={`rotate(${i * 15} 100 100)`} />
            ))}
          </svg>
        </div>

        <h1 className="text-white text-2xl font-bold text-center mb-1 drop-shadow-md">Har Safar, Assaan Safar</h1>
        <p className="text-white/85 text-center text-sm mb-3">India's e-rickshaw ride, parcel & school transport app</p>

        {/* Hero e-rickshaw illustration — the real branded Ridepay vehicle, not a stock icon */}
        <img
          src="/assets/share-rickshaw.png"
          alt="Ridepay e-rickshaw"
          className="w-full max-w-[280px] h-auto drop-shadow-2xl -mb-1"
        />

        {/* Trust stats — dark pill so the text stays readable regardless of
            where the tricolor gradient lands behind it (bright saffron up
            top, near-white lower down). */}
        <div className="flex items-center gap-3 mt-2 px-4 py-1.5 rounded-full bg-[#1A1A2E]/70 backdrop-blur-sm text-white text-xs font-medium">
          <span>50K+ Rides</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>500+ E-Rickshaws</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>4.8★ Rated</span>
        </div>
      </div>

      {/* Content Panel */}
      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl px-6 pt-7 pb-8 relative z-10 space-y-7">
        {/* Feature Grid */}
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB] text-center mb-1">Everything You Need</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] text-center mb-4">One app for every trip, delivery and daily commute</p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A] p-3.5 space-y-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: f.bg }}
                >
                  <f.icon className="w-[18px] h-[18px]" style={{ color: f.color }} strokeWidth={2} />
                </div>
                <h3 className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] leading-snug">{f.title}</h3>
                <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Flying Plus banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#1E3A5F] to-[#2C5282] p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-[#FFD700]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white text-sm font-bold">Flying Plus</h3>
            <p className="text-white/70 text-xs">Priority pickups & zero cancellation fees</p>
          </div>
        </div>

        {/* Refer & Earn spotlight */}
        <div className="rounded-2xl bg-[#FFF5EB] dark:bg-[#2A2015] flex items-center gap-3 pr-4 overflow-hidden">
          <img src="/assets/refer-illustration.png" alt="Refer a friend" className="w-20 h-20 object-cover flex-shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">Refer & Earn ₹100</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Invite friends, you both get ride credit</p>
          </div>
        </div>

        {/* Multilingual voice booking */}
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">Book in Your Language</h3>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">Talk to Wingman by voice or chat — it understands all three.</p>
          <div className="flex gap-2">
            {["English", "हिंदी", "বাংলা"].map((lang) => (
              <span key={lang} className="px-3 py-1.5 rounded-full bg-[#F8F9FA] dark:bg-[#0F172A] text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                {lang}
              </span>
            ))}
          </div>
        </div>

        {/* Role Selection */}
        <div>
          <h2 className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] text-center mb-6">Choose Your Role</h2>

          <div className="space-y-4">
            {/* User Card */}
            <button
              onClick={() => navigate("/intro", { state: { role: "user" }, replace: true })}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A] border-l-4 border-[#FF6B00] hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center">
                <User className="w-6 h-6 text-[#FF6B00]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Rider</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Book rides and travel safely</p>
              </div>
            </button>

            {/* Driver Card */}
            <button
              onClick={() => navigate("/intro", { state: { role: "driver" }, replace: true })}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A] border-l-4 border-[#138808] hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center">
                <Car className="w-6 h-6 text-[#138808]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Driver</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Earn with every ride</p>
              </div>
            </button>

            {/* Admin Card */}
            <button
              onClick={() => navigate("/admin/login", { replace: true })}
              className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A] border-l-4 border-[#1E3A5F] hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-full bg-[#E8EEF5] dark:bg-[#1A2A3A] flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#1E3A5F] dark:text-[#93C5FD]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Admin</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Manage and monitor</p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1 text-xs text-[#9CA3AF] dark:text-[#64748B]">
          <span>Made with</span>
          <Heart className="w-3 h-3 text-[#FF6B00] fill-[#FF6B00]" />
          <span>pride for India</span>
        </div>
      </div>
    </div>
  );
}
