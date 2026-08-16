import { useState } from "react";
import { User, Download, Sparkles, FileText, Receipt } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { downloadTextFile, buildInvoiceHtml } from "@/lib/downloadFile";
import AdminLayout from "@/components/admin/AdminLayout";

const INVOICE_RECIPIENT_TYPES = ["Driver", "Advertiser", "School Subscription", "Customer Subscription"] as const;

export default function AdminFinancials() {
  const reportMutation = trpc.ai.report.useMutation();
  const { data: financials } = trpc.admin.getFinancials.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });

  const totalCommission = financials?.totalCommission ?? 0;
  const collected = financials?.collected ?? 0;
  const pending = financials?.pending ?? 0;
  const driverDues = financials?.driverDues ?? [];

  // The commission report reflects real numbers; the other report types need
  // data this schema doesn't track yet (cost accounting, subscription
  // revenue) so their snapshots stay illustrative placeholders for the AI
  // summary demo, clearly distinct from the real commission figures above.
  const REPORT_TYPES = [
    {
      id: "commission",
      label: "Commission Report",
      data: `Total Commission: ₹${totalCommission.toFixed(0)}. Collected: ₹${collected.toFixed(0)}. Pending: ₹${pending.toFixed(0)}.`,
    },
    { id: "profit", label: "Profit Report", data: "Profit reporting requires operating-cost data this prototype doesn't track yet." },
    { id: "transactions", label: "Total Transactions", data: "Transaction-volume reporting requires payment-method breakdown analytics not yet built." },
    { id: "subscriptions", label: "Subscription Revenue", data: "Subscription revenue requires a real subscription-billing backend, not yet built." },
    { id: "driver-monthly", label: "Driver Monthly Report", data: `${driverDues.length} drivers with recorded earnings. Top: ${driverDues[0]?.name ?? "—"} with ₹${driverDues[0]?.due ?? 0} in commission dues.` },
  ] as const;

  const [selectedReport, setSelectedReport] = useState<(typeof REPORT_TYPES)[number]>(REPORT_TYPES[0]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const [invoiceType, setInvoiceType] = useState<(typeof INVOICE_RECIPIENT_TYPES)[number]>("Driver");
  const [invoiceRecipient, setInvoiceRecipient] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("Platform commission");
  const [invoiceAmount, setInvoiceAmount] = useState("2000");

  const handleGenerateAiSummary = async () => {
    setAiSummary(null);
    const result = await reportMutation.mutateAsync({ title: selectedReport.label, dataSnapshot: selectedReport.data });
    setAiSummary(result.summary);
  };

  const handleDownloadReport = () => {
    const content = `FLYING RIDE — ${selectedReport.label.toUpperCase()}\nGenerated: ${new Date().toLocaleString("en-IN")}\n\nDATA SNAPSHOT\n${selectedReport.data}\n\nAI SUMMARY\n${aiSummary ?? "(Not generated — click 'Generate AI Summary' first for a narrative summary.)"}\n`;
    downloadTextFile(`${selectedReport.id}-report-${Date.now()}.txt`, content);
  };

  const handleGenerateInvoice = () => {
    const amount = Number(invoiceAmount) || 0;
    const html = buildInvoiceHtml({
      invoiceNo: `INV-${Date.now().toString().slice(-8)}`,
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      billedTo: invoiceRecipient,
      billedToDetail: invoiceType,
      lineItems: [{ label: invoiceDescription, amount }],
      total: amount,
    });
    downloadTextFile(`invoice-${invoiceRecipient.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.html`, html, "text/html");
  };

  return (
    <AdminLayout title="Financials & Commission">
      {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Total Commission</p>
            <p className="text-2xl font-bold text-[#1E3A5F] dark:text-[#93C5FD]">₹{totalCommission.toFixed(0)}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Collected</p>
            <p className="text-2xl font-bold text-[#138808]">₹{collected.toFixed(0)}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Pending</p>
            <p className="text-2xl font-bold text-[#FF6B00]">₹{pending.toFixed(0)}</p>
          </div>
        </div>

        {/* Top Drivers Due */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Top Drivers Due</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#0F172A]">
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Driver</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Rides</th>
                  <th className="text-left text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] uppercase px-4 py-3">Due Amount</th>
                </tr>
              </thead>
              <tbody>
                {driverDues.map((d) => (
                  <tr key={d.name} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FFF5EB] flex items-center justify-center">
                          <User className="w-4 h-4 text-[#FF6B00]" />
                        </div>
                        <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{d.rides}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#FF6B00]">₹{d.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Reports */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Reports</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {REPORT_TYPES.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedReport(r); setAiSummary(null); }}
                className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                  selectedReport.id === r.id ? "bg-[#7C3AED] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 mb-4">
            <p className="text-xs text-[#9CA3AF] mb-1">Data Snapshot</p>
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{selectedReport.data}</p>
          </div>

          {(reportMutation.isPending || aiSummary) && (
            <div className="bg-[#F3E8FF] dark:bg-[#2D1B4E] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#C4B5FD]" />
                <p className="text-xs font-medium text-[#7C3AED] dark:text-[#C4B5FD]">AI Summary</p>
              </div>
              {reportMutation.isPending ? (
                <div className="h-4 bg-[#7C3AED]/10 rounded animate-pulse mt-2" />
              ) : (
                <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{aiSummary}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGenerateAiSummary}
              disabled={reportMutation.isPending}
              className="flex items-center justify-center gap-2 bg-[#7C3AED] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> {reportMutation.isPending ? "Generating..." : "Generate AI Summary"}
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center gap-2 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-semibold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" /> Download Report
            </button>
          </div>
        </div>

        {/* Invoice Generator */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-[#FF6B00]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Generate Invoice / Bill</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Recipient Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INVOICE_RECIPIENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setInvoiceType(type)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      invoiceType === type ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Recipient Name</label>
              <input
                type="text"
                value={invoiceRecipient}
                onChange={(e) => setInvoiceRecipient(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>

            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Description</label>
              <input
                type="text"
                value={invoiceDescription}
                onChange={(e) => setInvoiceDescription(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>

            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Amount (₹)</label>
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateInvoice}
            disabled={!invoiceRecipient.trim() || !invoiceDescription.trim()}
            className="w-full flex items-center justify-center gap-2 btn-saffron py-3.5 mt-4 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Generate & Download Invoice
          </button>
        </div>
    </AdminLayout>
  );
}
