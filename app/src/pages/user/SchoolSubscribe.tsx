import { useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, User, School, Plus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useNotifications } from "@/contexts/NotificationsContext";

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Under Review", color: "#FF6B00", bg: "#FFF5EB" },
  reupload_requested: { label: "Re-upload Needed", color: "#DC2626", bg: "#FEE2E2" },
  approved: { label: "Approved", color: "#138808", bg: "#E8F5E8" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
  suspended: { label: "Suspended", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

export default function SchoolSubscribe() {
  const navigate = useNavigate();
  const { pushSystemNotification } = useNotifications();

  // Real-identity path (guardianUserId, server-derived) — the primary
  // lookup for this page and for BottomNav's nav-swap, replacing the
  // fragile guardianPhone string-match the original single-page form used.
  const { data: mySubscriptions } = trpc.school.listMyActiveSubscriptions.useQuery(undefined, {
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  // Detects a subscription's verification status changing on this device's
  // own poll and fires a real notification — same pattern used for
  // withdrawal/referral status transitions elsewhere in the app.
  const knownStatuses = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!mySubscriptions) return;
    for (const sub of mySubscriptions) {
      const previous = knownStatuses.current.get(sub.id);
      if (previous && previous !== sub.status) {
        const messages: Record<string, string> = {
          approved: `${sub.studentName}'s school transport subscription has been approved!`,
          rejected: `${sub.studentName}'s subscription was rejected. ${sub.adminNote ?? ""}`.trim(),
          reupload_requested: `Please re-upload documents for ${sub.studentName}'s subscription. ${sub.adminNote ?? ""}`.trim(),
          suspended: `${sub.studentName}'s school transport subscription has been suspended.`,
        };
        const message = messages[sub.status];
        if (message) pushSystemNotification({ audience: "rider", title: "School Subscription Update", message });
      }
      knownStatuses.current.set(sub.id, sub.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySubscriptions]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/user/home")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">School Ride</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {(mySubscriptions ?? []).length === 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center space-y-3">
            <School className="w-10 h-10 text-[#FF6B00] mx-auto" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Subscribe your child for safe, tracked daily school transport with verified drivers.
            </p>
          </div>
        )}

        {(mySubscriptions ?? []).map((sub) => {
          const badge = STATUS_LABEL[sub.status];
          return (
            <div key={sub.id} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                {sub.studentPhotoUrl ? (
                  <img src={sub.studentPhotoUrl} alt={sub.studentName} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center">
                    <User className="w-6 h-6 text-[#FF6B00]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{sub.studentName}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{sub.schoolName} · Class {sub.className}</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0" style={{ color: badge.color, backgroundColor: badge.bg }}>
                  {badge.label}
                </span>
              </div>
              {sub.status === "rejected" && sub.adminNote && (
                <p className="text-xs text-[#DC2626] mt-2 bg-red-50 dark:bg-[#3A1A1A] rounded-lg p-2">Reason: {sub.adminNote}</p>
              )}
              {sub.status === "reupload_requested" && (
                <p className="text-xs text-[#FF6B00] mt-2 bg-[#FFF5EB] dark:bg-[#3D2914] rounded-lg p-2">
                  {sub.adminNote || "Please review and re-submit your documents."}
                </p>
              )}
              {sub.status === "pending_review" && sub.paymentStatus !== "paid" && (
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg p-2">
                  Awaiting admin verification — payment authorization happens once you resume checkout below.
                </p>
              )}
              {sub.status === "approved" && (
                <button
                  onClick={() => navigate(`/user/school-dashboard/${sub.id}`)}
                  className="mt-3 w-full bg-[#138808] text-white text-sm font-semibold py-2.5 rounded-xl"
                >
                  Open School Dashboard
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => navigate("/user/school-onboarding")}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#FF6B00] text-[#FF6B00] font-semibold py-3.5 rounded-xl"
        >
          <Plus className="w-5 h-5" /> Add a Student
        </button>
      </div>

      <BottomNav role="user" />
    </div>
  );
}
