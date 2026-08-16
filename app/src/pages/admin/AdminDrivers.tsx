import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Check, UserX, Hourglass } from "lucide-react";
import { trpc } from "@/providers/trpc";
import AdminLayout from "@/components/admin/AdminLayout";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Approved", color: "#138808", bg: "#E8F5E8" },
  pending: { label: "Pending", color: "#FF6B00", bg: "#FFF5EB" },
  blocked: { label: "Blocked", color: "#DC2626", bg: "#FEE2E2" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
};

export default function AdminDrivers() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const tabs = ["All", "Approved", "Pending", "Blocked"];

  const utils = trpc.useUtils();
  const { data } = trpc.admin.listDrivers.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const approveMutation = trpc.admin.approveDriver.useMutation({ onSuccess: () => utils.admin.listDrivers.invalidate() });
  const blockMutation = trpc.admin.blockDriver.useMutation({ onSuccess: () => utils.admin.listDrivers.invalidate() });

  const driverProfiles = data ?? [];

  const filtered = driverProfiles
    .filter((d) => activeTab === "All" || d.status === activeTab.toLowerCase())
    .filter((d) => !search || (d.user?.name ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout title="Driver Management">
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="w-full bg-white dark:bg-[#1E293B] rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[#FF6B00] text-white"
                  : "bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Driver Table */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Driver</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Vehicle</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Rides</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((driver) => {
                  const config = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG.pending;
                  const name = driver.user?.name || "Unnamed";
                  return (
                    <tr
                      key={driver.id}
                      onClick={() => navigate(`/admin/drivers/${driver.id}`)}
                      className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#FFF5EB] flex items-center justify-center">
                            <span className="text-xs font-bold text-[#FF6B00]">{name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{name}</p>
                            <p className="text-xs text-[#9CA3AF]">{driver.user?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{driver.vehicleModel || driver.vehicleType}</p>
                        <p className="text-xs text-[#9CA3AF]">{driver.vehicleNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        {driver.status === "pending" && !driver.onboardingSubmittedAt ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium text-[#7C3AED] bg-[#F3E8FF] flex items-center gap-1 w-fit">
                            <Hourglass className="w-3 h-3" /> In Progress
                          </span>
                        ) : (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ color: config.color, backgroundColor: config.bg }}
                          >
                            {config.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{driver.totalRides}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Reject needs a reason, so it only lives on the detail
                              page's proper flow — this quick action is just the
                              zero-friction approve, and only once the driver has
                              actually submitted (not mid-wizard). */}
                          {driver.status === "pending" && driver.onboardingSubmittedAt && (
                            <button
                              onClick={() => approveMutation.mutate({ driverId: driver.id })}
                              disabled={approveMutation.isPending}
                              aria-label="Approve driver"
                              className="w-8 h-8 rounded-full bg-[#E8F5E8] flex items-center justify-center hover:bg-[#138808] group transition-colors disabled:opacity-50"
                            >
                              <Check className="w-4 h-4 text-[#138808] group-hover:text-white" />
                            </button>
                          )}
                          {driver.status === "approved" && (
                            <button
                              onClick={() => blockMutation.mutate({ driverId: driver.id })}
                              disabled={blockMutation.isPending}
                              aria-label="Block driver"
                              className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center hover:bg-[#DC2626] group transition-colors disabled:opacity-50"
                            >
                              <UserX className="w-4 h-4 text-[#DC2626] group-hover:text-white" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No drivers found.</td>
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
