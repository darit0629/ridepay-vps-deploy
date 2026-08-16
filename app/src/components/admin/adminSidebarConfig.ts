import {
  LayoutDashboard, Map, Car, Users, IndianRupee, AlertCircle,
  Tag, Settings, Sparkles, Megaphone, GraduationCap, Wand2, Crown, LayoutPanelTop, Bell, Wallet, Gift, Timer, Zap, MapPinned, FileBarChart, Receipt, CalendarClock, Clock3, Radar, Construction,
} from "lucide-react";

// Shared by AdminLayout (renders the sidebar) and AdminGlobalSearch (indexes
// every admin page for search) — kept in its own module so neither needs to
// import the other, avoiding a circular-import initialization-order crash.
export const sidebarGroups: { label: string; items: { icon: typeof LayoutDashboard; label: string; path: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
      { icon: FileBarChart, label: "Reports", path: "/admin/reports" },
    ],
  },
  {
    label: "Live Operations",
    items: [
      { icon: Map, label: "Live Tracking", path: "/admin/tracking" },
      { icon: Sparkles, label: "AI Dispatch", path: "/admin/dispatch-ai" },
      { icon: Radar, label: "Dispatch Center", path: "/admin/dispatch-board" },
      { icon: CalendarClock, label: "Schedule Dashboard", path: "/admin/schedule-dashboard" },
      { icon: Car, label: "Rides", path: "/admin/rides" },
      { icon: GraduationCap, label: "School Transport", path: "/admin/school-transport" },
      { icon: Receipt, label: "School Billing", path: "/admin/school-billing" },
      { icon: Construction, label: "Route Restrictions", path: "/admin/route-restrictions" },
    ],
  },
  {
    label: "People",
    items: [
      { icon: Car, label: "Drivers", path: "/admin/drivers" },
      { icon: Users, label: "Customers", path: "/admin/customers" },
      { icon: AlertCircle, label: "Complaints", path: "/admin/complaints" },
    ],
  },
  {
    label: "Pricing & Fares",
    items: [
      { icon: Wand2, label: "Fare Configuration", path: "/admin/fare-configuration" },
      { icon: Clock3, label: "Rental Pricing", path: "/admin/rental-pricing" },
      { icon: Zap, label: "Surge Pricing", path: "/admin/surge-pricing" },
      { icon: MapPinned, label: "Zone Pricing", path: "/admin/zone-pricing" },
      { icon: IndianRupee, label: "Commission Settings", path: "/admin/commission-settings" },
      { icon: Timer, label: "Cancellation Rules", path: "/admin/cancellation-rules" },
    ],
  },
  {
    label: "Finance",
    items: [
      { icon: IndianRupee, label: "Financials", path: "/admin/financials" },
      { icon: Receipt, label: "Transactions", path: "/admin/transactions" },
      { icon: Wallet, label: "Settlement Center", path: "/admin/settlement-center" },
    ],
  },
  {
    label: "Growth & Marketing",
    items: [
      { icon: Tag, label: "Offers", path: "/admin/offers" },
      { icon: Crown, label: "Subscriptions", path: "/admin/subscriptions" },
      { icon: Megaphone, label: "Advertising", path: "/admin/advertising" },
      { icon: Gift, label: "Referral Program", path: "/admin/referral-program" },
      { icon: Bell, label: "Push Notifications", path: "/admin/notifications" },
      { icon: LayoutPanelTop, label: "Home Panel", path: "/admin/home-panel" },
    ],
  },
  {
    label: "System",
    items: [{ icon: Settings, label: "Settings", path: "/admin/settings" }],
  },
];
