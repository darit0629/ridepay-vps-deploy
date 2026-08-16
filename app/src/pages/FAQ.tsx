import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}
interface FaqCategory {
  title: string;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    title: "Ride Problems",
    items: [
      { q: "My driver is late — what should I do?", a: "You can call your driver directly from the trip screen, or cancel free of charge if you're still within the free-cancellation window shown in-app." },
      { q: "The driver took a longer route than expected", a: "Fares are calculated from the actual distance travelled, shown live during the trip. If you believe you were overcharged, report it via Report an Issue with your trip details." },
      { q: "My driver cancelled on me", a: "You won't be charged anything, and we'll try to match you with another nearby driver right away." },
      { q: "I left something in the vehicle", a: "See the \"Lost Item\" section below." },
    ],
  },
  {
    title: "Payment Problems",
    items: [
      { q: "I was charged but the ride shows as failed/cancelled", a: "Report it via Report an Issue → Payment Problem with your transaction details. Verified duplicate or failed charges are refunded to your wallet." },
      { q: "My wallet recharge didn't reflect", a: "Recharges usually reflect within a minute of a successful payment. If it's been longer, report the issue with your payment reference." },
      { q: "How do I get a refund?", a: "Refunds are credited to your Ridepay wallet. See our Refund Policy in Settings for full details on what qualifies." },
    ],
  },
  {
    title: "Lost Item",
    items: [
      { q: "I lost something during a ride", a: "Go to Trip History, open the relevant trip, and use \"Call Driver\" to reach out directly — most items are recovered this way. If you can't reach the driver, report it via Report an Issue → Lost Item with the trip details." },
    ],
  },
  {
    title: "Driver Support",
    items: [
      { q: "When do I get paid?", a: "Your fare share is credited to your driver wallet immediately after each trip settles — no waiting for a payout cycle." },
      { q: "How do I withdraw my earnings?", a: "Go to Wallet → Withdraw. Withdrawals are reviewed and typically processed within 24 hours." },
      { q: "My documents expired — I can't go online", a: "Re-upload the expired document from your Profile. You can go online again as soon as it's re-verified." },
    ],
  },
  {
    title: "Passenger Support",
    items: [
      { q: "Is my ride safe?", a: "Every driver is document-verified before approval, and every trip has live tracking, an SOS button, and PIN verification for school transport. See our Safety Policy for details." },
      { q: "Can I share my trip with someone?", a: "Yes — use \"Share Trip\" from the active ride screen to send a live tracking link to anyone." },
    ],
  },
];

export default function FAQ() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-12">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Frequently Asked Questions</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {CATEGORIES.map((cat) => (
          <div key={cat.title} className="space-y-2">
            <h2 className="font-semibold text-sm text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide px-1">{cat.title}</h2>
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {cat.items.map((item) => {
                const key = `${cat.title}:${item.q}`;
                const isOpen = openKey === key;
                return (
                  <div key={key}>
                    <button
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                    >
                      <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{item.q}</span>
                      <ChevronDown className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <p className="px-4 pb-4 text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{item.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 text-center space-y-2">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Still need help?</p>
          <button onClick={() => navigate("/help/report-issue")} className="text-sm font-medium text-[#FF6B00] hover:underline">
            Report an Issue →
          </button>
        </div>
      </div>
    </div>
  );
}
