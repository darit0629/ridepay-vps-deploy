import { useState } from "react";
import { Save, Plus, Bike, Car, Zap } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

type VehicleType = "e-riksha" | "auto-rickshaw" | "car" | "bike";

const vehicleIcons: Record<VehicleType, typeof Car> = {
  "e-riksha": Zap,
  "auto-rickshaw": Car,
  car: Car,
  bike: Bike,
};
const vehicleLabels: Record<VehicleType, string> = {
  "e-riksha": "E-Rickshaw",
  "auto-rickshaw": "Auto Rickshaw",
  car: "Car",
  bike: "Bike",
};
const vehicleTypes: VehicleType[] = ["bike", "e-riksha", "auto-rickshaw", "car"];

export default function AdminRentalPricing() {
  const utils = trpc.useUtils();
  const { data: packages } = trpc.rental.adminListPackages.useQuery();
  const updateMutation = trpc.rental.adminUpdatePackage.useMutation({ onSuccess: () => utils.rental.adminListPackages.invalidate() });
  const createMutation = trpc.rental.adminCreatePackage.useMutation({
    onSuccess: () => {
      utils.rental.adminListPackages.invalidate();
      setShowAdd(false);
    },
  });

  const [draft, setDraft] = useState<Record<number, { basePrice: string; includedKm: string; extraHourRate: string }>>({});
  const [savedId, setSavedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPkg, setNewPkg] = useState({ vehicleType: "bike" as VehicleType, hours: "1", basePrice: "", includedKm: "", extraHourRate: "" });

  const getDraft = (pkg: NonNullable<typeof packages>[number]) =>
    draft[pkg.id] ?? { basePrice: pkg.basePrice, includedKm: String(pkg.includedKm), extraHourRate: pkg.extraHourRate };

  const setField = (id: number, field: "basePrice" | "includedKm" | "extraHourRate", value: string, pkg: NonNullable<typeof packages>[number]) => {
    setDraft((prev) => ({ ...prev, [id]: { ...getDraft(pkg), ...prev[id], [field]: value } }));
  };

  const handleSave = (pkg: NonNullable<typeof packages>[number]) => {
    const d = getDraft(pkg);
    updateMutation.mutate(
      { id: pkg.id, basePrice: Number(d.basePrice), includedKm: Number(d.includedKm), extraHourRate: Number(d.extraHourRate) },
      { onSuccess: () => { setSavedId(pkg.id); setTimeout(() => setSavedId((v) => (v === pkg.id ? null : v)), 1500); } }
    );
  };

  const handleCreate = () => {
    if (!newPkg.basePrice || !newPkg.includedKm || !newPkg.extraHourRate) return;
    createMutation.mutate({
      vehicleType: newPkg.vehicleType,
      hours: Number(newPkg.hours),
      basePrice: Number(newPkg.basePrice),
      includedKm: Number(newPkg.includedKm),
      extraHourRate: Number(newPkg.extraHourRate),
    });
  };

  const byVehicle = vehicleTypes.map((vt) => ({ vehicleType: vt, rows: (packages ?? []).filter((p) => p.vehicleType === vt) }));

  return (
    <AdminLayout
      title="Rental Pricing"
      subtitle="Hourly Rental & Full Day Rental package pricing per vehicle type"
      headerActions={
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3.5 py-2 rounded-xl">
          <Plus className="w-4 h-4" /> Add Package
        </button>
      }
    >
      <div className="max-w-[1200px] space-y-6">
        {byVehicle.map(({ vehicleType, rows }) => {
          const Icon = vehicleIcons[vehicleType];
          if (rows.length === 0) return null;
          return (
            <div key={vehicleType}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#FF6B00]" />
                </div>
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{vehicleLabels[vehicleType]}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rows.map((pkg) => {
                  const d = getDraft(pkg);
                  return (
                    <div key={pkg.id} className={`bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 ${!pkg.active ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{pkg.hours}h package</p>
                        <button
                          onClick={() => updateMutation.mutate({ id: pkg.id, active: !pkg.active })}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${pkg.active ? "bg-[#138808]" : "bg-gray-300"}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pkg.active ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div>
                          <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-0.5 block">Base Price (₹)</label>
                          <input
                            type="number"
                            value={d.basePrice}
                            onChange={(e) => setField(pkg.id, "basePrice", e.target.value, pkg)}
                            className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-0.5 block">Included Km</label>
                            <input
                              type="number"
                              value={d.includedKm}
                              onChange={(e) => setField(pkg.id, "includedKm", e.target.value, pkg)}
                              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-0.5 block">Extra Hr (₹)</label>
                            <input
                              type="number"
                              value={d.extraHourRate}
                              onChange={(e) => setField(pkg.id, "extraHourRate", e.target.value, pkg)}
                              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSave(pkg)}
                        className="w-full flex items-center justify-center gap-1.5 bg-[#1A1A2E] dark:bg-[#334155] text-white text-xs font-medium py-2 rounded-lg hover:opacity-90"
                      >
                        <Save className="w-3.5 h-3.5" /> {savedId === pkg.id ? "Saved" : "Save"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Add Rental Package</h2>
            <div className="space-y-3">
              <select
                value={newPkg.vehicleType}
                onChange={(e) => setNewPkg({ ...newPkg, vehicleType: e.target.value as VehicleType })}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              >
                {vehicleTypes.map((vt) => <option key={vt} value={vt}>{vehicleLabels[vt]}</option>)}
              </select>
              <input type="number" placeholder="Hours" value={newPkg.hours} onChange={(e) => setNewPkg({ ...newPkg, hours: e.target.value })} className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <input type="number" placeholder="Base Price (₹)" value={newPkg.basePrice} onChange={(e) => setNewPkg({ ...newPkg, basePrice: e.target.value })} className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <input type="number" placeholder="Included Km" value={newPkg.includedKm} onChange={(e) => setNewPkg({ ...newPkg, includedKm: e.target.value })} className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <input type="number" placeholder="Extra Hour Rate (₹)" value={newPkg.extraHourRate} onChange={(e) => setNewPkg({ ...newPkg, extraHourRate: e.target.value })} className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            </div>
            {createMutation.isError && <p className="text-xs text-[#DC2626] mt-2">{createMutation.error.message}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-medium py-2.5 rounded-xl">Cancel</button>
              <button onClick={handleCreate} disabled={createMutation.isPending} className="flex-1 bg-[#FF6B00] text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50">
                {createMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
