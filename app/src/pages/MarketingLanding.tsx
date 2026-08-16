import { useEffect, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import {
  Car, Package, GraduationCap, Bot, Wallet, Gift, ShieldAlert, Crown, Download,
  ChevronDown, ChevronLeft, ChevronRight, Navigation2, Users, MapPin, CheckCircle2, Rocket, Shield,
  TrendingUp, Clock3, Award, UserPlus, Building2, Sun, Moon, Mail, Phone,
} from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/supportContact";
import Hero3DVehicle from "@/components/Hero3DVehicle";
import type { VehicleModelType } from "@/lib/vehicleModels3D";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import AppShowcase from "@/components/marketing/AppShowcase";
import CountdownBlock from "@/components/marketing/CountdownBlock";
import FeatureDetailModal from "@/components/marketing/FeatureDetailModal";
import {
  HomeBookingScreen, LiveTrackingScreen, WalletScreen, ParcelScreen, SchoolModeScreen,
  WingmanChatScreen, OffersScreen, SafetyScreen, FlyingPlusScreen,
  EarningsScreen, DocumentsScreen,
} from "@/components/marketing/AppScreens";
import { useCountdown } from "@/hooks/useCountdown";
import { useTheme } from "@/contexts/ThemeContext";

const LAUNCH_DATE = new Date("2026-08-15T00:00:00+05:30");

const particles = Array.from({ length: 14 }).map((_, i) => ({
  width: 3 + Math.random() * 5,
  height: 3 + Math.random() * 5,
  left: Math.random() * 100,
  top: Math.random() * 100,
  color: i % 3 === 0 ? "#FF6B00" : i % 3 === 1 ? "#94A3B8" : "#138808",
  animationDelay: Math.random() * 3,
  animationDuration: 3 + Math.random() * 3,
}));

const HERO_VEHICLES: { type: VehicleModelType; label: string }[] = [
  { type: "e-riksha", label: "E-Rickshaw Rides" },
  { type: "e-riksha-woman", label: "Women-Only Rides" },
  { type: "e-riksha-parcel", label: "Parcel Delivery" },
  { type: "e-riksha-school", label: "School Transport" },
];

const NOTIFICATION_CARDS = [
  { icon: Car, text: "Driver arriving in 2 min", color: "#138808" },
  { icon: CheckCircle2, text: "Ride booked successfully", color: "#FF6B00" },
  { icon: Wallet, text: "Payment successful — ₹64", color: "#0EA5E9" },
  { icon: Package, text: "Parcel delivered", color: "#7C3AED" },
  { icon: GraduationCap, text: "School ride active", color: "#1E3A5F" },
];

const FEATURES = [
  {
    icon: Car, color: "#FF6B00", bg: "#FFF5EB", title: "Auto & E-Rickshaw Rides", desc: "Share, reserve, women-only or corporate rides.",
    Screen: HomeBookingScreen, dark: false,
    detail: "Book an auto or e-rickshaw in seconds. Choose Share Ride to split the fare, Reserve for a scheduled pickup, or Women-only for a verified woman driver — all from the same home screen, with the fare shown before you confirm.",
  },
  {
    icon: Package, color: "#138808", bg: "#E8F5E8", title: "Parcel Delivery", desc: "Send or receive parcels, tracked door to door.",
    Screen: ParcelScreen, dark: false,
    detail: "Send a parcel on the same e-rickshaws already moving through your city. Pick a size, get a live tracking ID, and both ends get a PIN-verified handoff so nothing goes missing.",
  },
  {
    icon: GraduationCap, color: "#1E3A5F", bg: "#E8EEF5", title: "School Transport", desc: "PIN-verified pickup & drop for your child.",
    Screen: SchoolModeScreen, dark: false,
    detail: "A dedicated School Mode for your child's daily commute — driver, guardian and student are all verified, and every pickup and drop is confirmed with a 4-digit PIN so you always know they're safe.",
  },
  {
    icon: Navigation2, color: "#0EA5E9", bg: "#E0F2FE", title: "Live 3D Tracking", desc: "Watch your ride move on the map in real time.",
    Screen: LiveTrackingScreen, dark: true,
    detail: "No more guessing where your ride is — watch your actual vehicle move along its route in real time, with live ETA updates right up to the moment it arrives.",
  },
  {
    icon: Bot, color: "#7C3AED", bg: "#F3E8FF", title: "Wingman AI", desc: "Book by chat or voice, in your language.",
    Screen: WingmanChatScreen, dark: false,
    detail: "Just tell Wingman where you're going — by typing or speaking, in English, हिंदी or বাংলা — and it books the ride for you. No menus to dig through.",
  },
  {
    icon: Wallet, color: "#EAB308", bg: "#FEF9C3", title: "Wallet & UPI", desc: "Cashless fares, instant driver payouts.",
    Screen: WalletScreen, dark: false,
    detail: "Pay by UPI, cash or the in-app Wallet — whichever suits the moment. Every transaction is logged so you can see exactly where your money went.",
  },
  {
    icon: Gift, color: "#DB2777", bg: "#FCE7F3", title: "Offers & Referral", desc: "Daily coupons plus ₹100 per referral.",
    Screen: OffersScreen, dark: false,
    detail: "Fresh coupons every day, plus a referral code you can share — you and your friend both get ride credit the moment they take their first trip.",
  },
  {
    icon: ShieldAlert, color: "#DC2626", bg: "#FEE2E2", title: "Safety First", desc: "One-tap SOS and fully verified drivers.",
    Screen: SafetyScreen, dark: false,
    detail: "A single tap on the SOS button alerts your emergency contacts and support with your live location. Every driver is document-verified before they ever go online.",
  },
  {
    icon: Crown, color: "#B45309", bg: "#FEF3C7", title: "Flying Plus", desc: "Priority pickups, zero cancellation fees.",
    Screen: FlyingPlusScreen, dark: false,
    detail: "Subscribe to Flying Plus for priority driver matching, zero cancellation fees, and exclusive member-only offers — for riders who take Ridepay every day.",
  },
];

const TICKER = [
  "E-RICKSHAW RIDES", "PARCEL DELIVERY", "SCHOOL TRANSPORT", "LIVE 3D TRACKING",
  "WINGMAN AI", "WALLET & UPI", "REFER & EARN", "WOMEN SAFETY RIDES", "LAUNCHING 15 AUGUST",
];

const SCHOOL_STEPS = [
  { title: "Subscribe", desc: "Add your child once — school, class, home & pickup address." },
  { title: "Get Verified", desc: "Driver, guardian & student photo verification before the first trip." },
  { title: "Track Live", desc: "Watch the driver-of-the-day approach on a live map, every morning." },
  { title: "PIN Confirms It", desc: "A 4-digit PIN confirms boarding and drop-off — no guessing." },
  { title: "You're Notified", desc: "Instant alerts for pickup, drop and any delay, straight to your phone." },
];

const PARCEL_STEPS = [
  { title: "Book Pickup", desc: "Pick size & weight, we find a nearby driver in seconds." },
  { title: "Live Route", desc: "Track the courier's route to you and onward to the receiver." },
  { title: "OTP Handoff", desc: "A one-time PIN confirms the parcel reaches the right hands." },
  { title: "Delivered", desc: "Instant delivery confirmation with a full timeline, both ends." },
];

const DRIVER_BENEFITS = [
  {
    icon: TrendingUp, title: "Earn More", desc: "Transparent fares, zero commission surprises.",
    Screen: EarningsScreen, dark: false,
    detail: "Every fare is set transparently by admin-configured rates — no surprise commission cuts. See exactly what you'll earn on a ride before you accept it.",
  },
  {
    icon: Clock3, title: "Flexible Hours", desc: "Go online whenever suits you.",
    Screen: EarningsScreen, dark: false,
    detail: "No fixed shifts and no minimum hours — toggle online whenever it suits you, and go offline the moment you're done.",
  },
  {
    icon: Wallet, title: "Instant Payouts", desc: "Cash, UPI or wallet, no waiting.",
    Screen: WalletScreen, dark: false,
    detail: "Cash, UPI or the in-app Wallet — your earnings settle immediately after each ride, with no multi-day payout delay.",
  },
  {
    icon: Award, title: "Weekly Bonuses", desc: "Rewards for consistency and top ratings.",
    Screen: EarningsScreen, dark: false,
    detail: "Consistent, highly-rated drivers earn weekly performance bonuses on top of their regular fares — see your progress right in the earnings dashboard.",
  },
  {
    icon: Gift, title: "Referral Income", desc: "Earn a bonus for every driver you bring on.",
    Screen: OffersScreen, dark: false,
    detail: "Know another driver who'd be a good fit? Share your referral code — you both earn a bonus the moment they complete their first week online.",
  },
  {
    icon: UserPlus, title: "Simple Sign-Up", desc: "Upload documents once, verified in-app.",
    Screen: DocumentsScreen, dark: false,
    detail: "Upload your license, RC and insurance once — verification happens right inside the app, with a clear checklist so you always know what's left.",
  },
];

const ECOSYSTEM_NODES = [
  { icon: Users, label: "Riders", angle: -90 },
  { icon: Car, label: "Drivers", angle: -30 },
  { icon: GraduationCap, label: "Schools", angle: 30 },
  { icon: Package, label: "Parcel", angle: 90 },
  { icon: Wallet, label: "Payments", angle: 150 },
  { icon: Shield, label: "Admin", angle: 210 },
].map((n) => ({
  ...n,
  x: 50 + 42 * Math.cos((n.angle * Math.PI) / 180),
  y: 50 + 42 * Math.sin((n.angle * Math.PI) / 180),
}));

const LOVE_CARDS = [
  { icon: Users, title: "For Daily Commuters", color: "#FF6B00", desc: "A ride that's actually nearby, at a fare you can see upfront before you book." },
  { icon: GraduationCap, title: "For Parents", color: "#1E3A5F", desc: "Know exactly when your child boarded, and when they reached school safely." },
  { icon: Car, title: "For Drivers", color: "#138808", desc: "Fair fares, instant payouts, and rides that come to you — not the other way round." },
];

const FAQS = [
  { q: "When does Ridepay launch?", a: "Ridepay goes live on 15th August, starting with Ranaghat and nearby towns before expanding further." },
  { q: "Which areas are covered first?", a: "We're launching Ranaghat-first, with e-rickshaw and auto coverage across the town and its surrounding routes." },
  { q: "How do I become a driver?", a: "Tap \"Become a Driver\", complete a simple in-app registration, and upload your documents for verification." },
  { q: "Is it safe for school transport?", a: "Every school trip requires driver, guardian and student verification, plus a PIN to confirm every pickup and drop." },
  { q: "What payment methods are supported?", a: "Cash, UPI and the in-app Wallet — riders and drivers can switch between them freely." },
  { q: "Is the app free to download?", a: "Yes — downloading and creating an account on Ridepay is completely free." },
];

interface ModalFeature {
  title: string;
  detail: string;
  color: string;
  Screen: ComponentType;
  dark?: boolean;
}

export default function MarketingLanding() {
  const navigate = useNavigate();
  const goToComingSoon = () => navigate("/coming-soon");
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const countdown = useCountdown(LAUNCH_DATE);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState<ModalFeature | null>(null);
  const [vehicleIndex, setVehicleIndex] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const prevVehicle = () => setVehicleIndex((i) => (i - 1 + HERO_VEHICLES.length) % HERO_VEHICLES.length);
  const nextVehicle = () => setVehicleIndex((i) => (i + 1) % HERO_VEHICLES.length);

  // Lets a trackpad/mouse-wheel horizontal swipe or a mobile touch swipe
  // cycle the hero vehicle too, not just the arrow buttons. A cooldown
  // stops one continuous wheel gesture from firing dozens of page flips.
  const vehicleSwipeCooldown = useRef(0);
  const vehicleTouchStartX = useRef<number | null>(null);
  const handleVehicleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 24) return;
    const now = Date.now();
    if (now - vehicleSwipeCooldown.current < 450) return;
    vehicleSwipeCooldown.current = now;
    if (e.deltaX > 0) nextVehicle(); else prevVehicle();
  };
  const handleVehicleTouchStart = (e: React.TouchEvent) => {
    vehicleTouchStartX.current = e.touches[0].clientX;
  };
  const handleVehicleTouchEnd = (e: React.TouchEvent) => {
    if (vehicleTouchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - vehicleTouchStartX.current;
    vehicleTouchStartX.current = null;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) nextVehicle(); else prevVehicle();
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0F172A] overflow-x-hidden">
      {/* Sticky navbar — glass intensifies on scroll */}
      <div
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/85 dark:bg-[#0F172A]/85 backdrop-blur-xl border-b border-black/5 dark:border-white/5 shadow-sm"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="Ridepay" className="w-7 h-7 object-contain" />
            <span className={`brand-font font-bold text-base transition-colors ${scrolled ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#1A1A2E] dark:text-white"}`}>Ridepay</span>
          </div>
          <div className={`hidden md:flex items-center gap-6 text-sm font-medium transition-colors ${scrolled ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#1A1A2E]/90 dark:text-white/90"}`}>
            <button onClick={() => scrollTo("features")} className="hover:opacity-70 transition-opacity">Features</button>
            <button onClick={() => scrollTo("showcase")} className="hover:opacity-70 transition-opacity">App</button>
            <button onClick={() => scrollTo("safety")} className="hover:opacity-70 transition-opacity">Safety</button>
            <button onClick={() => scrollTo("schools")} className="hover:opacity-70 transition-opacity">Schools</button>
            <button onClick={() => scrollTo("drivers")} className="hover:opacity-70 transition-opacity">Drivers</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-[#1A1A2E] dark:text-white"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={goToComingSoon}
              className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E65A00] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shadow-saffron"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      </div>

      {/* ============ HERO ============ */}
      <div className="relative bg-white dark:bg-[#0B1220] overflow-hidden pt-24 pb-10">
        {/* soft static glow blobs — Indian tricolor accents without a busy moving gradient */}
        <div className="absolute -top-24 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#FF6B00]/20 blur-[110px] animate-blob pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-[30rem] h-[30rem] rounded-full bg-[#138808]/20 blur-[120px] animate-blob pointer-events-none" style={{ animationDelay: "4s" }} />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#2C5282]/20 dark:bg-[#2C5282]/30 blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: "7s" }} />

        {/* blueprint dot-grid texture for depth — currentColor so it can flip with the theme */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none text-[#1A1A2E] dark:text-white"
          style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />

        {/* Ashoka Chakra watermark */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 opacity-[0.06] dark:opacity-[0.05] pointer-events-none text-[#1A1A2E] dark:text-white">
          <svg width="280" height="280" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {Array.from({ length: 24 }).map((_, i) => (
              <line key={i} x1="100" y1="30" x2="100" y2="100" stroke="currentColor" strokeWidth="1" transform={`rotate(${i * 15} 100 100)`} />
            ))}
          </svg>
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-float"
              style={{
                width: `${p.width}px`, height: `${p.height}px`, left: `${p.left}%`, top: `${p.top}%`,
                backgroundColor: p.color, opacity: 0.4, animationDelay: `${p.animationDelay}s`, animationDuration: `${p.animationDuration}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left — copy */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 backdrop-blur-sm text-[#1A1A2E] dark:text-white text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5">
                <Rocket className="w-3 h-3 text-[#FF6B00] dark:text-[#FF8533]" /> Launching 15 August — Independence Day
              </span>
              <h1 className="text-[#1A1A2E] dark:text-white text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] mb-4">
                Ranaghat's Smartest Ride is <span className="text-[#FF6B00] dark:text-[#FF8533]">Almost Here</span>
              </h1>
              <p className="text-[#6B7280] dark:text-white/70 text-base max-w-md mx-auto lg:mx-0 mb-7">
                Book e-rickshaw & auto rides, send parcels, and get your kids home safe — all in one app, built for Ranaghat and beyond.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-9">
                <button
                  onClick={goToComingSoon}
                  className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E65A00] text-white font-bold text-sm px-7 py-3.5 rounded-full shadow-saffron hover:scale-[1.03] active:scale-[0.98] transition-transform"
                >
                  <Download className="w-4 h-4" /> Download App
                </button>
                <button
                  onClick={() => scrollTo("features")}
                  className="flex items-center gap-1.5 text-[#1A1A2E] dark:text-white text-sm font-semibold px-5 py-3 rounded-full border border-black/15 dark:border-white/25 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  Explore Features <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center lg:justify-start gap-2.5">
                {countdown.done ? (
                  <span className="text-[#1A1A2E] dark:text-white font-semibold text-sm">We're live! Download Ridepay now.</span>
                ) : (
                  <>
                    <CountdownBlock value={countdown.days} label="Days" light={theme === "light"} />
                    <span className="text-[#9CA3AF] dark:text-white/40 text-lg pb-4">:</span>
                    <CountdownBlock value={countdown.hours} label="Hrs" light={theme === "light"} />
                    <span className="text-[#9CA3AF] dark:text-white/40 text-lg pb-4">:</span>
                    <CountdownBlock value={countdown.minutes} label="Min" light={theme === "light"} />
                    <span className="text-[#9CA3AF] dark:text-white/40 text-lg pb-4">:</span>
                    <CountdownBlock value={countdown.seconds} label="Sec" light={theme === "light"} />
                  </>
                )}
              </div>
            </div>

            {/* Right — 3D vehicle + floating notification cards */}
            <div
              className="relative flex items-center justify-center py-1"
              onWheel={handleVehicleWheel}
              onTouchStart={handleVehicleTouchStart}
              onTouchEnd={handleVehicleTouchEnd}
            >
              <button
                onClick={prevVehicle}
                aria-label="Previous vehicle"
                className="absolute left-0 sm:-left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1A1A2E] dark:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center">
                <Hero3DVehicle
                  key={HERO_VEHICLES[vehicleIndex].type}
                  modelType={HERO_VEHICLES[vehicleIndex].type}
                  className="w-52 sm:w-72 lg:w-96"
                />
                <span className="text-xs font-semibold text-[#1A1A2E]/70 dark:text-white/70 -mt-2">
                  {HERO_VEHICLES[vehicleIndex].label}
                </span>
              </div>

              <button
                onClick={nextVehicle}
                aria-label="Next vehicle"
                className="absolute right-0 sm:-right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#1A1A2E] dark:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {NOTIFICATION_CARDS.slice(0, 3).map((n, i) => {
                const pos = [
                  "top-2 left-0 sm:-left-6",
                  "bottom-16 -right-2 sm:right-0",
                  "bottom-0 left-4 sm:left-8",
                ][i];
                return (
                  <div
                    key={n.text}
                    className={`hidden sm:flex absolute ${pos} items-center gap-2 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md rounded-xl shadow-xl px-3 py-2 animate-float`}
                    style={{ animationDelay: `${i * 0.6}s`, animationDuration: "3.5s" }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${n.color}22` }}>
                      <n.icon className="w-3 h-3" style={{ color: n.color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] whitespace-nowrap">{n.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============ TICKER ============ */}
      <div className="bg-[#1A1A2E] py-3 overflow-hidden">
        <div className="flex w-max animate-marquee">
          {[...TICKER, ...TICKER].map((word, i) => (
            <span key={i} className="flex items-center text-white/80 text-xs font-bold tracking-wider px-6 whitespace-nowrap">
              {word} <span className="ml-6 text-[#FF6B00]">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* ============ FEATURES ============ */}
      <div id="features" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-16">
        <Reveal className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Everything You Need, One App</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
            Built for riders, drivers, parents and everyone in between. Tap a card to see it inside the app.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <button
                onClick={() => setActiveFeature({ title: f.title, detail: f.detail, color: f.color, Screen: f.Screen, dark: f.dark })}
                className="group w-full text-left rounded-2xl bg-[#F8F9FA] dark:bg-[#1E293B] p-3.5 sm:p-6 space-y-2 sm:space-y-3 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300"
              >
                <div
                  className="w-9 h-9 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                  style={{ backgroundColor: f.bg }}
                >
                  <f.icon className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" style={{ color: f.color }} strokeWidth={2} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] leading-snug">{f.title}</h3>
                <p className="text-[10px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{f.desc}</p>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ============ APP SHOWCASE ============ */}
      <div id="showcase" className="bg-[#F8F9FA] dark:bg-[#0B1220] py-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">See Ridepay in Action</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
              Switch between the Passenger and Driver apps to see exactly what you'll get.
            </p>
          </Reveal>
          <Reveal>
            <AppShowcase />
          </Reveal>
        </div>
      </div>

      {/* ============ SCHOOL TRANSPORT SPOTLIGHT ============ */}
      <div id="schools" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-16">
        <Reveal>
          <div className="rounded-3xl bg-gradient-to-br from-[#1E3A5F] to-[#0F172A] p-8 sm:p-12 overflow-hidden relative">
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-[#FF6B00]/10 blur-[80px]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-[#FF8533]" />
                <span className="text-[#FF8533] text-xs font-bold uppercase tracking-wide">Flagship Feature</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 max-w-lg">School Transport Parents Can Actually Trust</h2>
              <p className="text-white/70 text-sm max-w-lg mb-10">
                Every school trip is PIN-verified end to end — from driver assignment to the moment your child steps off the vehicle.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                {SCHOOL_STEPS.map((s, i) => (
                  <div key={s.title} className="relative">
                    <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold mb-3">
                      {i + 1}
                    </div>
                    <h3 className="text-white text-sm font-semibold mb-1">{s.title}</h3>
                    <p className="text-white/60 text-xs leading-relaxed">{s.desc}</p>
                    {i < SCHOOL_STEPS.length - 1 && (
                      <div className="hidden sm:block absolute top-4 left-[calc(100%_-_0.5rem)] w-6 h-px bg-white/20" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ============ PARCEL SPOTLIGHT ============ */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <Reveal>
          <div className="grid md:grid-cols-2 gap-8 items-center rounded-3xl bg-[#F8F9FA] dark:bg-[#1E293B] p-8 sm:p-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-[#138808]" />
                <span className="text-[#138808] text-xs font-bold uppercase tracking-wide">Parcel Delivery</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">From Pickup to Doorstep, Fully Tracked</h2>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-8 max-w-md">
                Same-day local delivery on the same e-rickshaws already moving through your city.
              </p>
              <div className="space-y-4">
                {PARCEL_STEPS.map((s, i) => (
                  <div key={s.title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center text-[#138808] text-xs font-bold flex-shrink-0">{i + 1}</div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{s.title}</h3>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-72 rounded-2xl bg-[#1A1A2E] overflow-hidden">
              {/* faded map backdrop, same treatment as the Ranaghat section below */}
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
              />
              <svg className="absolute inset-0 w-full h-full opacity-70" viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
                <path d="M60 130 L110 90 L150 110 L190 60 L240 90 L260 40" stroke="#4A6A8F" strokeWidth="1.5" fill="none" opacity="0.5" />
                <path d="M40 200 L90 170 L140 190 L200 150 L250 180" stroke="#4A6A8F" strokeWidth="1.5" fill="none" opacity="0.5" />
              </svg>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 260" preserveAspectRatio="xMidYMid meet">
                <path d="M30 220 Q100 180 130 120 T230 40" stroke="#138808" strokeWidth="3" fill="none" strokeDasharray="8 8" className="animate-dash-flow" />
                <circle cx="30" cy="220" r="7" fill="#138808" />
                <circle cx="230" cy="40" r="7" fill="#FF6B00" />
              </svg>
              <div className="absolute top-8 right-4 bg-white dark:bg-[#0F172A] rounded-2xl shadow-lg p-3 flex items-center gap-2 animate-float">
                <Package className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-[10px] font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Delivered in 32 min</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ============ SAFETY ============ */}
      <div id="safety" className="bg-[#F8F9FA] dark:bg-[#1A1A2E] py-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#DC2626]/10 dark:bg-[#DC2626]/15 flex items-center justify-center mb-4">
              <ShieldAlert className="w-7 h-7 text-[#DC2626] dark:text-[#EF4444]" />
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-white mb-3">Safety Isn't an Afterthought</h2>
            <p className="text-sm text-[#6B7280] dark:text-white/60 max-w-md mx-auto">Every ride, every driver, every trip — built around getting you there safely.</p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: ShieldAlert, title: "One-Tap SOS", desc: "Instant alert to emergency contacts & support." },
              { icon: Navigation2, title: "Live GPS Sharing", desc: "Share your trip with family in real time." },
              { icon: CheckCircle2, title: "Verified Drivers", desc: "Document & background checks before onboarding." },
              { icon: Users, title: "Women-Only Rides", desc: "Verified women drivers, on request." },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 80}>
                <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl p-5 text-center h-full">
                  <s.icon className="w-6 h-6 text-[#FF6B00] dark:text-[#FF8533] mx-auto mb-3" />
                  <h3 className="text-[#1A1A2E] dark:text-white text-sm font-semibold mb-1">{s.title}</h3>
                  <p className="text-[#6B7280] dark:text-white/50 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ============ DRIVER BENEFITS ============ */}
      <div id="drivers" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-16">
        <Reveal className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Drive With Ridepay</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">Real earnings, real flexibility — built for drivers who want more control.</p>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 mb-10">
          {DRIVER_BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 60}>
              <button
                onClick={() => setActiveFeature({ title: b.title, detail: b.detail, color: "#138808", Screen: b.Screen, dark: b.dark })}
                className="w-full text-left rounded-2xl border border-gray-100 dark:border-gray-700 p-3.5 sm:p-6 h-full hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center mb-2 sm:mb-3">
                  <b.icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#138808]" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{b.title}</h3>
                <p className="text-[10px] sm:text-xs text-[#6B7280] dark:text-[#9CA3AF]">{b.desc}</p>
              </button>
            </Reveal>
          ))}
        </div>
        <Reveal className="text-center">
          <button
            onClick={goToComingSoon}
            className="inline-flex items-center gap-2 bg-[#138808] hover:bg-[#1AA814] text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-green hover:scale-[1.03] active:scale-[0.98] transition-transform"
          >
            <UserPlus className="w-4 h-4" /> Become a Driver
          </button>
        </Reveal>
      </div>

      {/* ============ MADE FOR RANAGHAT ============ */}
      <div className="bg-gradient-to-b from-[#FFF5EB] to-white dark:from-[#1A150C] dark:to-[#0F172A] py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 text-[#FF6B00] text-xs font-bold uppercase tracking-wide mb-3">
              <MapPin className="w-3.5 h-3.5" /> Local Focus
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Made for Ranaghat</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6 max-w-md">
              Ridepay isn't a copy-paste ride app dropped into a city — it's built around how Ranaghat actually moves: e-rickshaws,
              local roads, and neighbours who trust a familiar driver.
            </p>
            <div className="space-y-3">
              {[
                "Designed for everyday local travel, not just airport runs.",
                "Fares that make sense for short, local trips.",
                "Supporting local drivers and local livelihoods.",
                "Helping local businesses deliver, same day.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#138808] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{line}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative h-72 rounded-3xl bg-[#1A1A2E] overflow-hidden">
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
              />
              <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 300 260">
                <path d="M10 230 L90 190 L140 210 L190 140 L260 120" stroke="#FF6B00" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-dash-flow" />
                <path d="M40 40 L110 70 L170 40 L240 80" stroke="#138808" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-dash-flow" />
              </svg>
              {[
                { x: "15%", y: "88%", label: "Station Road" },
                { x: "47%", y: "80%", label: "College Gate" },
                { x: "63%", y: "54%", label: "Hospital" },
                { x: "86%", y: "46%", label: "Bus Stand" },
                { x: "13%", y: "16%", label: "Ranaghat Court" },
                { x: "80%", y: "31%", label: "Railway Station" },
              ].map((pin) => (
                <div key={pin.label} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: pin.x, top: pin.y }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00] border-2 border-white shadow animate-pulse-ring" />
                  <span className="text-white text-[9px] font-medium mt-1 bg-black/40 px-1.5 py-0.5 rounded whitespace-nowrap">{pin.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ============ ECOSYSTEM ============ */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">One Connected Ecosystem</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">
            Riders, drivers, schools, businesses and payments — all working together in real time.
          </p>
        </Reveal>
        <Reveal>
          <div className="relative rounded-3xl bg-[#1A1A2E] py-10 overflow-hidden">
            {/* faded map backdrop tying the ecosystem back to the same local-Ranaghat visual language */}
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            />
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 mx-auto">
              <svg className="absolute inset-0 w-full h-full animate-ring-spin" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#FF6B00" strokeWidth="0.6" strokeDasharray="2 4" opacity="0.5" />
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
                <img src="/assets/logo.png" alt="Ridepay" className="w-8 h-8 object-contain" />
              </div>
              {ECOSYSTEM_NODES.map((n) => (
                <div
                  key={n.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"
                  style={{ left: `${n.x}%`, top: `${n.y}%` }}
                >
                  <div className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center">
                    <n.icon className="w-[18px] h-[18px] text-[#1E3A5F]" />
                  </div>
                  <span className="text-[10px] font-semibold text-white whitespace-nowrap">{n.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ============ STATS ============ */}
      <div className="bg-[#E8EEF5] dark:bg-[#1E3A5F] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-10">
            <span className="text-[#FF6B00] dark:text-[#FF8533] text-xs font-bold uppercase tracking-wide">Building Momentum</span>
            <h2 className="text-[#1A1A2E] dark:text-white text-2xl md:text-3xl font-bold mt-2">Ranaghat Is Getting Ready</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 9, suffix: "+", label: "Core Features" },
              { value: 3, suffix: "", label: "Languages Supported" },
              { value: 100, suffix: "%", label: "Cashless Ready" },
              { value: 15, suffix: "", label: "August Launch", isDate: true },
            ].map((s) => (
              <Reveal key={s.label}>
                <p className="text-[#1A1A2E] dark:text-white text-2xl md:text-3xl font-extrabold">
                  {s.isDate ? "15" : <CountUp target={s.value} suffix={s.suffix} />}
                </p>
                <div className="w-8 h-0.5 mx-auto my-1.5 bg-gradient-to-r from-[#FF6B00] via-[#9CA3AF] dark:via-white to-[#138808] rounded-full" />
                <p className="text-[#6B7280] dark:text-white/70 text-xs">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ============ WHY PEOPLE WILL LOVE IT ============ */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Built Around Real People</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-md mx-auto">We're launching soon — here's who Ridepay is designed for.</p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {LOVE_CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <div className="rounded-2xl bg-[#F8F9FA] dark:bg-[#1E293B] p-6 h-full">
                <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${c.color}18` }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
                <h3 className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">{c.title}</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ============ FAQ ============ */}
      <div className="bg-[#F8F9FA] dark:bg-[#0B1220] py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Reveal className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">Frequently Asked Questions</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group bg-white dark:bg-[#1E293B] rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] list-none">
                  {f.q}
                  <ChevronDown className="w-4 h-4 text-[#9CA3AF] transition-transform group-open:rotate-180 flex-shrink-0 ml-3" />
                </summary>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* ============ FINAL CTA ============ */}
      <div className="relative bg-[#0B1220] overflow-hidden">
        <div className="absolute -top-20 left-1/4 w-80 h-80 rounded-full bg-[#FF6B00]/20 blur-[100px] animate-blob pointer-events-none" />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 rounded-full bg-[#138808]/20 blur-[100px] animate-blob pointer-events-none" style={{ animationDelay: "5s" }} />
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center">
          <Reveal className="flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full mb-5">
              🇮🇳 Launching 15 August
            </span>
            <h2 className="text-white text-2xl md:text-4xl font-extrabold mb-3">Ready to Ride the Ridepay Way?</h2>
            <p className="text-white/70 text-sm mb-8 max-w-sm">Join Ranaghat's early access list — riders and drivers welcome.</p>
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
              <button
                onClick={goToComingSoon}
                className="flex items-center gap-2 bg-white text-[#1A1A2E] font-bold text-sm px-8 py-3.5 rounded-full shadow-[0_8px_30px_rgba(255,255,255,0.15)] hover:scale-[1.03] active:scale-[0.98] transition-transform"
              >
                <UserPlus className="w-4 h-4 text-[#FF6B00]" /> Become a Rider
              </button>
              <button
                onClick={goToComingSoon}
                className="flex items-center gap-2 bg-[#138808] hover:bg-[#1AA814] text-white font-bold text-sm px-8 py-3.5 rounded-full transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Become a Driver
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              {countdown.done ? (
                <span className="text-white font-semibold text-sm">We're live!</span>
              ) : (
                <>
                  <CountdownBlock value={countdown.days} label="Days" />
                  <span className="text-white/40 text-lg pb-4">:</span>
                  <CountdownBlock value={countdown.hours} label="Hrs" />
                  <span className="text-white/40 text-lg pb-4">:</span>
                  <CountdownBlock value={countdown.minutes} label="Min" />
                  <span className="text-white/40 text-lg pb-4">:</span>
                  <CountdownBlock value={countdown.seconds} label="Sec" />
                </>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ============ FOOTER ============ */}
      <div className="bg-[#1A1A2E] py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div className="flex items-center gap-2">
              <img src="/assets/logo-light.png" alt="Ridepay" className="w-7 h-7 object-contain" />
              <span className="brand-font font-bold text-base text-white">Ridepay</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-white/60">
              <button onClick={() => scrollTo("features")} className="hover:text-white transition-colors">Features</button>
              <button onClick={() => scrollTo("showcase")} className="hover:text-white transition-colors">App</button>
              <button onClick={() => scrollTo("safety")} className="hover:text-white transition-colors">Safety</button>
              <button onClick={() => scrollTo("drivers")} className="hover:text-white transition-colors">Drivers</button>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Ranaghat, WB</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 pb-2 text-xs text-white/60">
            <a href={SUPPORT_EMAIL_MAILTO} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail className="w-3.5 h-3.5" /> {SUPPORT_EMAIL}
            </a>
            <a href={SUPPORT_PHONE_TEL} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone className="w-3.5 h-3.5" /> {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
            <p className="text-white/50 text-xs">Har Safar, Aasaan Safar — Made with ❤️ for India</p>
            <p className="text-white/30 text-[10px]">© {new Date().getFullYear()} Ridepay. All rights reserved.</p>
          </div>
        </div>
      </div>

      {activeFeature && (
        <FeatureDetailModal
          title={activeFeature.title}
          detail={activeFeature.detail}
          color={activeFeature.color}
          Screen={activeFeature.Screen}
          dark={activeFeature.dark}
          onClose={() => setActiveFeature(null)}
        />
      )}
    </div>
  );
}
