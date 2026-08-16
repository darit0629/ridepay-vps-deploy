import { useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, BatteryCharging, Wrench, CircleDot, ShieldCheck, FileText, CalendarClock,
  CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useDriverDocuments } from "@/contexts/DriverDocumentsContext";
import { useNotifications } from "@/contexts/NotificationsContext";

const battery = { percent: 82, health: "Good", cycles: 412 };
const tyres = [
  { position: "Front Left", condition: "Good", treadPercent: 78 },
  { position: "Front Right", condition: "Good", treadPercent: 74 },
  { position: "Rear Left", condition: "Replace Soon", treadPercent: 32 },
  { position: "Rear Right", condition: "Good", treadPercent: 68 },
];

const serviceReminder = {
  nextService: "12 Aug 2026",
  kmRemaining: 340,
  lastServiceKm: 18200,
};

export default function DriverVehicleHealth() {
  const navigate = useNavigate();
  const { documents } = useDriverDocuments();
  const { pushSystemNotification } = useNotifications();

  useEffect(() => {
    const expiringDocs = documents.filter((d) => d.status === "expiring");
    if (expiringDocs.length === 0) return;
    const timer = setTimeout(() => {
      pushSystemNotification({
        audience: "driver",
        title: "Document expiring soon",
        message: `${expiringDocs.map((d) => d.label).join(", ")} — please renew before it expires to avoid a service interruption.`,
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Vehicle Health</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Battery */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <BatteryCharging className="w-5 h-5 text-[#138808]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Battery</h3>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{battery.percent}%</span>
            <span className="text-xs font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A2D1A] px-2.5 py-1 rounded-full">{battery.health}</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-gradient-to-r from-[#138808] to-[#4ADE80] rounded-full" style={{ width: `${battery.percent}%` }} />
          </div>
          <p className="text-xs text-[#9CA3AF]">{battery.cycles} charge cycles</p>
        </div>

        {/* Tyres */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CircleDot className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Tyres</h3>
          </div>
          <div className="space-y-2">
            {tyres.map((tyre) => (
              <div key={tyre.position} className="flex items-center gap-3">
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] w-24 flex-shrink-0">{tyre.position}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tyre.treadPercent < 40 ? "bg-[#DC2626]" : "bg-[#138808]"}`}
                    style={{ width: `${tyre.treadPercent}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium w-24 text-right flex-shrink-0 ${tyre.treadPercent < 40 ? "text-[#DC2626]" : "text-[#138808]"}`}>
                  {tyre.condition}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Documents: Insurance + PUC */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Documents & Verification</h3>
          </div>
          <div className="space-y-1">
            {documents.map((doc) => (
              <div key={doc.label} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div className="w-9 h-9 rounded-full bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[#1E3A5F] dark:text-[#93C5FD]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{doc.label}</p>
                  <p className="text-xs text-[#9CA3AF]">Expires {doc.expiry}</p>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                  doc.status === "valid"
                    ? "bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808]"
                    : doc.status === "expiring"
                    ? "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]"
                    : "bg-[#F3E8FF] dark:bg-[#2D1B4E] text-[#7C3AED]"
                }`}>
                  {doc.status === "valid" && <CheckCircle2 className="w-3 h-3" />}
                  {doc.status === "expiring" && <AlertTriangle className="w-3 h-3" />}
                  {doc.status === "pending" && <Clock className="w-3 h-3" />}
                  {doc.status === "valid" ? "Valid" : doc.status === "expiring" ? "Expiring Soon" : "Pending Review"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Service Reminder */}
        <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2C5282] rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4" />
            <span className="text-xs font-semibold text-white/80">Service Reminder</span>
          </div>
          <p className="text-sm font-semibold mb-3">Next service due {serviceReminder.nextService}</p>
          <div className="flex items-center justify-between bg-white/10 rounded-xl p-3">
            <span className="flex items-center gap-1.5 text-xs text-white/70">
              <CalendarClock className="w-3.5 h-3.5" /> {serviceReminder.kmRemaining} km remaining
            </span>
            <span className="text-xs text-white/70">Last service: {serviceReminder.lastServiceKm.toLocaleString("en-IN")} km</span>
          </div>
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
