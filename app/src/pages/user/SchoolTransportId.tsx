import { useNavigate, useParams } from "react-router";
import { ArrowLeft, User, QrCode, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function SchoolTransportId() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: sub } = trpc.school.getSubscription.useQuery({ id: id ?? "" }, { enabled: !!id });

  if (!sub) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#9CA3AF]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-8">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Transport ID</h1>
      </div>

      <div className="px-4 py-6">
        <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2C5282] rounded-3xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-white/70 tracking-widest">RIDEPAY SCHOOL TRANSPORT</p>
              <p className="text-xs text-white/90 font-medium">{sub.schoolName}</p>
            </div>
            <ShieldCheck className="w-6 h-6 text-white/80" />
          </div>

          <div className="flex items-center gap-4 mb-4">
            {sub.studentPhotoUrl ? (
              <img src={sub.studentPhotoUrl} alt={sub.studentName} className="w-20 h-20 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border-2 border-white/30">
                <User className="w-9 h-9 text-white/70" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">{sub.studentName}</p>
              <p className="text-xs text-white/80">Class {sub.className}{sub.section} · Roll {sub.rollNumber || "—"}</p>
              <p className="text-xs text-white/80 mt-0.5">Guardian: {sub.guardianName}</p>
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3 mb-3">
            <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <QrCode className="w-9 h-9 text-[#1E3A5F]" />
            </div>
            <div>
              <p className="text-[10px] text-white/70">Verification Code</p>
              <p className="font-mono font-bold text-lg tracking-widest">{sub.pickupPin}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/70">
            <span>ID: {sub.id.slice(0, 12).toUpperCase()}</span>
            <span>Valid till {sub.validTill}</span>
          </div>
        </div>

        <p className="text-xs text-[#9CA3AF] text-center mt-4">
          Show this ID to the driver or school staff for identity verification during pickup/drop.
        </p>
      </div>
    </div>
  );
}
