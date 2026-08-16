import { GraduationCap, Star, Sparkles, Send, Mic } from "lucide-react";

// Most of these render real screenshots captured from the live app (see
// scripts/capture-screenshots.mjs) — not recreations. A few stay hand-built
// where no good real state exists yet: Live Tracking (needs an active
// matched ride), Wingman AI chat (Gemini quota is 0 on the demo key, so a
// real conversation would just show the fallback error), and School Mode
// (needs an approved subscription that doesn't exist in a fresh session).

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-full h-full object-cover object-top" loading="lazy" />;
}

export function HomeBookingScreen() {
  return <Screenshot src="/assets/screenshots/home-booking.png" alt="Ridepay ride booking home screen" />;
}

export function ParcelScreen() {
  return <Screenshot src="/assets/screenshots/parcel.png" alt="Ridepay parcel delivery booking screen" />;
}

export function WalletScreen() {
  return <Screenshot src="/assets/screenshots/wallet.png" alt="Ridepay wallet and payment methods screen" />;
}

export function OffersScreen() {
  return <Screenshot src="/assets/screenshots/offers.png" alt="Ridepay offers and coupons screen" />;
}

export function SafetyScreen() {
  return <Screenshot src="/assets/screenshots/safety.png" alt="Ridepay safety center screen" />;
}

export function FlyingPlusScreen() {
  return <Screenshot src="/assets/screenshots/flying-plus.png" alt="Ridepay Flying Plus membership screen" />;
}

export function RideRequestScreen() {
  return <Screenshot src="/assets/screenshots/driver-dashboard.png" alt="Ridepay driver dashboard screen" />;
}

export function EarningsScreen() {
  return <Screenshot src="/assets/screenshots/driver-earnings.png" alt="Ridepay driver earnings screen" />;
}

export function TripHistoryScreen() {
  return <Screenshot src="/assets/screenshots/driver-trips.png" alt="Ridepay driver trip history screen" />;
}

export function DocumentsScreen() {
  return <Screenshot src="/assets/screenshots/driver-documents.png" alt="Ridepay driver vehicle health screen" />;
}

export function LiveTrackingScreen() {
  return (
    <div className="h-full relative bg-gradient-to-br from-[#16213e] to-[#0F172A]">
      <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 260 540" preserveAspectRatio="none">
        <path d="M30 470 Q110 350 80 240 T180 90" stroke="#FF6B00" strokeWidth="3" fill="none" strokeDasharray="7 7" className="animate-dash-flow" />
      </svg>
      <div className="absolute" style={{ top: "210px", left: "115px" }}>
        <div className="w-7 h-7 rounded-full bg-[#FF6B00]/30 flex items-center justify-center animate-pulse-ring" />
        <div className="w-3.5 h-3.5 rounded-full bg-[#FF6B00] border border-white absolute inset-0 m-auto" />
      </div>
      <div className="absolute top-8 inset-x-3 bg-white/10 backdrop-blur-md rounded-xl px-3 py-2">
        <p className="text-[9px] text-white/70">Tracking your ride</p>
        <p className="text-[10px] text-white font-semibold">Live 3D vehicle position</p>
      </div>
      <div className="absolute bottom-4 inset-x-3 bg-[#1E293B] rounded-xl p-2.5 space-y-1.5">
        <p className="text-[9px] text-[#138808] font-semibold">● Arriving in 3 min</p>
        <p className="text-[10px] text-white font-bold">Rakesh Kumar · Bajaj Maxima</p>
        <div className="flex gap-1">
          {["4", "2", "1", "9"].map((d, i) => (
            <span key={i} className="w-5 h-6 rounded bg-[#0F172A] text-white text-[9px] font-bold flex items-center justify-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SchoolModeScreen() {
  return (
    <div className="pt-8 px-3 space-y-2.5 h-full">
      <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-[#FF6B00]" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1A1A2E]">Ayaan Sharma</p>
          <p className="text-[8px] text-[#6B7280]">Class 4B · Ranaghat Public School</p>
        </div>
      </div>
      <div className="bg-[#E8F5E8] rounded-xl p-3">
        <p className="text-[9px] font-semibold text-[#138808]">● Reached School Safely</p>
        <p className="text-[8px] text-[#1A1A2E] mt-0.5">9:02 AM · Verified by pickup PIN</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-2.5 space-y-1.5">
        <p className="text-[9px] font-bold text-[#1A1A2E]">Today's Driver</p>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#E8EEF5] flex items-center justify-center text-[9px] font-bold text-[#1E3A5F]">RK</div>
          <div className="flex-1">
            <p className="text-[8px] font-semibold text-[#1A1A2E]">Rakesh Kumar</p>
            <div className="flex items-center gap-0.5">
              <Star className="w-2 h-2 text-[#EAB308] fill-[#EAB308]" />
              <span className="text-[7px] text-[#6B7280]">4.9</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WingmanChatScreen() {
  return (
    <div className="pt-8 px-3 h-full flex flex-col">
      <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm p-2.5 mb-2">
        <div className="w-6 h-6 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3 h-3 text-[#7C3AED]" />
        </div>
        <p className="text-[9px] font-bold text-[#1A1A2E]">Wingman · Online</p>
      </div>
      <div className="flex-1 space-y-2">
        <div className="bg-white rounded-xl rounded-bl-sm shadow-sm px-2.5 py-2 max-w-[80%]">
          <p className="text-[8px] text-[#1A1A2E]">Hi! Where would you like to go today?</p>
        </div>
        <div className="bg-[#FF6B00] rounded-xl rounded-br-sm px-2.5 py-2 max-w-[75%] ml-auto">
          <p className="text-[8px] text-white">রেলওয়ে স্টেশনে যেতে চাই</p>
        </div>
        <div className="bg-white rounded-xl rounded-bl-sm shadow-sm px-2.5 py-2 max-w-[85%]">
          <p className="text-[8px] text-[#1A1A2E]">Booking your ride to Railway Station — confirming pickup now.</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-white rounded-full shadow-sm px-2.5 py-1.5 mt-2">
        <p className="text-[8px] text-[#9CA3AF] flex-1">Type or speak…</p>
        <Mic className="w-3 h-3 text-[#FF6B00]" />
        <Send className="w-3 h-3 text-[#FF6B00]" />
      </div>
    </div>
  );
}
