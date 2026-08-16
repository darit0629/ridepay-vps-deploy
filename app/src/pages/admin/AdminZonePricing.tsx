import { useState } from "react";
import { MapPinned, Plus, Trash2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { ZoneMatchSide, ZoneRuleType } from "../../../api/zone-router";

const emptyForm = {
  name: "",
  keywords: "",
  matchSide: "either" as ZoneMatchSide,
  ruleType: "flat" as ZoneRuleType,
  value: 0,
};

export default function AdminZonePricing() {
  const utils = trpc.useUtils();
  const { data: zones } = trpc.zone.list.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true });
  const createMutation = trpc.zone.create.useMutation({ onSuccess: () => { utils.zone.list.invalidate(); setForm(emptyForm); setShowForm(false); } });
  const updateMutation = trpc.zone.update.useMutation({ onSuccess: () => utils.zone.list.invalidate() });
  const removeMutation = trpc.zone.remove.useMutation({ onSuccess: () => utils.zone.list.invalidate() });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const handleCreate = () => {
    const keywords = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (!form.name.trim() || keywords.length === 0) return;
    createMutation.mutate({ name: form.name.trim(), keywords, matchSide: form.matchSide, ruleType: form.ruleType, value: form.value });
  };

  return (
    <AdminLayout title="Zone Pricing">
      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPinned className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Pricing Zones</h3>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#FF8533] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> New Zone
            </button>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Zones match by keyword against the pickup/drop text (no map polygons in this prototype) — a trip can trigger more
            than one zone, each shown as its own line item on the fare breakdown.
          </p>

          {showForm && (
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Zone name (e.g. Airport Zone)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Keywords, comma separated (e.g. airport, terminal)"
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                className="bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] sm:col-span-2"
              />
              <select
                value={form.matchSide}
                onChange={(e) => setForm((f) => ({ ...f, matchSide: e.target.value as ZoneMatchSide }))}
                className="bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              >
                <option value="either">Match pickup or drop</option>
                <option value="pickup">Match pickup only</option>
                <option value="drop">Match drop only</option>
              </select>
              <select
                value={form.ruleType}
                onChange={(e) => setForm((f) => ({ ...f, ruleType: e.target.value as ZoneRuleType }))}
                className="bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              >
                <option value="flat">Flat charge (₹)</option>
                <option value="percent">% of fare (negative = discount)</option>
              </select>
              <input
                type="number"
                placeholder="Value"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                className="bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] sm:col-span-2"
              />
              <button
                onClick={handleCreate}
                className="sm:col-span-2 bg-[#138808] hover:bg-[#0f6b06] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                Create Zone
              </button>
            </div>
          )}

          <div className="space-y-2">
            {(zones ?? []).map((zone) => (
              <div key={zone.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <button
                  onClick={() => updateMutation.mutate({ id: zone.id, updates: { enabled: !zone.enabled } })}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${zone.enabled ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${zone.enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <div className="min-w-[140px]">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{zone.name}</p>
                  <p className="text-xs text-[#9CA3AF]">{zone.keywords.join(", ")} · {zone.matchSide}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                  zone.ruleType === "percent"
                    ? zone.value < 0 ? "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]" : "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]"
                    : "bg-[#E0F2FE] dark:bg-[#0C2536] text-[#0EA5E9]"
                }`}>
                  {zone.ruleType === "flat" ? `₹${zone.value} flat` : `${zone.value > 0 ? "+" : ""}${zone.value}%`}
                </span>
                <button
                  onClick={() => removeMutation.mutate({ id: zone.id })}
                  className="ml-auto w-8 h-8 rounded-lg bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                </button>
              </div>
            ))}
            {(zones ?? []).length === 0 && (
              <p className="text-sm text-[#9CA3AF] text-center py-6">No zones configured.</p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
