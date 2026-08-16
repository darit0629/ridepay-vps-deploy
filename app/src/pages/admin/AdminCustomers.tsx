import { useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminCustomers() {
  // ?q= lets global search (AdminGlobalSearch) deep-link straight into a
  // filtered result — this page has no separate detail route to navigate to.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const highlightId = searchParams.get("id");
  const { data } = trpc.admin.listCustomers.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const customers = data ?? [];

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const needle = search.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(needle) || (c.phone ?? "").includes(needle) || (c.email ?? "").toLowerCase().includes(needle);
  });

  return (
    <AdminLayout title="Customer Management">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full bg-white dark:bg-[#1E293B] rounded-xl pl-10 pr-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Total Rides</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Join Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      highlightId && String(c.id) === highlightId ? "bg-[#FFF5EB] dark:bg-[#3D2914]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E8F5E8] flex items-center justify-center">
                          <span className="text-xs font-bold text-[#138808]">{(c.name || "?").charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{c.name || "Unnamed"}</p>
                          <p className="text-xs text-[#9CA3AF]">{c.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{c.totalRides}</td>
                    <td className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-[#9CA3AF]">No customers found.</td>
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
