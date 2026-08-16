import { useEffect, useState } from "react";
import PhoneMockup from "./PhoneMockup";
import {
  HomeBookingScreen, LiveTrackingScreen, WalletScreen, ParcelScreen, SchoolModeScreen,
  RideRequestScreen, EarningsScreen, TripHistoryScreen, DocumentsScreen,
} from "./AppScreens";

const PASSENGER_SCREENS = [
  { key: "home", title: "Book a Ride", desc: "Pick your ride type and go — auto, e-rickshaw, share or reserve.", dark: false, Screen: HomeBookingScreen },
  { key: "track", title: "Live 3D Tracking", desc: "Watch your actual vehicle move on the map in real time.", dark: true, Screen: LiveTrackingScreen },
  { key: "wallet", title: "Wallet & UPI", desc: "Cashless fares, referral credits and instant top-ups.", dark: false, Screen: WalletScreen },
  { key: "parcel", title: "Parcel Delivery", desc: "Send parcels with live tracking and PIN-verified handoff.", dark: false, Screen: ParcelScreen },
  { key: "school", title: "School Mode", desc: "PIN-verified pickup & drop with a live driver-of-the-day view.", dark: false, Screen: SchoolModeScreen },
];

const DRIVER_SCREENS = [
  { key: "request", title: "Accept Rides", desc: "Incoming requests with fare and distance, one tap to accept.", dark: false, Screen: RideRequestScreen },
  { key: "earnings", title: "Today's Earnings", desc: "Real-time earnings, ride count and a weekly breakdown.", dark: false, Screen: EarningsScreen },
  { key: "trips", title: "Trip History", desc: "Every completed ride with fare and rider rating.", dark: false, Screen: TripHistoryScreen },
  { key: "docs", title: "Documents & Health", desc: "Verified license, RC, insurance and vehicle health checks.", dark: false, Screen: DocumentsScreen },
];

export default function AppShowcase() {
  const [role, setRole] = useState<"passenger" | "driver">("passenger");
  const [index, setIndex] = useState(0);

  const screens = role === "passenger" ? PASSENGER_SCREENS : DRIVER_SCREENS;
  const active = screens[Math.min(index, screens.length - 1)];
  const ActiveScreen = active.Screen;

  const selectRole = (r: "passenger" | "driver") => {
    setRole(r);
    setIndex(0);
  };

  // Auto-advances through the screens for this role, like scrolling through
  // real app pages — restarts on every manual selection too (role/index are
  // both in the dependency array), so a manual tap doesn't fight the timer.
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % screens.length);
    }, 4500);
    return () => clearInterval(id);
  }, [role, index, screens.length]);

  return (
    <div className="flex flex-col items-center">
      {/* Toggle */}
      <div className="inline-flex bg-[#F8F9FA] dark:bg-[#0F172A] rounded-full p-1 mb-10 border border-gray-100 dark:border-gray-700">
        <button
          onClick={() => selectRole("passenger")}
          className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors ${role === "passenger" ? "bg-[#FF6B00] text-white shadow-saffron" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}
        >
          Passenger
        </button>
        <button
          onClick={() => selectRole("driver")}
          className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors ${role === "driver" ? "bg-[#138808] text-white shadow-green" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}
        >
          Driver
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-10 w-full">
        {/* Phone */}
        <div className="relative mx-auto" key={role}>
          <div key={active.key} className="animate-fade-slide">
            <PhoneMockup dark={active.dark}>
              <ActiveScreen />
            </PhoneMockup>
          </div>
        </div>

        {/* Caption + dot nav */}
        <div className="flex-1 max-w-xs mx-auto lg:mx-0 text-center lg:text-left">
          <span
            className="inline-block text-[11px] font-bold tracking-wide uppercase mb-2"
            style={{ color: role === "passenger" ? "#FF6B00" : "#138808" }}
          >
            {role === "passenger" ? "Passenger App" : "Driver App"}
          </span>
          <h3 className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">{active.title}</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6">{active.desc}</p>

          <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
            {screens.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setIndex(i)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  i === index
                    ? role === "passenger"
                      ? "bg-[#FF6B00] text-white"
                      : "bg-[#138808] text-white"
                    : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
