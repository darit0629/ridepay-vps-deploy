import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { complaintStatusConfig, type ComplaintStatus } from "@/lib/mockComplaints";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminComplaints() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"All" | ComplaintStatus>("All");
  const tabs: ("All" | ComplaintStatus)[] = ["All", "Open", "In Progress", "Resolved", "Closed"];

  const { data: complaints, isLoading } = trpc.complaint.list.useQuery(
    activeTab === "All" ? {} : { status: activeTab }
  );

  return (
    <AdminLayout title="Complaints & Support Tickets">
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
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
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Ticket ID</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Issue</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Reported By</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Loading tickets…</td>
                  </tr>
                ) : !complaints?.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">No tickets in this category.</td>
                  </tr>
                ) : (
                  complaints.map((c) => {
                    const config = complaintStatusConfig[c.status];
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/admin/complaints/${c.id}`)}
                        className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{c.id}</td>
                        <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{c.subject}</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{c.reporterName} · {c.reporterType}</td>
                        <td className="px-4 py-3 text-xs text-[#9CA3AF]">
                          {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
