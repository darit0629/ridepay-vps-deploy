import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "#138808", bg: "#E8F5E8" },
  pending: { label: "Pending", color: "#FF6B00", bg: "#FFF5EB" },
  failed: { label: "Failed", color: "#DC2626", bg: "#FEE2E2" },
  refunded: { label: "Refunded", color: "#7C3AED", bg: "#F3E8FF" },
};

const METHOD_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", wallet: "Wallet" };

const STATUS_TABS = ["All", "Completed", "Pending", "Failed", "Refunded"];
const METHOD_TABS = ["All", "Cash", "UPI", "Wallet"];

export default function AdminTransactions() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState("All");
  const [methodTab, setMethodTab] = useState("All");

  const { data } = trpc.admin.listPayments.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const payments = data ?? [];

  const filtered = payments.filter((p) => {
    if (statusTab !== "All" && p.status !== statusTab.toLowerCase()) return false;
    if (methodTab !== "All" && p.method !== methodTab.toLowerCase()) return false;
    return true;
  });

  const totalShown = filtered.reduce((sum, p) => sum + p.amount, 0);

  return (
    <AdminLayout title="Transactions" subtitle="Every real ride payment, how it was made, and how it settled">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                statusTab === tab ? "bg-[#FF6B00] text-white" : "bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
          <span className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          {METHOD_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setMethodTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                methodTab === tab ? "bg-[#1E3A5F] text-white" : "bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center justify-between">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{filtered.length} transaction{filtered.length === 1 ? "" : "s"}</p>
          <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Total: ₹{totalShown.toLocaleString("en-IN")}</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Ride</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Rider → Driver</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Route</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Method</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Commission / Earnings</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const config = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/admin/rides/${p.rideId}`)}
                      className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] whitespace-nowrap">#{p.rideId}</td>
                      <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] whitespace-nowrap">
                        {p.riderName} <span className="text-[#9CA3AF]">→</span> {p.driverName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {p.pickupAddress && p.dropAddress ? (
                          <div className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            <MapPin className="w-3 h-3 text-[#138808] flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{p.pickupAddress}</span>
                            <span className="text-[#9CA3AF]">→</span>
                            <MapPin className="w-3 h-3 text-[#FF6B00] flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{p.dropAddress}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] whitespace-nowrap">₹{p.amount.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                        ₹{p.commission.toLocaleString("en-IN")} / ₹{p.driverEarnings.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ color: config.color, backgroundColor: config.bg }}>
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
