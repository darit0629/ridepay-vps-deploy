import { useState, useMemo, type ReactNode } from "react";
import {
  Save, RotateCcw, Copy, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown,
  IndianRupee, Percent, Layers, ShieldCheck, PieChart, Sliders, AlertCircle,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { FareVehicleTypeId } from "@/contexts/FareConfigContext";
import { computeVehicleCommission, validateCommissionVehicleConfig, type CommissionSlab } from "@/lib/commissionVehiclePreview";

const VEHICLE_ORDER: FareVehicleTypeId[] = [
  "e-riksha-reserve", "e-riksha-share", "auto-rickshaw", "bike-taxi", "car",
  "e-riksha-women", "e-riksha-parcel", "courier", "e-riksha-school", "bike-parcel",
];

type CommissionMethod = "fixed" | "percentage" | "slab";

interface CommissionVehicleConfig {
  id: FareVehicleTypeId;
  label: string;
  enabled: boolean;
  method: CommissionMethod;
  fixedAmount: number;
  percentageValue: number;
  slabs: CommissionSlab[];
  minCommission: number;
  maxCommission: number | null;
  applyAfterTax: boolean;
  cashOverrideEnabled: boolean;
  cashMethod: "fixed" | "percentage";
  cashFixedAmount: number;
  cashPercentageValue: number;
  onlineOverrideEnabled: boolean;
  onlineMethod: "fixed" | "percentage";
  onlineFixedAmount: number;
  onlinePercentageValue: number;
}

const INPUT_CLASS =
  "w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]";

function Card({ icon: Icon, title, children, className }: { icon: typeof IndianRupee; title: string; children: ReactNode; className?: string }) {
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

const METHOD_LABELS: Record<CommissionMethod, string> = { fixed: "Fixed Amount", percentage: "Percentage", slab: "Slab Based" };
const METHOD_ICONS: Record<CommissionMethod, typeof IndianRupee> = { fixed: IndianRupee, percentage: Percent, slab: Layers };

export default function AdminCommissionSettings() {
  const utils = trpc.useUtils();
  const [selectedVehicleId, setSelectedVehicleId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  const { data: serverConfig } = trpc.commission.getVehicleCommissionConfig.useQuery({ id: selectedVehicleId });
  const { data: allConfigs } = trpc.commission.listVehicleCommissionConfigs.useQuery(undefined, { refetchInterval: 5000 });

  const [draft, setDraft] = useState<CommissionVehicleConfig | null>(null);
  const [draftForId, setDraftForId] = useState<FareVehicleTypeId | null>(null);
  const [toast, setToast] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  // Adjusted directly during render (React's own recommended pattern for
  // "reset state when a prop/key changes") — never re-syncs from a
  // background refetch of the same type, so an in-progress edit is never
  // silently overwritten.
  if (serverConfig && draftForId !== selectedVehicleId) {
    setDraft(serverConfig as CommissionVehicleConfig);
    setDraftForId(selectedVehicleId);
  }

  const updateMutation = trpc.commission.updateVehicleCommissionConfig.useMutation({
    onSuccess: () => {
      utils.commission.getVehicleCommissionConfig.invalidate({ id: selectedVehicleId });
      utils.commission.listVehicleCommissionConfigs.invalidate();
      setToast("Saved");
      setTimeout(() => setToast(""), 2500);
    },
    onError: (err) => setToast(err.message || "Couldn't save — check the values above."),
  });
  const duplicateMutation = trpc.commission.duplicateVehicleCommissionConfig.useMutation({
    onSuccess: (updated) => {
      setDraft(updated as CommissionVehicleConfig);
      utils.commission.listVehicleCommissionConfigs.invalidate();
      setToast(`Copied from ${allConfigs?.find((v) => v.id === duplicateFromId)?.label ?? "another vehicle"}`);
      setTimeout(() => setToast(""), 2500);
    },
  });
  const restoreMutation = trpc.commission.restoreDefaultVehicleCommissionConfig.useMutation({
    onSuccess: (updated) => {
      setDraft(updated as CommissionVehicleConfig);
      utils.commission.listVehicleCommissionConfigs.invalidate();
      setToast("Restored default settings");
      setTimeout(() => setToast(""), 2500);
    },
  });

  const patch = (updates: Partial<CommissionVehicleConfig>) => setDraft((prev) => (prev ? { ...prev, ...updates } : prev));

  const hasUnsavedChanges = !!draft && !!serverConfig && JSON.stringify(draft) !== JSON.stringify(serverConfig);
  const validationError = draft ? validateCommissionVehicleConfig(draft) : null;

  const handleSave = () => {
    if (!draft || validationError) return;
    updateMutation.mutate({ id: selectedVehicleId, updates: draft });
  };
  const handleReset = () => {
    if (serverConfig) setDraft(serverConfig as CommissionVehicleConfig);
  };
  const handleDuplicate = () => duplicateMutation.mutate({ fromId: duplicateFromId, toId: selectedVehicleId });
  const handleRestoreDefault = () => restoreMutation.mutate({ id: selectedVehicleId });

  // Section F — live preview, recomputed instantly against the in-progress
  // draft (client-side, no round-trip — see commissionVehiclePreview.ts).
  const [previewFare, setPreviewFare] = useState(200);
  const [previewMethod, setPreviewMethod] = useState<"cash" | "upi" | "wallet">("upi");

  const previewResult = useMemo(() => {
    if (!draft) return null;
    return computeVehicleCommission(draft, previewFare, previewMethod);
  }, [draft, previewFare, previewMethod]);

  const addSlab = () => {
    if (!draft) return;
    const lastSlab = [...draft.slabs].sort((a, b) => a.minFare - b.minFare).at(-1);
    const newSlab: CommissionSlab = {
      id: `slab-${Date.now()}`,
      minFare: lastSlab ? (lastSlab.maxFare ?? lastSlab.minFare + 100) : 0,
      maxFare: null,
      type: "percentage",
      value: 5,
    };
    // Cap the previous open-ended slab so the new one doesn't immediately overlap.
    const slabs = draft.slabs.map((s) => (s.id === lastSlab?.id && s.maxFare === null ? { ...s, maxFare: newSlab.minFare } : s));
    patch({ slabs: [...slabs, newSlab] });
  };
  const updateSlab = (id: string, updates: Partial<CommissionSlab>) => {
    if (!draft) return;
    patch({ slabs: draft.slabs.map((s) => (s.id === id ? { ...s, ...updates } : s)) });
  };
  const removeSlab = (id: string) => {
    if (!draft) return;
    patch({ slabs: draft.slabs.filter((s) => s.id !== id) });
  };
  const moveSlab = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const next = [...draft.slabs];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ slabs: next });
  };

  if (!draft) {
    return (
      <AdminLayout title="Commission Settings">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading commission configuration…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Commission Settings">
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
                  } ${meta && !meta.enabled ? "opacity-50" : ""}`}
                >
                  {meta?.label ?? id}
                  {meta && !meta.enabled && " (Off)"}
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
          {/* Section A — Commission Method */}
          <Card icon={Sliders} title="Commission Method" className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["fixed", "percentage", "slab"] as CommissionMethod[]).map((m) => {
                const Icon = METHOD_ICONS[m];
                const active = draft.method === m;
                return (
                  <button
                    key={m}
                    onClick={() => patch({ method: m })}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-colors ${
                      active ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "text-[#FF6B00]" : "text-[#9CA3AF]"}`} />
                    <span className={`text-sm font-medium ${active ? "text-[#FF6B00]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>{METHOD_LABELS[m]}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Section B — Fixed Commission */}
          {draft.method === "fixed" && (
            <Card icon={IndianRupee} title="Fixed Commission">
              <NumberField label="Platform Commission (₹)" value={draft.fixedAmount} onChange={(v) => patch({ fixedAmount: v })} />
              <p className="text-xs text-[#9CA3AF]">Every completed ride → Platform earns ₹{draft.fixedAmount}. Driver receives: Ride Fare − ₹{draft.fixedAmount}.</p>
            </Card>
          )}

          {/* Section C — Percentage Commission */}
          {draft.method === "percentage" && (
            <Card icon={Percent} title="Percentage Commission">
              <NumberField label="Platform Commission (%)" value={draft.percentageValue} onChange={(v) => patch({ percentageValue: v })} step="0.5" />
              <p className="text-xs text-[#9CA3AF]">Platform = {draft.percentageValue}%. Driver = Remaining {round1(100 - draft.percentageValue)}%.</p>
            </Card>
          )}

          {/* Section D — Slab-Based Commission */}
          {draft.method === "slab" && (
            <Card icon={Layers} title="Slab-Based Commission" className="lg:col-span-2">
              <div className="space-y-3">
                {[...draft.slabs].map((slab, i) => (
                  <div key={slab.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
                    <Field label="Minimum Fare (₹)">
                      <input type="number" value={slab.minFare} onChange={(e) => updateSlab(slab.id, { minFare: Number(e.target.value) })} className={INPUT_CLASS} />
                    </Field>
                    <Field label="Maximum Fare (₹)">
                      <input
                        type="number"
                        value={slab.maxFare ?? ""}
                        placeholder="No limit"
                        onChange={(e) => updateSlab(slab.id, { maxFare: e.target.value === "" ? null : Number(e.target.value) })}
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Commission Type">
                      <select value={slab.type} onChange={(e) => updateSlab(slab.id, { type: e.target.value as "fixed" | "percentage" })} className={INPUT_CLASS}>
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </Field>
                    <Field label={slab.type === "fixed" ? "Value (₹)" : "Value (%)"}>
                      <input type="number" step="0.5" value={slab.value} onChange={(e) => updateSlab(slab.id, { value: Number(e.target.value) })} className={INPUT_CLASS} />
                    </Field>
                    <div className="flex gap-1.5">
                      <button onClick={() => moveSlab(i, -1)} disabled={i === 0} className="w-9 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 flex items-center justify-center disabled:opacity-30" aria-label="Move slab up">
                        <ArrowUp className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                      </button>
                      <button onClick={() => moveSlab(i, 1)} disabled={i === draft.slabs.length - 1} className="w-9 h-10 rounded-xl bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 flex items-center justify-center disabled:opacity-30" aria-label="Move slab down">
                        <ArrowDown className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                      </button>
                    </div>
                    <button onClick={() => removeSlab(slab.id)} className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0" aria-label="Delete slab">
                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addSlab} className="flex items-center gap-2 text-sm font-medium text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] px-4 py-2.5 rounded-xl">
                <Plus className="w-4 h-4" /> Add New Slab
              </button>
            </Card>
          )}

          {/* Section E — Minimum & Maximum Commission */}
          <Card icon={ShieldCheck} title="Minimum & Maximum Commission">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField label="Minimum Commission (₹, 0 = no limit)" value={draft.minCommission} onChange={(v) => patch({ minCommission: v })} />
              <Field label="Maximum Commission (₹, blank = no limit)">
                <input
                  type="number"
                  value={draft.maxCommission ?? ""}
                  placeholder="No limit"
                  onChange={(e) => patch({ maxCommission: e.target.value === "" ? null : Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <p className="text-xs text-[#9CA3AF]">Prevents extremely small or excessively large commission values regardless of method.</p>
          </Card>

          {/* Section G — Advanced Rules */}
          <Card icon={Sliders} title="Advanced Rules (Optional)">
            <ToggleRow
              label={`${draft.label} commission is enabled`}
              description={draft.enabled ? "Commission is currently applied for this vehicle type." : "No commission will be deducted for this vehicle type."}
              enabled={draft.enabled}
              onToggle={() => patch({ enabled: !draft.enabled })}
              color="#138808"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => patch({ applyAfterTax: false })}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${!draft.applyAfterTax ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"}`}
              >
                Apply Before Taxes
              </button>
              <button
                onClick={() => patch({ applyAfterTax: true })}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${draft.applyAfterTax ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"}`}
              >
                Apply After Taxes
              </button>
            </div>

            <ToggleRow label="Different commission for cash rides" enabled={draft.cashOverrideEnabled} onToggle={() => patch({ cashOverrideEnabled: !draft.cashOverrideEnabled })} color="#0EA5E9" />
            {draft.cashOverrideEnabled && (
              <div className="grid grid-cols-2 gap-3 pl-2">
                <Field label="Method">
                  <select value={draft.cashMethod} onChange={(e) => patch({ cashMethod: e.target.value as "fixed" | "percentage" })} className={INPUT_CLASS}>
                    <option value="fixed">Fixed (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </Field>
                <NumberField
                  label={draft.cashMethod === "fixed" ? "Value (₹)" : "Value (%)"}
                  value={draft.cashMethod === "fixed" ? draft.cashFixedAmount : draft.cashPercentageValue}
                  onChange={(v) => patch(draft.cashMethod === "fixed" ? { cashFixedAmount: v } : { cashPercentageValue: v })}
                  step="0.5"
                />
              </div>
            )}

            <ToggleRow label="Different commission for online payments" enabled={draft.onlineOverrideEnabled} onToggle={() => patch({ onlineOverrideEnabled: !draft.onlineOverrideEnabled })} color="#0EA5E9" />
            {draft.onlineOverrideEnabled && (
              <div className="grid grid-cols-2 gap-3 pl-2">
                <Field label="Method">
                  <select value={draft.onlineMethod} onChange={(e) => patch({ onlineMethod: e.target.value as "fixed" | "percentage" })} className={INPUT_CLASS}>
                    <option value="fixed">Fixed (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </Field>
                <NumberField
                  label={draft.onlineMethod === "fixed" ? "Value (₹)" : "Value (%)"}
                  value={draft.onlineMethod === "fixed" ? draft.onlineFixedAmount : draft.onlinePercentageValue}
                  onChange={(v) => patch(draft.onlineMethod === "fixed" ? { onlineFixedAmount: v } : { onlinePercentageValue: v })}
                  step="0.5"
                />
              </div>
            )}
          </Card>

          {/* Section F — Commission Preview */}
          <Card icon={PieChart} title="Commission Preview" className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Ride Fare (₹)">
                <input type="number" value={previewFare} onChange={(e) => setPreviewFare(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Payment Method">
                <select value={previewMethod} onChange={(e) => setPreviewMethod(e.target.value as "cash" | "upi" | "wallet")} className={INPUT_CLASS}>
                  <option value="upi">UPI (online)</option>
                  <option value="wallet">Wallet (online)</option>
                  <option value="cash">Cash</option>
                </select>
              </Field>
            </div>

            {previewResult && (
              <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Ride Fare</span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewFare}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">
                    Platform Commission
                    {previewResult.appliedSlab && ` (slab ₹${previewResult.appliedSlab.minFare}–${previewResult.appliedSlab.maxFare ?? "∞"})`}
                    {(previewResult.clampedByMin || previewResult.clampedByMax) && " · limit applied"}
                  </span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewResult.platformCommission}</span>
                </div>
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                  <span className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Driver Earnings</span>
                  <span className="font-bold text-xl text-[#138808]">₹{previewResult.driverEarnings}</span>
                </div>
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
