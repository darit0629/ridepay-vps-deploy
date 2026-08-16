import { useState } from "react";
import { useNavigate } from "react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { AlertTriangle, Phone, Map as MapIcon, Settings as SettingsIcon, UserPlus, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { AppRouter } from "../../../api/router";

type BoardRow = inferRouterOutputs<AppRouter>["dispatch"]["adminBoard"][number];

const RISK_META = {
  low: { label: "Safe", color: "#138808", bg: "#E8F5E8" },
  medium: { label: "At Risk", color: "#CA8A04", bg: "#FEF9C3" },
  high: { label: "Critical", color: "#DC2626", bg: "#FEE2E2" },
} as const;

const STATUS_LABEL: Record<string, string> = {
  searching: "Searching",
  accepted: "Assigned",
  pickup: "Driver En Route",
  ongoing: "In Progress",
  waiting: "Waiting",
};

function timeAgo(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

function BoardRowCard({ row, onAssign }: { row: BoardRow; onAssign: (row: BoardRow) => void }) {
  const risk = RISK_META[row.risk];
  return (
    <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 space-y-2 border-l-4" style={{ borderLeftColor: risk.color }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
            #{row.id} · {row.riderName || row.riderPhone || `Rider #${row.id}`}
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{row.pickupAddress} → {row.dropAddress}</p>
        </div>
        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold flex-shrink-0" style={{ color: risk.color, backgroundColor: risk.bg }}>
          {risk.label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
        <span>{STATUS_LABEL[row.status] ?? row.status} · {timeAgo(row.createdAt)}</span>
        {row.dispatchRound > 0 && <span>Round {row.dispatchRound}</span>}
      </div>
      {row.driverName ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">Driver: {row.driverName}</span>
          <div className="flex gap-1.5">
            {row.driverPhone && (
              <a href={`tel:${row.driverPhone}`} className="w-7 h-7 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center">
                <Phone className="w-3.5 h-3.5 text-[#138808]" />
              </a>
            )}
            <button onClick={() => onAssign(row)} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-[10px] font-semibold px-2 py-1 rounded-lg">
              <RefreshCw className="w-3 h-3" /> Reassign
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#9CA3AF]">
            {row.offeredDriverName ? `Offered to ${row.offeredDriverName}` : "No driver assigned"}
          </span>
          <button onClick={() => onAssign(row)} className="flex items-center gap-1 bg-[#FF6B00] text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
            <UserPlus className="w-3 h-3" /> Assign
          </button>
        </div>
      )}
    </div>
  );
}

function AssignSheet({ row, onClose }: { row: BoardRow; onClose: () => void }) {
  const utils = trpc.useUtils();
  // Reuses the same real approved-driver roster school.ts's assignment
  // dropdown already sources from (api/queries/school.ts's
  // listAvailableDrivers) — a simple manual-pick list rather than gating
  // this on live GPS proximity, since the board row doesn't carry pickup
  // coordinates.
  const { data: allDrivers } = trpc.school.listAvailableDrivers.useQuery();
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReassign = !!row.driverId;
  const mutation = (isReassign ? trpc.dispatch.reassign : trpc.dispatch.forceAssign).useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.conflict ? `${result.error} (${result.conflict})` : result.error);
        return;
      }
      utils.dispatch.adminBoard.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{isReassign ? "Reassign Driver" : "Assign Driver"}</h2>
        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Ride #{row.id} · {row.pickupAddress}</p>
        <select
          value={selectedDriverId ?? ""}
          onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] mb-3"
        >
          <option value="">Select a driver…</option>
          {(allDrivers ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.name} · {d.vehicle}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Force assign even if this driver has a scheduling conflict
        </label>
        {error && <p className="text-xs text-[#DC2626] mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-medium py-2.5 rounded-xl">Cancel</button>
          <button
            onClick={() => selectedDriverId && mutation.mutate({ rideId: row.id, driverId: selectedDriverId, force })}
            disabled={!selectedDriverId || mutation.isPending}
            className="flex-1 bg-[#FF6B00] text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.dispatch.getSettings.useQuery();
  const updateMutation = trpc.dispatch.updateSettings.useMutation({ onSuccess: () => utils.dispatch.getSettings.invalidate() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!settings) return null;
  const field = (key: keyof typeof settings, label: string) => (
    <div>
      <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">{label}</label>
      <input
        type="number"
        value={draft[key] ?? String(settings[key])}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
      />
    </div>
  );

  const handleSave = () => {
    const patch: Record<string, number> = {};
    for (const [k, v] of Object.entries(draft)) patch[k] = Number(v);
    updateMutation.mutate(patch, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 1500); } });
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <SettingsIcon className="w-4 h-4 text-[#7C3AED]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Dispatch Settings</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {field("baseRadiusKm", "Base Radius (km)")}
        {field("radiusExpansionKm", "Radius Expansion (km)")}
        {field("offerTimeoutSec", "Offer Timeout (s)")}
        {field("maxOfferRounds", "Max Rounds")}
        {field("firstOfferDelaySec", "First Offer Delay (s)")}
        {field("reservationBufferMin", "Reservation Buffer (min)")}
        {field("waitAndReturnMaxWaitMin", "Wait & Return Max Wait (min)")}
        {field("riskMediumAfterSec", "Risk: Medium After (s)")}
        {field("riskHighAfterSec", "Risk: High After (s)")}
      </div>
      <button onClick={handleSave} className="bg-[#1A1A2E] dark:bg-[#334155] text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90">
        {saved ? "Saved" : "Save Settings"}
      </button>
    </div>
  );
}

export default function AdminDispatchBoard() {
  const navigate = useNavigate();
  const { data: rows } = trpc.dispatch.adminBoard.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const [assignRow, setAssignRow] = useState<BoardRow | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const all = rows ?? [];
  const searching = all.filter((r) => r.status === "searching");
  const atRisk = all.filter((r) => r.risk === "medium" || r.risk === "high");
  const noDriver = all.filter((r) => !!r.dispatchExhaustedAt);
  const active = all.filter((r) => r.status !== "searching");

  return (
    <AdminLayout
      title="Dispatch Center"
      subtitle="Live driver assignment across every scheduled and active booking"
      headerActions={
        <div className="flex gap-2">
          <button onClick={() => navigate("/admin/tracking")} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-semibold px-3.5 py-2 rounded-xl">
            <MapIcon className="w-4 h-4" /> Live Map
          </button>
          <button onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3.5 py-2 rounded-xl">
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>
        </div>
      }
    >
      <div className="max-w-[1400px] space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Searching", value: searching.length, color: "#FF6B00" },
            { label: "At Risk", value: atRisk.length, color: "#CA8A04" },
            { label: "No Driver", value: noDriver.length, color: "#DC2626" },
            { label: "Active", value: active.length, color: "#138808" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{stat.label}</p>
            </div>
          ))}
        </div>

        {showSettings && <SettingsPanel />}

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Live Booking Board</h2>
            <span className="text-xs text-[#9CA3AF]">{all.length}</span>
          </div>
          {all.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-8">No active or searching bookings right now.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {all.map((row) => (
                <BoardRowCard key={row.id} row={row} onAssign={setAssignRow} />
              ))}
            </div>
          )}
        </div>
      </div>

      {assignRow && <AssignSheet row={assignRow} onClose={() => setAssignRow(null)} />}
    </AdminLayout>
  );
}
