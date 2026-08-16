import { useNavigate } from "react-router";
import { Construction, Users } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";
import type { routeRestrictionSeverityEnum, routeRestrictionReasonEnum } from "@db/schema";

type RestrictionRow = inferRouterOutputs<AppRouter>["routeRestriction"]["list"][number];
export type RestrictionSeverity = (typeof routeRestrictionSeverityEnum)[number];
export type RestrictionReason = (typeof routeRestrictionReasonEnum)[number];

export const SEVERITY_META: Record<RestrictionSeverity, { label: string; color: string; bg: string }> = {
  advisory: { label: "Advisory", color: "#CA8A04", bg: "#FEF9C3" },
  restricted: { label: "Restricted", color: "#FF6B00", bg: "#FFF5EB" },
  fully_blocked: { label: "Fully Blocked", color: "#DC2626", bg: "#FEE2E2" },
  emergency_closure: { label: "Emergency Closure", color: "#FFFFFF", bg: "#111827" },
};

export const REASON_LABEL: Record<RestrictionReason, string> = {
  construction: "Road Construction",
  accident: "Accident",
  waterlogging: "Waterlogging",
  traffic: "Traffic Restriction",
  festival: "Festival",
  political_event: "Political/Event Restriction",
  police: "Police Restriction",
  emergency: "Emergency",
  other: "Other",
};

export function restrictionStatus(r: { isActive: boolean; unblockedAt: number | null; startTime: number }): "active" | "scheduled" | "expired" {
  if (r.isActive) return "active";
  if (!r.unblockedAt && r.startTime > Date.now()) return "scheduled";
  return "expired";
}

function RestrictionCard({ r, onClick }: { r: RestrictionRow; onClick: () => void }) {
  const severity = SEVERITY_META[r.severity as RestrictionSeverity] ?? SEVERITY_META.advisory;
  return (
    <button onClick={onClick} className="w-full text-left bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 space-y-1.5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Construction className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
          <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{r.name}</p>
        </div>
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex-shrink-0" style={{ color: severity.color, backgroundColor: severity.bg }}>
          {severity.label}
        </span>
      </div>
      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{REASON_LABEL[r.reason as RestrictionReason] ?? r.reason}</p>
      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        {r.isIndefinite
          ? "Until manually unblocked"
          : r.endTime
          ? `Until ${new Date(r.endTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : "—"}
      </p>
      {r.affectedRides24h > 0 && (
        <p className="text-xs text-[#DC2626] flex items-center gap-1">
          <Users className="w-3 h-3" /> {r.affectedRides24h} ride{r.affectedRides24h === 1 ? "" : "s"} affected (24h)
        </p>
      )}
    </button>
  );
}

function Section({ title, rows, onOpen }: { title: string; rows: RestrictionRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{title}</h2>
        <span className="text-xs text-[#9CA3AF]">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] text-center py-4">Nothing here.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <RestrictionCard key={r.id} r={r} onClick={() => onOpen(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminRouteRestrictions() {
  const navigate = useNavigate();
  const { data: restrictions } = trpc.routeRestriction.list.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true });

  const rows = restrictions ?? [];
  const activeRows = rows.filter((r) => restrictionStatus(r) === "active");
  const scheduledRows = rows.filter((r) => restrictionStatus(r) === "scheduled");
  const expiredRows = rows.filter((r) => restrictionStatus(r) === "expired");
  const affectedTotal = rows.reduce((sum, r) => sum + r.affectedRides24h, 0);
  const openDetail = (id: string) => navigate(`/admin/route-restrictions/${id}`);

  return (
    <AdminLayout
      title="Route & Road Control"
      subtitle="Block roads or areas — routing avoids them automatically, not just a red line on the map"
      headerActions={
        <button
          onClick={() => navigate("/admin/route-restrictions/new")}
          className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3.5 py-2 rounded-xl hover:bg-[#FF8533] transition-colors"
        >
          <Construction className="w-4 h-4" /> + Block Route
        </button>
      }
    >
      <div className="max-w-[1400px] space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active", value: activeRows.length, color: "#DC2626" },
            { label: "Scheduled", value: scheduledRows.length, color: "#0EA5E9" },
            { label: "Expired", value: expiredRows.length, color: "#6B7280" },
            { label: "Rides Affected (24h)", value: affectedTotal, color: "#FF6B00" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <p className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Active" rows={activeRows} onOpen={openDetail} />
          <Section title="Scheduled" rows={scheduledRows} onOpen={openDetail} />
          <Section title="Expired / History" rows={expiredRows} onOpen={openDetail} />
        </div>

        {rows.length === 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-8 text-center">
            <Construction className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
            <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">No road restrictions yet — block a road to get started.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
