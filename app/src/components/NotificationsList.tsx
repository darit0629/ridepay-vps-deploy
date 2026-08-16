import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, BellOff, Megaphone, Sparkles, Trash2 } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import BottomNav from "@/components/BottomNav";

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationsListProps {
  role: "rider" | "driver";
  navRole: "user" | "driver";
  backTo: string;
}

export default function NotificationsList({ role, navRole, backTo }: NotificationsListProps) {
  const navigate = useNavigate();
  const {
    notificationsFor, markAllRead, hideNotification,
    pushEnabled, requestNotificationPermission,
  } = useNotifications();

  const notifications = notificationsFor(role);
  const hasUnread = notifications.some((n) => !n.read);

  // Mark everything read once the inbox has actually been viewed.
  useEffect(() => {
    if (hasUnread) markAllRead(role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(backTo)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] flex-1">Notifications</h1>
      </div>

      {!pushEnabled && (
        <div className="mx-4 mt-4 bg-[#FFF5EB] dark:bg-[#3A2A1A] border border-[#FFDDBB] dark:border-[#5A4020] rounded-xl p-3 flex items-center gap-3">
          <Bell className="w-5 h-5 text-[#FF6B00] flex-shrink-0" />
          <p className="text-xs text-[#7A4A1A] dark:text-[#FFC98A] flex-1">
            Turn on phone notifications so you never miss an offer or ride update.
          </p>
          <button
            onClick={() => requestNotificationPermission(role)}
            className="text-xs font-semibold text-[#FF6B00] flex-shrink-0"
          >
            Enable
          </button>
        </div>
      )}

      <div className="px-4 py-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BellOff className="w-12 h-12 text-[#D1D5DB] dark:text-[#475569] mb-3" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden"
            >
              {n.kind === "banner" && n.bannerUrl && (
                <img src={n.bannerUrl} alt={n.title} className="w-full h-32 object-cover" />
              )}
              <div className="p-4 flex gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.source === "admin" ? "bg-[#FFF5EB] dark:bg-[#3A2A1A]" : "bg-[#E8F5E8] dark:bg-[#1A3A22]"
                  }`}
                >
                  {n.source === "admin" ? (
                    <Megaphone className="w-4 h-4 text-[#FF6B00]" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-[#138808]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{n.title}</h3>
                    <button
                      onClick={() => hideNotification(n.id)}
                      className="p-1 -m-1 text-[#9CA3AF] hover:text-[#DC2626] flex-shrink-0"
                      aria-label="Dismiss"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{n.message}</p>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mt-1.5">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav role={navRole} />
    </div>
  );
}
