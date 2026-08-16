import { useNavigate } from "react-router";
import { ArrowLeft, Building2, FileText, Users, BarChart3, UserCog, LayoutGrid } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";

const perks = [
  { icon: FileText, label: "Monthly consolidated invoices" },
  { icon: Users, label: "Employee travel management" },
  { icon: BarChart3, label: "Usage reports & analytics" },
  { icon: UserCog, label: "Dedicated account manager" },
];

export default function UserCorporateDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: membership, isLoading } = trpc.corporate.getMine.useQuery(undefined, { enabled: !!user });

  if (!isLoading && membership?.status !== "active") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24 flex flex-col items-center justify-center px-6 text-center">
        <Building2 className="w-12 h-12 text-[#6B7280] dark:text-white/30 mb-3" />
        <p className="font-semibold text-[#1A1A2E] dark:text-white">No active corporate account</p>
        <p className="text-sm text-[#6B7280] dark:text-white/50 mt-1 mb-5">Apply for a corporate account from the Flying Plus page.</p>
        <button
          onClick={() => navigate("/user/subscription")}
          className="bg-[#1E3A5F] text-white font-medium px-5 py-2.5 rounded-xl text-sm"
        >
          Go to Flying Plus
        </button>
        <BottomNav role="user" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1E3A5F] to-[#12283F] px-4 pt-4 pb-8 relative overflow-hidden animate-fade-slide">
        <Building2 className="absolute -right-6 -bottom-6 w-40 h-40 text-white/[0.06] rotate-[-8deg]" strokeWidth={1.5} />
        <div className="flex items-center justify-between mb-4 relative z-10">
          <button onClick={() => navigate("/user/subscription")} className="p-2 -ml-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">Corporate Account</h1>
          <div className="w-6" />
        </div>
        <div className="relative z-10">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-[#22C55E] bg-[#22C55E]/15 px-2.5 py-1 rounded-full mb-3">
            Active
          </span>
          <h2 className="text-white font-bold text-2xl leading-tight">{membership?.companyName}</h2>
          <p className="text-white/60 text-sm mt-1">
            {membership?.contactPerson} • {membership?.contactPhone}
          </p>
          {membership?.gstin && <p className="text-white/40 text-xs mt-1">GSTIN: {membership.gstin}</p>}
        </div>
      </div>

      {/* Perks */}
      <Reveal delay={80}>
        <div className="px-4 -mt-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm p-4">
            <p className="font-semibold text-sm text-[#1A1A2E] dark:text-white mb-3">Your Corporate Benefits</p>
            <div className="space-y-3">
              {perks.map((perk) => (
                <div key={perk.label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#E8EEF5] dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <perk.icon className="w-4 h-4 text-[#1E3A5F] dark:text-white/70" />
                  </div>
                  <span className="text-sm text-[#1A1A2E] dark:text-white/80">{perk.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate("/user/services")}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-white/[0.06] text-[#1A1A2E] dark:text-white font-medium py-3 rounded-xl text-sm"
          >
            <LayoutGrid className="w-4 h-4" /> Explore More Services
          </button>
        </div>
      </Reveal>

      <BottomNav role="user" />
    </div>
  );
}
