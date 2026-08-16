import { useState, useMemo, type ReactNode } from "react";
import {
  Save, RotateCcw, Copy, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown,
  UserX, Car, Clock, Timer, Repeat, PieChart, AlertCircle, ListChecks,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { FareVehicleTypeId } from "@/contexts/FareConfigContext";
import { simulateCancellation, validateCancellationVehicleConfig } from "@/lib/cancellationVehiclePreview";

const VEHICLE_ORDER: FareVehicleTypeId[] = [
  "e-riksha-reserve", "e-riksha-share", "auto-rickshaw", "bike-taxi", "car",
  "e-riksha-women", "e-riksha-parcel", "courier", "e-riksha-school", "bike-parcel",
];

interface CancellationReason {
  id: string;
  label: string;
  enabled: boolean;
}

interface CancellationVehicleConfig {
  id: FareVehicleTypeId;
  label: string;
  passengerCancellationEnabled: boolean;
  passengerFreeCancellationMin: number;
  passengerFeeType: "fixed" | "percentage";
  passengerFeeFixedAmount: number;
  passengerFeePercentage: number;
  passengerMaxFee: number | null;
  driverCancellationEnabled: boolean;
  driverFreeCancellationMin: number;
  driverPenaltyType: "fixed" | "percentage" | "warning";
  driverPenaltyFixedAmount: number;
  driverPenaltyPercentage: number;
  passengerNoShowWaitMin: number;
  passengerNoShowCharge: number;
  driverNoShowResponseMin: number;
  autoCancelDriverAcceptEnabled: boolean;
  autoCancelDriverAcceptMin: number;
  autoCancelPassengerConfirmEnabled: boolean;
  autoCancelPassengerConfirmMin: number;
  autoCancelDriverReachPickupEnabled: boolean;
  autoCancelDriverReachPickupMin: number;
  passengerReasons: CancellationReason[];
  driverReasons: CancellationReason[];
  passengerMaxFreeCancellationsPerDay: number;
  passengerWarningThreshold: number;
  passengerRestrictionEnabled: boolean;
  passengerRestrictionHours: number;
  driverMaxDailyCancellations: number;
  driverWarningThreshold: number;
  driverRestrictionEnabled: boolean;
  driverRestrictionHours: number;
  driverAccountReviewThreshold: number;
}

const INPUT_CLASS =
  "w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]";

function Card({ icon: Icon, title, children, className }: { icon: typeof Car; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-[#FF6B00]" />
        <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={INPUT_CLASS} />
    </Field>
  );
}

function ToggleRow({ label, description, enabled, onToggle, color = "#FF6B00" }: {
  label: string; description?: string; enabled: boolean; onToggle: () => void; color?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
        enabled ? "border-transparent" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
      }`}
      style={enabled ? { borderColor: color, backgroundColor: `${color}18` } : undefined}
    >
      <div>
        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{label}</p>
        {description && <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{description}</p>}
      </div>
      <div className="w-10 h-5 rounded-full p-0.5 transition-colors flex-shrink-0" style={{ backgroundColor: enabled ? color : "#D1D5DB" }}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

function ReasonList({ title, reasons, onAdd, onUpdate, onRemove, onMove }: {
  title: string;
  reasons: CancellationReason[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<CancellationReason>) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide">{title}</p>
      {reasons.map((reason, i) => (
        <div key={reason.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2.5 flex items-center gap-2">
          <input
            type="text"
            value={reason.label}
            onChange={(e) => onUpdate(reason.id, { label: e.target.value })}
            className="flex-1 min-w-0 bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
          <button onClick={() => onMove(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 flex-shrink-0" aria-label="Move up">
            <ArrowUp className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          </button>
          <button onClick={() => onMove(i, 1)} disabled={i === reasons.length - 1} className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 flex-shrink-0" aria-label="Move down">
            <ArrowDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          </button>
          <button
            onClick={() => onUpdate(reason.id, { enabled: !reason.enabled })}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: reason.enabled ? "#138808" : "#D1D5DB" }}
            aria-label={reason.enabled ? "Disable reason" : "Enable reason"}
          >
            <div className="w-5 h-2.5 rounded-full bg-white/40 relative">
              <div className={`w-2 h-2 rounded-full bg-white absolute top-0.25 transition-transform ${reason.enabled ? "translate-x-3" : "translate-x-0.5"}`} />
            </div>
          </button>
          <button onClick={() => onRemove(reason.id)} className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0" aria-label="Delete reason">
            <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
          </button>
        </div>
      ))}
      <button onClick={onAdd} className="flex items-center gap-2 text-sm font-medium text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] px-4 py-2 rounded-xl">
        <Plus className="w-4 h-4" /> Add Reason
      </button>
    </div>
  );
}

export default function AdminCancellationRules() {
  const utils = trpc.useUtils();
  const [selectedVehicleId, setSelectedVehicleId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  const { data: serverConfig } = trpc.cancellation.getVehicleConfig.useQuery({ id: selectedVehicleId });
  const { data: allConfigs } = trpc.cancellation.listVehicleConfigs.useQuery(undefined, { refetchInterval: 5000 });

  const [draft, setDraft] = useState<CancellationVehicleConfig | null>(null);
  const [draftForId, setDraftForId] = useState<FareVehicleTypeId | null>(null);
  const [toast, setToast] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  if (serverConfig && draftForId !== selectedVehicleId) {
    setDraft(serverConfig as CancellationVehicleConfig);
    setDraftForId(selectedVehicleId);
  }

  const updateMutation = trpc.cancellation.updateVehicleConfig.useMutation({
    onSuccess: () => {
      utils.cancellation.getVehicleConfig.invalidate({ id: selectedVehicleId });
      utils.cancellation.listVehicleConfigs.invalidate();
      setToast("Saved");
      setTimeout(() => setToast(""), 2500);
    },
    onError: (err) => setToast(err.message || "Couldn't save — check the values above."),
  });
  const duplicateMutation = trpc.cancellation.duplicateVehicleConfig.useMutation({
    onSuccess: (updated) => {
      setDraft(updated as CancellationVehicleConfig);
      utils.cancellation.listVehicleConfigs.invalidate();
      setToast(`Copied from ${allConfigs?.find((v) => v.id === duplicateFromId)?.label ?? "another vehicle"}`);
      setTimeout(() => setToast(""), 2500);
    },
  });
  const restoreMutation = trpc.cancellation.restoreDefaultVehicleConfig.useMutation({
    onSuccess: (updated) => {
      setDraft(updated as CancellationVehicleConfig);
      utils.cancellation.listVehicleConfigs.invalidate();
      setToast("Restored default rules");
      setTimeout(() => setToast(""), 2500);
    },
  });

  const patch = (updates: Partial<CancellationVehicleConfig>) => setDraft((prev) => (prev ? { ...prev, ...updates } : prev));

  const hasUnsavedChanges = !!draft && !!serverConfig && JSON.stringify(draft) !== JSON.stringify(serverConfig);
  const validationError = draft ? validateCancellationVehicleConfig(draft) : null;

  const handleSave = () => {
    if (!draft || validationError) return;
    updateMutation.mutate({ id: selectedVehicleId, updates: draft });
  };
  const handleReset = () => {
    if (serverConfig) setDraft(serverConfig as CancellationVehicleConfig);
  };
  const handleDuplicate = () => duplicateMutation.mutate({ fromId: duplicateFromId, toId: selectedVehicleId });
  const handleRestoreDefault = () => restoreMutation.mutate({ id: selectedVehicleId });

  // Section G — live rule simulator, recomputed instantly against the
  // in-progress draft (client-side, no round-trip).
  const [previewFare, setPreviewFare] = useState(200);
  const [previewTimeSinceBooking, setPreviewTimeSinceBooking] = useState(1);
  const [previewWaitingTime, setPreviewWaitingTime] = useState(0);
  const [previewWho, setPreviewWho] = useState<"passenger" | "driver">("passenger");

  const previewResult = useMemo(() => {
    if (!draft) return null;
    return simulateCancellation(draft, {
      rideFare: previewFare,
      timeSinceBookingMin: previewTimeSinceBooking,
      waitingTimeMin: previewWaitingTime,
      whoCancelled: previewWho,
    });
  }, [draft, previewFare, previewTimeSinceBooking, previewWaitingTime, previewWho]);

  const addReason = (side: "passengerReasons" | "driverReasons") => {
    if (!draft) return;
    const newReason: CancellationReason = { id: `reason-${Date.now()}`, label: "", enabled: true };
    patch({ [side]: [...draft[side], newReason] } as Partial<CancellationVehicleConfig>);
  };
  const updateReason = (side: "passengerReasons" | "driverReasons", id: string, updates: Partial<CancellationReason>) => {
    if (!draft) return;
    patch({ [side]: draft[side].map((r) => (r.id === id ? { ...r, ...updates } : r)) } as Partial<CancellationVehicleConfig>);
  };
  const removeReason = (side: "passengerReasons" | "driverReasons", id: string) => {
    if (!draft) return;
    patch({ [side]: draft[side].filter((r) => r.id !== id) } as Partial<CancellationVehicleConfig>);
  };
  const moveReason = (side: "passengerReasons" | "driverReasons", index: number, direction: -1 | 1) => {
    if (!draft) return;
    const next = [...draft[side]];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ [side]: next } as Partial<CancellationVehicleConfig>);
  };

  if (!draft) {
    return (
      <AdminLayout title="Cancellation Rules">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading cancellation rules…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cancellation Rules">
      <div className="max-w-[1400px] space-y-6">
        {/* Vehicle Type Selector */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {VEHICLE_ORDER.map((id) => {
              const meta = allConfigs?.find((v) => v.id === id);
              const isSelected = id === selectedVehicleId;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedVehicleId(id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    isSelected ? "bg-[#FF6B00] text-white" : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                  }`}
                >
                  {meta?.label ?? id}
                </button>
              );
            })}
          </div>
        </div>

        {validationError && (
          <div className="bg-[#FEE2E2] dark:bg-red-950/40 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#DC2626] font-medium">{validationError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Section A — Passenger Cancellation Rules */}
          <Card icon={UserX} title="Passenger Cancellation Rules">
            <ToggleRow label="Enable Passenger Cancellation" enabled={draft.passengerCancellationEnabled} onToggle={() => patch({ passengerCancellationEnabled: !draft.passengerCancellationEnabled })} color="#138808" />
            <NumberField label="Free Cancellation Time (Minutes)" value={draft.passengerFreeCancellationMin} onChange={(v) => patch({ passengerFreeCancellationMin: Math.round(v) })} />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => patch({ passengerFeeType: "fixed" })}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${draft.passengerFeeType === "fixed" ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"}`}
              >
                Fixed Amount (₹)
              </button>
              <button
                onClick={() => patch({ passengerFeeType: "percentage" })}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${draft.passengerFeeType === "percentage" ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"}`}
              >
                Percentage (%)
              </button>
            </div>
            {draft.passengerFeeType === "fixed" ? (
              <NumberField label="Cancellation Fee (₹)" value={draft.passengerFeeFixedAmount} onChange={(v) => patch({ passengerFeeFixedAmount: v })} />
            ) : (
              <NumberField label="Cancellation Fee (%)" value={draft.passengerFeePercentage} onChange={(v) => patch({ passengerFeePercentage: v })} step="0.5" />
            )}
            <Field label="Maximum Cancellation Fee (₹, blank = no limit)">
              <input
                type="number"
                value={draft.passengerMaxFee ?? ""}
                placeholder="No limit"
                onChange={(e) => patch({ passengerMaxFee: e.target.value === "" ? null : Number(e.target.value) })}
                className={INPUT_CLASS}
              />
            </Field>
          </Card>

          {/* Section B — Driver Cancellation Rules */}
          <Card icon={Car} title="Driver Cancellation Rules">
            <ToggleRow label="Enable Driver Cancellation" enabled={draft.driverCancellationEnabled} onToggle={() => patch({ driverCancellationEnabled: !draft.driverCancellationEnabled })} color="#138808" />
            <NumberField label="Free Driver Cancellation Time (Minutes)" value={draft.driverFreeCancellationMin} onChange={(v) => patch({ driverFreeCancellationMin: Math.round(v) })} />
            <div className="grid grid-cols-3 gap-2">
              {(["fixed", "percentage", "warning"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => patch({ driverPenaltyType: t })}
                  className={`px-2 py-2.5 rounded-xl text-xs font-medium border-2 transition-colors capitalize ${draft.driverPenaltyType === t ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"}`}
                >
                  {t === "fixed" ? "Fixed (₹)" : t === "percentage" ? "Percentage (%)" : "Warning Only"}
                </button>
              ))}
            </div>
            {draft.driverPenaltyType === "fixed" && (
              <NumberField label="Penalty Amount (₹)" value={draft.driverPenaltyFixedAmount} onChange={(v) => patch({ driverPenaltyFixedAmount: v })} />
            )}
            {draft.driverPenaltyType === "percentage" && (
              <NumberField label="Penalty (%)" value={draft.driverPenaltyPercentage} onChange={(v) => patch({ driverPenaltyPercentage: v })} step="0.5" />
            )}
            {draft.driverPenaltyType === "warning" && (
              <p className="text-xs text-[#9CA3AF]">A warning is recorded on the driver's account — no monetary penalty.</p>
            )}
          </Card>

          {/* Section C — No-Show Rules */}
          <Card icon={Timer} title="No-Show Rules">
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide">Passenger No-Show</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField label="Waiting Time Before No-Show (Minutes)" value={draft.passengerNoShowWaitMin} onChange={(v) => patch({ passengerNoShowWaitMin: Math.round(v) })} />
              <NumberField label="No-Show Charge (₹)" value={draft.passengerNoShowCharge} onChange={(v) => patch({ passengerNoShowCharge: v })} />
            </div>
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide pt-2">Driver No-Show</p>
            <NumberField label="Driver Response Time (Minutes)" value={draft.driverNoShowResponseMin} onChange={(v) => patch({ driverNoShowResponseMin: Math.round(v) })} />
            <p className="text-xs text-[#9CA3AF]">Config and simulator are fully real — live passive detection (auto-flagging a no-show without an explicit action) isn't wired into the ride flow yet.</p>
          </Card>

          {/* Section D — Auto Cancellation */}
          <Card icon={Clock} title="Auto Cancellation">
            <ToggleRow
              label="Auto Cancel if Driver Doesn't Accept"
              enabled={draft.autoCancelDriverAcceptEnabled}
              onToggle={() => patch({ autoCancelDriverAcceptEnabled: !draft.autoCancelDriverAcceptEnabled })}
            />
            {draft.autoCancelDriverAcceptEnabled && (
              <NumberField label="Within (Minutes)" value={draft.autoCancelDriverAcceptMin} onChange={(v) => patch({ autoCancelDriverAcceptMin: Math.round(v) })} />
            )}
            <ToggleRow
              label="Auto Cancel if Passenger Doesn't Confirm"
              enabled={draft.autoCancelPassengerConfirmEnabled}
              onToggle={() => patch({ autoCancelPassengerConfirmEnabled: !draft.autoCancelPassengerConfirmEnabled })}
            />
            {draft.autoCancelPassengerConfirmEnabled && (
              <NumberField label="Within (Minutes)" value={draft.autoCancelPassengerConfirmMin} onChange={(v) => patch({ autoCancelPassengerConfirmMin: Math.round(v) })} />
            )}
            <ToggleRow
              label="Auto Cancel if Driver Doesn't Reach Pickup"
              enabled={draft.autoCancelDriverReachPickupEnabled}
              onToggle={() => patch({ autoCancelDriverReachPickupEnabled: !draft.autoCancelDriverReachPickupEnabled })}
            />
            {draft.autoCancelDriverReachPickupEnabled && (
              <NumberField label="Within (Minutes)" value={draft.autoCancelDriverReachPickupMin} onChange={(v) => patch({ autoCancelDriverReachPickupMin: Math.round(v) })} />
            )}
            <p className="text-xs text-[#9CA3AF]">Config is fully real and each rule is independently toggled — live timer-based enforcement isn't wired into the ride flow yet.</p>
          </Card>

          {/* Section E — Cancellation Reasons */}
          <Card icon={ListChecks} title="Cancellation Reasons" className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ReasonList
                title="Passenger Reasons"
                reasons={draft.passengerReasons}
                onAdd={() => addReason("passengerReasons")}
                onUpdate={(id, updates) => updateReason("passengerReasons", id, updates)}
                onRemove={(id) => removeReason("passengerReasons", id)}
                onMove={(i, dir) => moveReason("passengerReasons", i, dir)}
              />
              <ReasonList
                title="Driver Reasons"
                reasons={draft.driverReasons}
                onAdd={() => addReason("driverReasons")}
                onUpdate={(id, updates) => updateReason("driverReasons", id, updates)}
                onRemove={(id) => removeReason("driverReasons", id)}
                onMove={(i, dir) => moveReason("driverReasons", i, dir)}
              />
            </div>
          </Card>

          {/* Section F — Repeated Cancellation Policy */}
          <Card icon={Repeat} title="Repeated Cancellation Policy" className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide">Passenger</p>
                <NumberField label="Maximum Free Cancellations Per Day" value={draft.passengerMaxFreeCancellationsPerDay} onChange={(v) => patch({ passengerMaxFreeCancellationsPerDay: Math.round(v) })} />
                <NumberField label="Warning Threshold" value={draft.passengerWarningThreshold} onChange={(v) => patch({ passengerWarningThreshold: Math.round(v) })} />
                <ToggleRow label="Temporary Restriction After Limit" enabled={draft.passengerRestrictionEnabled} onToggle={() => patch({ passengerRestrictionEnabled: !draft.passengerRestrictionEnabled })} color="#DC2626" />
                {draft.passengerRestrictionEnabled && (
                  <NumberField label="Restriction Duration (Hours)" value={draft.passengerRestrictionHours} onChange={(v) => patch({ passengerRestrictionHours: Math.round(v) })} />
                )}
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide">Driver</p>
                <NumberField label="Maximum Daily Cancellations" value={draft.driverMaxDailyCancellations} onChange={(v) => patch({ driverMaxDailyCancellations: Math.round(v) })} />
                <NumberField label="Warning Threshold" value={draft.driverWarningThreshold} onChange={(v) => patch({ driverWarningThreshold: Math.round(v) })} />
                <ToggleRow label="Temporary Restriction" enabled={draft.driverRestrictionEnabled} onToggle={() => patch({ driverRestrictionEnabled: !draft.driverRestrictionEnabled })} color="#DC2626" />
                {draft.driverRestrictionEnabled && (
                  <NumberField label="Restriction Duration (Hours)" value={draft.driverRestrictionHours} onChange={(v) => patch({ driverRestrictionHours: Math.round(v) })} />
                )}
                <NumberField label="Account Review Trigger (cancellations)" value={draft.driverAccountReviewThreshold} onChange={(v) => patch({ driverAccountReviewThreshold: Math.round(v) })} />
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              The daily free-cancellation allowance is fully real and enforced live (see the rider/driver cancellation flow) — warning messages and temporary
              restrictions are configurable here but not yet enforced automatically.
            </p>
          </Card>

          {/* Section G — Live Rule Preview */}
          <Card icon={PieChart} title="Live Rule Preview" className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Field label="Ride Fare (₹)">
                <input type="number" value={previewFare} onChange={(e) => setPreviewFare(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Time Since Booking (min)">
                <input type="number" value={previewTimeSinceBooking} onChange={(e) => setPreviewTimeSinceBooking(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Waiting Time (min)">
                <input type="number" value={previewWaitingTime} onChange={(e) => setPreviewWaitingTime(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Vehicle">
                <input type="text" value={draft.label} disabled className={`${INPUT_CLASS} opacity-60`} />
              </Field>
              <Field label="Who Cancelled">
                <select value={previewWho} onChange={(e) => setPreviewWho(e.target.value as "passenger" | "driver")} className={INPUT_CLASS}>
                  <option value="passenger">Passenger</option>
                  <option value="driver">Driver</option>
                </select>
              </Field>
            </div>

            {previewResult && (
              <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Is Cancellation Free?</span>
                  <span className={`font-semibold ${previewResult.isFree ? "text-[#138808]" : "text-[#DC2626]"}`}>{previewResult.isFree ? "Yes" : "No"}</span>
                </div>
                {previewResult.fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Cancellation Fee</span>
                    <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewResult.fee}</span>
                  </div>
                )}
                {previewResult.penalty > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">Driver Penalty</span>
                    <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewResult.penalty}</span>
                  </div>
                )}
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                  <span className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Final Result</span>
                  <span className={`font-bold ${previewResult.isFree ? "text-[#138808]" : "text-[#FF6B00]"}`}>{previewResult.finalResult}</span>
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] pt-1">{previewResult.explanation}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select value={duplicateFromId} onChange={(e) => setDuplicateFromId(e.target.value as FareVehicleTypeId)} className={`${INPUT_CLASS} sm:w-56`}>
              {VEHICLE_ORDER.filter((id) => id !== selectedVehicleId).map((id) => (
                <option key={id} value={id}>{allConfigs?.find((v) => v.id === id)?.label ?? id}</option>
              ))}
            </select>
            <button
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending}
              className="flex items-center gap-2 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] bg-[#F8F9FA] dark:bg-[#0F172A] px-4 py-3 rounded-xl whitespace-nowrap disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> Copy From
            </button>
            <button
              onClick={handleRestoreDefault}
              disabled={restoreMutation.isPending}
              className="flex items-center gap-2 text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] bg-[#F8F9FA] dark:bg-[#0F172A] px-4 py-3 rounded-xl whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" /> Restore Defaults
            </button>
          </div>

          {toast && <p className="text-sm text-[#138808] font-medium">{toast}</p>}

          <div className="flex items-center gap-3">
            <button onClick={handleReset} disabled={!hasUnsavedChanges} className="flex items-center gap-2 text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] bg-[#F8F9FA] dark:bg-[#0F172A] px-4 py-3 rounded-xl disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Reset Changes
            </button>
            <button onClick={handleSave} disabled={!hasUnsavedChanges || !!validationError || updateMutation.isPending} className="flex items-center gap-2 btn-green px-6 py-3 disabled:opacity-50">
              <Save className="w-4 h-4" /> {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
