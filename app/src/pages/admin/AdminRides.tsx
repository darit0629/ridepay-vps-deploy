import { useState } from "react";
import { useNavigate } from "react-router";
import { MapPin } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: "Searching", color: "#FF6B00", bg: "#FFF5EB" },
  accepted: { label: "Accepted", color: "#0EA5E9", bg: "#E0F2FE" },
  pickup: { label: "Pickup", color: "#0EA5E9", bg: "#E0F2FE" },
  ongoing: { label: "Ongoing", color: "#0EA5E9", bg: "#E0F2FE" },
  completed: { label: "Completed", color: "#138808", bg: "#E8F5E8" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
  driver_cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

const ONGOING_STATUSES = new Set(["searching", "accepted", "pickup", "ongoing"]);
const CANCELLED_STATUSES = new Set(["cancelled", "driver_cancelled"]);

export default function AdminRides() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const tabs = ["All", "Ongoing", "Completed", "Cancelled"];

  const { data } = trpc.admin.listRides.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const rides = data ?? [];

  const filtered =
    activeTab === "All"
      ? rides
      : rides.filter((r) =>
          activeTab === "Ongoing" ? ONGOING_STATUSES.has(r.status)
            : activeTab === "Completed" ? r.status === "completed"
            : CANCELLED_STATUSES.has(r.status)
        );

  return (
    <AdminLayout title="Rides Management">
      <div className="space-y-4">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                activeTab === tab ? "bg-[#FF6B00] text-white" : "bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Ride ID</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Route</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Fare</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ride) => {
                  const config = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.completed;
                  return (
                    <tr
                      key={ride.id}
                      onClick={() => navigate(`/admin/rides/${ride.id}`)}
                      className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">#{ride.id}</td>
                      <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.riderName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          <MapPin className="w-3 h-3 text-[#138808]" />
                          {ride.pickupAddress}
                          <span className="text-[#9CA3AF]">→</span>
                          <MapPin className="w-3 h-3 text-[#FF6B00]" />
                          {ride.dropAddress}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{Number(ride.totalFare)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-1 rounded-full font-medium"
                          style={{ color: config.color, backgroundColor: config.bg }}
                        >
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No rides found.</td>
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
