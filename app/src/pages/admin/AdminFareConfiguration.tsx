import { useState, useMemo, type ReactNode } from "react";
import {
  Save, RotateCcw, Copy, Plus, Trash2, Moon, Sun as SunIcon, CloudRain, Ticket, Route,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { FareVehicleTypeId, FareVehicleConfig, FareTax } from "@/contexts/FareConfigContext";
import { computeVehicleFareBreakdown } from "@/lib/fareVehiclePreview";

const VEHICLE_ORDER: FareVehicleTypeId[] = [
  "e-riksha-reserve", "e-riksha-share", "auto-rickshaw", "bike-taxi", "car",
  "e-riksha-women", "e-riksha-parcel", "courier", "e-riksha-school", "bike-parcel",
];

const INPUT_CLASS =
  "w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]";

function Card({ icon: Icon, title, children, className }: { icon: typeof Moon; title: string; children: ReactNode; className?: string }) {
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

function FeeTypeValueFields({
  type, value, onTypeChange, onValueChange,
}: { type: "percent" | "fixed"; value: number; onTypeChange: (t: "percent" | "fixed") => void; onValueChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Increase By">
        <select value={type} onChange={(e) => onTypeChange(e.target.value as "percent" | "fixed")} className={INPUT_CLASS}>
          <option value="percent">Percentage (%)</option>
          <option value="fixed">Fixed Amount (₹)</option>
        </select>
      </Field>
      <NumberField label={type === "percent" ? "Value (%)" : "Value (₹)"} value={value} onChange={onValueChange} step="0.1" />
    </div>
  );
}

export default function AdminFareConfiguration() {
  const utils = trpc.useUtils();
  const [selectedVehicleId, setSelectedVehicleId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  const { data: serverConfig } = trpc.fare.getVehicleFareConfig.useQuery({ id: selectedVehicleId });
  const { data: allConfigs } = trpc.fare.listVehicleFareConfigs.useQuery(undefined, { refetchInterval: 5000 });

  const [draft, setDraft] = useState<FareVehicleConfig | null>(null);
  const [draftForId, setDraftForId] = useState<FareVehicleTypeId | null>(null);
  const [toast, setToast] = useState("");
  const [duplicateFromId, setDuplicateFromId] = useState<FareVehicleTypeId>("e-riksha-reserve");

  // Seed the edit draft exactly once per vehicle-type switch — adjusted
  // directly during render (React's own recommended pattern for "reset
  // state when a prop/key changes") rather than in an effect, so it never
  // re-syncs from a background refetch of the same type and silently
  // overwrites an in-progress edit.
  if (serverConfig && draftForId !== selectedVehicleId) {
    setDraft(serverConfig);
    setDraftForId(selectedVehicleId);
  }

  const updateMutation = trpc.fare.updateVehicleFareConfig.useMutation({
    onSuccess: () => {
      utils.fare.getVehicleFareConfig.invalidate({ id: selectedVehicleId });
      utils.fare.listVehicleFareConfigs.invalidate();
      setToast("Saved");
      setTimeout(() => setToast(""), 2500);
    },
  });
  const duplicateMutation = trpc.fare.duplicateVehicleFareConfig.useMutation({
    onSuccess: (updated) => {
      setDraft(updated);
      utils.fare.listVehicleFareConfigs.invalidate();
      setToast(`Copied from ${allConfigs?.find((v) => v.id === duplicateFromId)?.label ?? "another vehicle"}`);
      setTimeout(() => setToast(""), 2500);
    },
  });

  const patch = (updates: Partial<FareVehicleConfig>) => setDraft((prev) => (prev ? { ...prev, ...updates } : prev));

  const hasUnsavedChanges = !!draft && !!serverConfig && JSON.stringify(draft) !== JSON.stringify(serverConfig);

  const handleSave = () => {
    if (!draft) return;
    // updateVehicleFareConfig's input schema only recognizes section A–G
    // fields — draft's extra id/label are silently stripped by zod, so
    // passing it straight through avoids an unused-destructure lint trip.
    updateMutation.mutate({ id: selectedVehicleId, updates: draft });
  };

  const handleReset = () => {
    if (serverConfig) setDraft(serverConfig);
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate({ fromId: duplicateFromId, toId: selectedVehicleId });
  };

  // Section H — live fare preview, recomputed instantly against the
  // in-progress draft (client-side, no round-trip — see fareVehiclePreview.ts).
  const [previewDistanceKm, setPreviewDistanceKm] = useState(5);
  const [previewWaitingMin, setPreviewWaitingMin] = useState(0);
  const [previewTime, setPreviewTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [previewRaining, setPreviewRaining] = useState(false);
  const [previewToll, setPreviewToll] = useState(0);

  const previewBreakdown = useMemo(() => {
    if (!draft) return null;
    const [h, m] = previewTime.split(":").map(Number);
    const at = new Date();
    at.setHours(h || 0, m || 0, 0, 0);
    return computeVehicleFareBreakdown(draft, {
      distanceKm: previewDistanceKm,
      waitingMin: previewWaitingMin,
      atTimestamp: at.getTime(),
      isRaining: previewRaining,
      tollAmount: previewToll,
    });
  }, [draft, previewDistanceKm, previewWaitingMin, previewTime, previewRaining, previewToll]);

  const addTax = () => {
    if (!draft) return;
    const newTax: FareTax = { id: `tax-${Date.now()}`, name: "", type: "percent", value: 0, enabled: true };
    patch({ taxes: [...draft.taxes, newTax] });
  };
  const updateTax = (id: string, updates: Partial<FareTax>) => {
    if (!draft) return;
    patch({ taxes: draft.taxes.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  };
  const removeTax = (id: string) => {
    if (!draft) return;
    patch({ taxes: draft.taxes.filter((t) => t.id !== id) });
  };

  if (!draft) {
    return (
      <AdminLayout title="Fare Configuration">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading fare configuration…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Fare Configuration">
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
                    isSelected
                      ? "bg-[#FF6B00] text-white"
                      : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                  } ${meta && !meta.enabled ? "opacity-50" : ""}`}
                >
                  {meta?.label ?? id}
                  {meta && !meta.enabled && " (Off)"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicle enabled toggle — controls whether riders can book this
            vehicle type at all, independent of its fare rules. */}
        <ToggleRow
          label={`${draft.label} is bookable`}
          description={draft.enabled ? "Riders can currently book this vehicle type." : "Hidden from riders until re-enabled."}
          enabled={draft.enabled}
          onToggle={() => patch({ enabled: !draft.enabled })}
          color="#138808"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Section A — Base Fare */}
          <Card icon={Route} title="Base Fare">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField label="Base Fare (₹)" value={draft.baseFare} onChange={(v) => patch({ baseFare: v })} />
              <NumberField label="Included Distance (KM)" value={draft.includedDistanceKm} onChange={(v) => patch({ includedDistanceKm: v })} step="0.1" />
            </div>
          </Card>

          {/* Section B — Distance Pricing */}
          <Card icon={Route} title="Distance Pricing">
            <NumberField label="Per KM Charge (₹)" value={draft.perKmCharge} onChange={(v) => patch({ perKmCharge: v })} step="0.1" />
            <p className="text-xs text-[#9CA3AF]">
              Extra Fare = (Ride Distance − {draft.includedDistanceKm} KM) × ₹{draft.perKmCharge}/KM
            </p>
          </Card>

          {/* Section C — Waiting Charges */}
          <Card icon={Route} title="Waiting Charges">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField label="Free Waiting Time (Minutes)" value={draft.freeWaitingMin} onChange={(v) => patch({ freeWaitingMin: Math.round(v) })} />
              <NumberField label="Waiting Charge / Minute (₹)" value={draft.waitingChargePerMin} onChange={(v) => patch({ waitingChargePerMin: v })} step="0.5" />
            </div>
          </Card>

          {/* Section G — Toll Charges (placed here, compact) */}
          <Card icon={Ticket} title="Toll Charges">
            <ToggleRow label="Enable Toll Charges" enabled={draft.tollEnabled} onToggle={() => patch({ tollEnabled: !draft.tollEnabled })} />
            <Field label="How tolls are added">
              <select
                value={draft.tollMode}
                onChange={(e) => patch({ tollMode: e.target.value as "manual" | "auto" })}
                disabled={!draft.tollEnabled}
                className={`${INPUT_CLASS} disabled:opacity-50`}
              >
                <option value="manual">Driver enters toll manually</option>
                <option value="auto">System adds toll automatically (coming soon)</option>
              </select>
            </Field>
          </Card>

          {/* Section D — Time-Based Pricing: Night Charge */}
          <Card icon={Moon} title="Night Charge">
            <ToggleRow label="Enable Night Charge" enabled={draft.nightChargeEnabled} onToggle={() => patch({ nightChargeEnabled: !draft.nightChargeEnabled })} />
            <div className={`space-y-4 transition-opacity ${draft.nightChargeEnabled ? "" : "opacity-40 pointer-events-none"}`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time">
                  <input type="time" value={draft.nightChargeStart} onChange={(e) => patch({ nightChargeStart: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="End Time">
                  <input type="time" value={draft.nightChargeEnd} onChange={(e) => patch({ nightChargeEnd: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
              <FeeTypeValueFields
                type={draft.nightChargeType}
                value={draft.nightChargeValue}
                onTypeChange={(t) => patch({ nightChargeType: t })}
                onValueChange={(v) => patch({ nightChargeValue: v })}
              />
            </div>
          </Card>

          {/* Section D — Time-Based Pricing: Peak Hour Charge */}
          <Card icon={SunIcon} title="Peak Hour Charge">
            <ToggleRow label="Enable Peak Hour Charge" enabled={draft.peakChargeEnabled} onToggle={() => patch({ peakChargeEnabled: !draft.peakChargeEnabled })} />
            <div className={`space-y-4 transition-opacity ${draft.peakChargeEnabled ? "" : "opacity-40 pointer-events-none"}`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time">
                  <input type="time" value={draft.peakChargeStart} onChange={(e) => patch({ peakChargeStart: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="End Time">
                  <input type="time" value={draft.peakChargeEnd} onChange={(e) => patch({ peakChargeEnd: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
              <FeeTypeValueFields
                type={draft.peakChargeType}
                value={draft.peakChargeValue}
                onTypeChange={(t) => patch({ peakChargeType: t })}
                onValueChange={(v) => patch({ peakChargeValue: v })}
              />
            </div>
          </Card>

          {/* Section E — Weather Pricing (Rain — future-ready for more conditions) */}
          <Card icon={CloudRain} title="Weather Pricing — Rain">
            <ToggleRow label="Enable Rain Pricing" enabled={draft.rainChargeEnabled} onToggle={() => patch({ rainChargeEnabled: !draft.rainChargeEnabled })} color="#0EA5E9" />
            <div className={`transition-opacity ${draft.rainChargeEnabled ? "" : "opacity-40 pointer-events-none"}`}>
              <FeeTypeValueFields
                type={draft.rainChargeType}
                value={draft.rainChargeValue}
                onTypeChange={(t) => patch({ rainChargeType: t })}
                onValueChange={(v) => patch({ rainChargeValue: v })}
              />
            </div>
            <p className="text-xs text-[#9CA3AF]">More weather conditions (heavy rain, storm, heatwave) can be added later without redesigning this page.</p>
          </Card>

          {/* Section F — Taxes */}
          <Card icon={Ticket} title="Taxes" className="lg:col-span-2">
            <div className="space-y-3">
              {draft.taxes.length === 0 && <p className="text-sm text-[#9CA3AF]">No taxes configured yet.</p>}
              {draft.taxes.map((tax) => (
                <div key={tax.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
                  <Field label="Tax Name">
                    <input
                      type="text"
                      value={tax.name}
                      onChange={(e) => updateTax(tax.id, { name: e.target.value })}
                      placeholder="e.g. GST, CGST, Municipal Tax"
                      className={INPUT_CLASS}
                    />
                  </Field>
                  <Field label="Tax Type">
                    <select value={tax.type} onChange={(e) => updateTax(tax.id, { type: e.target.value as "percent" | "fixed" })} className={`${INPUT_CLASS} sm:w-40`}>
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>
                  </Field>
                  <Field label={tax.type === "percent" ? "Value (%)" : "Value (₹)"}>
                    <input
                      type="number"
                      step="0.1"
                      value={tax.value}
                      onChange={(e) => updateTax(tax.id, { value: Number(e.target.value) })}
                      className={`${INPUT_CLASS} sm:w-28`}
                    />
                  </Field>
                  <button
                    onClick={() => updateTax(tax.id, { enabled: !tax.enabled })}
                    className="w-12 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: tax.enabled ? "#138808" : "#D1D5DB" }}
                    aria-label={tax.enabled ? "Disable tax" : "Enable tax"}
                  >
                    <div className={`w-8 h-4 rounded-full bg-white/40 relative`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0 transition-transform ${tax.enabled ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => removeTax(tax.id)}
                    className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0"
                    aria-label="Remove tax"
                  >
                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addTax}
              className="flex items-center gap-2 text-sm font-medium text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] px-4 py-2.5 rounded-xl"
            >
              <Plus className="w-4 h-4" /> Add Tax
            </button>
          </Card>

          {/* Section H — Fare Preview */}
          <Card icon={Route} title="Fare Preview" className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Field label="Ride Distance (KM)">
                <input type="number" step="0.1" value={previewDistanceKm} onChange={(e) => setPreviewDistanceKm(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Waiting Time (min)">
                <input type="number" value={previewWaitingMin} onChange={(e) => setPreviewWaitingMin(Number(e.target.value))} className={INPUT_CLASS} />
              </Field>
              <Field label="Current Time">
                <input type="time" value={previewTime} onChange={(e) => setPreviewTime(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field label="Weather Status">
                <select value={previewRaining ? "rain" : "clear"} onChange={(e) => setPreviewRaining(e.target.value === "rain")} className={INPUT_CLASS}>
                  <option value="clear">Clear</option>
                  <option value="rain">Rain</option>
                </select>
              </Field>
              <Field label="Toll Amount (₹)">
                <input
                  type="number"
                  value={previewToll}
                  onChange={(e) => setPreviewToll(Number(e.target.value))}
                  disabled={!draft.tollEnabled}
                  className={`${INPUT_CLASS} disabled:opacity-50`}
                />
              </Field>
            </div>

            {previewBreakdown && (
              <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Base Fare</span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewBreakdown.baseFare}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Distance Charge</span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewBreakdown.distanceCharge}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Waiting Charge</span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewBreakdown.waitingCharge}</span>
                </div>
                {previewBreakdown.timeCharges.map((tc) => (
                  <div key={tc.label} className="flex justify-between text-sm">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">{tc.label}</span>
                    <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{tc.amount}</span>
                  </div>
                ))}
                {previewBreakdown.weatherCharge && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">{previewBreakdown.weatherCharge.label}</span>
                    <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewBreakdown.weatherCharge.amount}</span>
                  </div>
                )}
                {previewBreakdown.taxes.map((t) => (
                  <div key={t.label} className="flex justify-between text-sm">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF]">{t.label}</span>
                    <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{t.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">Toll Charge</span>
                  <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">₹{previewBreakdown.tollCharge}</span>
                </div>
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                  <span className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Final Ride Fare</span>
                  <span className="font-bold text-xl text-[#FF6B00]">₹{previewBreakdown.total}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <select
              value={duplicateFromId}
              onChange={(e) => setDuplicateFromId(e.target.value as FareVehicleTypeId)}
              className={`${INPUT_CLASS} sm:w-64`}
            >
              {VEHICLE_ORDER.filter((id) => id !== selectedVehicleId).map((id) => (
                <option key={id} value={id}>
                  {allConfigs?.find((v) => v.id === id)?.label ?? id}
                </option>
              ))}
            </select>
            <button
              onClick={handleDuplicate}
              disabled={duplicateMutation.isPending}
              className="flex items-center gap-2 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] bg-[#F8F9FA] dark:bg-[#0F172A] px-4 py-3 rounded-xl whitespace-nowrap disabled:opacity-50"
            >
              <Copy className="w-4 h-4" /> Duplicate From
            </button>
          </div>

          {toast && <p className="text-sm text-[#138808] font-medium">{toast}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] bg-[#F8F9FA] dark:bg-[#0F172A] px-4 py-3 rounded-xl disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset Changes
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || updateMutation.isPending}
              className="flex items-center gap-2 btn-green px-6 py-3 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
