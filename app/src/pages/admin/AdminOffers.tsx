import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { Plus, Pencil, CheckCircle2, XCircle } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useOffers, type Coupon } from "@/contexts/OffersContext";
import type { DiscountType } from "../../../api/coupon-router";

const VEHICLE_OPTIONS = ["e-riksha", "auto-rickshaw", "car", "bike"];

const emptyForm: Omit<Coupon, "usedCount"> = {
  code: "",
  description: "",
  discountType: "flat",
  discountValue: 0,
  maxDiscount: 0,
  minBookingAmount: 0,
  usageLimit: 0,
  vehicleRestrictions: [],
  areaRestrictions: [],
  firstRideOnly: false,
  repeatUserOnly: false,
  isReferralCoupon: false,
  isFestivalCoupon: false,
  validFrom: new Date().toISOString().slice(0, 10),
  validTill: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  status: "Active",
};

export default function AdminOffers() {
  const { coupons, createCoupon, updateCoupon, toggleCouponStatus } = useOffers();
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Coupon, "usedCount">>(emptyForm);
  const [areaInput, setAreaInput] = useState("");

  const openCreate = () => {
    setEditingCode(null);
    setFormData(emptyForm);
    setAreaInput("");
    setShowForm(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCode(coupon.code);
    const { usedCount: _usedCount, ...rest } = coupon;
    setFormData(rest);
    setAreaInput(coupon.areaRestrictions.join(", "));
    setShowForm(true);
  };

  // ?code= lets global search (AdminGlobalSearch) deep-link straight into
  // editing a specific coupon — this page has no separate detail route.
  const [searchParams] = useSearchParams();
  const deepLinkedCode = searchParams.get("code");
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (deepLinkAppliedRef.current || !deepLinkedCode || coupons.length === 0) return;
    const match = coupons.find((c) => c.code === deepLinkedCode);
    if (match) {
      deepLinkAppliedRef.current = true;
      openEdit(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedCode, coupons]);

  const toggleVehicle = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      vehicleRestrictions: prev.vehicleRestrictions.includes(id)
        ? prev.vehicleRestrictions.filter((v) => v !== id)
        : [...prev.vehicleRestrictions, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return;
    const areaRestrictions = areaInput.split(",").map((a) => a.trim()).filter(Boolean);
    const payload = { ...formData, areaRestrictions };

    if (editingCode) {
      updateCoupon(editingCode, payload);
    } else {
      createCoupon(payload);
    }
    setShowForm(false);
    setEditingCode(null);
    setFormData(emptyForm);
    setAreaInput("");
  };

  return (
    <AdminLayout
      title="Offers & Coupons"
      headerActions={
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#138808] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1AA814] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
      }
    >
      <div className="space-y-4">
        <div className="bg-[#E0F2FE] dark:bg-[#0C2536] rounded-xl p-3 text-xs text-[#0369A1] dark:text-[#7DD3FC]">
          Active coupons are automatically applied and visible to every eligible rider in the app — no extra rollout step needed.
        </div>

        {showForm && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">{editingCode ? `Edit ${editingCode}` : "Create New Coupon"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled={!!editingCode}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-60"
                    placeholder="FLY50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="Get 50 off"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    <option value="flat">Flat</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Value</label>
                  <input
                    type="number"
                    value={formData.discountValue || ""}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Max Discount</label>
                  <input
                    type="number"
                    value={formData.maxDiscount || ""}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    disabled={formData.discountType === "flat"}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-50"
                    placeholder="0 = uncapped"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Min Booking</label>
                  <input
                    type="number"
                    value={formData.minBookingAmount || ""}
                    onChange={(e) => setFormData({ ...formData, minBookingAmount: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit || ""}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="0 = unlimited"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Valid Till</label>
                  <input
                    type="date"
                    value={formData.validTill}
                    onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Vehicle Restrictions (empty = all vehicles)</label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVehicle(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        formData.vehicleRestrictions.includes(v) ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Area Restrictions — comma separated (empty = all areas)</label>
                <input
                  type="text"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="Ranaghat, Kalyani"
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  ["firstRideOnly", "First Ride Only"],
                  ["repeatUserOnly", "Repeat User"],
                  ["isReferralCoupon", "Referral Coupon"],
                  ["isFestivalCoupon", "Festival Coupon"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      formData[key] ? "bg-[#7C3AED] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="submit" className="btn-saffron px-6 py-2">{editingCode ? "Save Changes" : "Create Coupon"}</button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingCode(null); }}
                  className="px-6 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Coupon Code</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Discount</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Usage</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Valid Till</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#FF6B00]">{c.code}</p>
                      <p className="text-xs text-[#9CA3AF]">{c.description}</p>
                      <div className="flex gap-1 mt-1">
                        {c.isReferralCoupon && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1]">Referral</span>}
                        {c.isFestivalCoupon && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED]">Festival</span>}
                        {c.firstRideOnly && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]">First Ride</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {c.discountType === "percentage" ? `${c.discountValue}%` : `₹${c.discountValue}`}
                      <span className="text-xs text-[#9CA3AF] ml-1">(min ₹{c.minBookingAmount})</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {c.usedCount}{c.usageLimit > 0 ? ` / ${c.usageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{c.validTill}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.status === "Active" ? "bg-[#E8F5E8] text-[#138808]" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="w-8 h-8 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center hover:opacity-80 transition-opacity"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#0EA5E9]" />
                        </button>
                        <button
                          onClick={() => toggleCouponStatus(c.code)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity ${
                            c.status === "Active" ? "bg-red-50 dark:bg-[#3D1414]" : "bg-[#E8F5E8] dark:bg-[#1A2D1A]"
                          }`}
                          aria-label={c.status === "Active" ? "Deactivate" : "Activate"}
                        >
                          {c.status === "Active" ? (
                            <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#138808]" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
