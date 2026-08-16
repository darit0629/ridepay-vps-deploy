import type { inferRouterOutputs } from "@trpc/server";
import { CalendarClock, MapPin, Repeat, User } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { AppRouter } from "../../../api/router";

type ScheduleStatus = "upcoming" | "active" | "completed" | "cancelled" | "expired";

const STATUS_META: Record<ScheduleStatus, { label: string; bg: string; color: string }> = {
  upcoming: { label: "Upcoming", bg: "#E0F2FE", color: "#0EA5E9" },
  active: { label: "Active", bg: "#E8F5E8", color: "#138808" },
  completed: { label: "Completed", bg: "#F3E8FF", color: "#7C3AED" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#DC2626" },
  expired: { label: "Expired", bg: "#F3F4F6", color: "#6B7280" },
};

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ScheduleRow = inferRouterOutputs<AppRouter>["schedule"]["adminList"][number];

function ScheduleRowCard({ s }: { s: ScheduleRow }) {
  const meta = STATUS_META[s.status as ScheduleStatus];
  return (
    <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
          <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
            {s.riderName || s.riderPhone || `Rider #${s.userId}`}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex-shrink-0" style={{ color: meta.color, backgroundColor: meta.bg }}>
          {meta.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        <Repeat className="w-3 h-3 flex-shrink-0" />
        {s.frequency === "once" ? "One Time" : s.frequency === "weekly" ? "Weekly" : "Monthly"} · {s.scheduledTime}
        {s.frequency === "once" && s.scheduledDate ? ` · ${s.scheduledDate}` : ""}
      </div>
      <div className="flex items-start gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        <MapPin className="w-3 h-3 text-[#138808] flex-shrink-0 mt-0.5" />
        <span className="truncate">{s.pickupAddress}</span>
      </div>
      <div className="flex items-start gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        <MapPin className="w-3 h-3 text-[#FF6B00] flex-shrink-0 mt-0.5" />
        <span className="truncate">{s.dropAddress}</span>
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: ScheduleRow[] }) {
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
          {rows.map((s) => <ScheduleRowCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

export default function AdminScheduleDashboard() {
  const { data: schedules } = trpc.schedule.adminList.useQuery(undefined, {
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const rows = schedules ?? [];
  const today = dateStr(new Date());
  const tomorrow = dateStr(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const todayRows = rows.filter((s) => s.frequency === "once" && s.scheduledDate === today && s.status !== "cancelled");
  const tomorrowRows = rows.filter((s) => s.frequency === "once" && s.scheduledDate === tomorrow && s.status !== "cancelled");
  const recurringRows = rows.filter((s) => s.frequency !== "once" && (s.status === "upcoming" || s.status === "active"));
  const cancelledRows = rows.filter((s) => s.status === "cancelled");
  const completedRows = rows.filter((s) => s.status === "completed");
  const expiredRows = rows.filter((s) => s.status === "expired");

  return (
    <AdminLayout title="Schedule Dashboard" subtitle="Real-time view of every rider's scheduled ride">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Today's Scheduled Rides" rows={todayRows} />
        <Section title="Tomorrow" rows={tomorrowRows} />
        <Section title="Recurring" rows={recurringRows} />
        <Section title="Completed" rows={completedRows} />
        <Section title="Cancelled" rows={cancelledRows} />
        <Section title="Expired" rows={expiredRows} />
      </div>
      {rows.length === 0 && (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-8 text-center">
          <CalendarClock className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
          <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">No riders have scheduled a ride yet.</p>
        </div>
      )}
    </AdminLayout>
  );
}
