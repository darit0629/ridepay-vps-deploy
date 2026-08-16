import { useRef, useState } from "react";
import { Bell, ImageIcon, Send, Trash2, Type, Users, Car, UserCog, Megaphone, Sparkles, X } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useNotifications, type NotificationAudience, type NotificationKind } from "@/contexts/NotificationsContext";

const audienceOptions: { id: NotificationAudience; label: string; icon: typeof Users }[] = [
  { id: "both", label: "Rider + Driver", icon: Users },
  { id: "rider", label: "Rider Only", icon: UserCog },
  { id: "driver", label: "Driver Only", icon: Car },
];

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

export default function AdminNotifications() {
  const { notifications, sendNotification, removeNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audience, setAudience] = useState<NotificationAudience>("both");
  const [kind, setKind] = useState<NotificationKind>("text");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const sentNotifications = notifications.filter((n) => n.source === "admin");

  // Downscales to a max 1280px edge and re-encodes as JPEG so a straight-off
  // -camera photo (often several MB) comfortably fits in the notification
  // payload sent to the server. Encoded as a data URI (not a blob: URL) so
  // it's a plain string other devices can actually render.
  const handleBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setBannerUrl(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const canSend = title.trim().length > 0 && message.trim().length > 0 && (kind === "text" || !!bannerUrl);

  const handleSend = () => {
    if (!canSend) return;
    sendNotification({
      audience,
      kind,
      title: title.trim(),
      message: message.trim(),
      bannerUrl: kind === "banner" ? bannerUrl ?? undefined : undefined,
    });
    setTitle("");
    setMessage("");
    setBannerUrl(null);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 2500);
  };

  return (
    <AdminLayout title="Push Notifications" subtitle="Send offers and announcements straight to the Rider and Driver apps">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composer */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FF6B00]" /> Compose Notification
          </h2>

          {/* Audience */}
          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Send To</label>
            <div className="flex gap-2">
              {audienceOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAudience(opt.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${
                    audience === opt.id
                      ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A]"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <opt.icon className={`w-4 h-4 ${audience === opt.id ? "text-[#FF6B00]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`} />
                  <span className={`text-xs font-medium ${audience === opt.id ? "text-[#FF6B00]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Kind */}
          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setKind("text")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-colors ${
                  kind === "text"
                    ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00]"
                    : "border-gray-200 dark:border-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                <Type className="w-4 h-4" /> <span className="text-sm font-medium">Text Only</span>
              </button>
              <button
                onClick={() => setKind("banner")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-colors ${
                  kind === "banner"
                    ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00]"
                    : "border-gray-200 dark:border-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                <ImageIcon className="w-4 h-4" /> <span className="text-sm font-medium">With Banner</span>
              </button>
            </div>
          </div>

          {/* Banner upload */}
          {kind === "banner" && (
            <div>
              <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Banner Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBannerPick} className="hidden" />
              {bannerUrl ? (
                <div className="relative">
                  <img src={bannerUrl} alt="Banner preview" className="w-full h-36 object-cover rounded-xl" />
                  <button
                    onClick={() => setBannerUrl(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-2 text-[#6B7280] dark:text-[#9CA3AF] hover:border-[#FF6B00] hover:text-[#FF6B00] transition-colors"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-sm">Upload a banner image</span>
                </button>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flat ₹50 OFF this weekend"
              maxLength={60}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the notification message..."
              rows={3}
              maxLength={200}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] text-white font-semibold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FF8533] transition-colors"
          >
            <Send className="w-4 h-4" /> {justSent ? "Sent!" : "Send Notification"}
          </button>
        </div>

        {/* History */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Sent Notifications</h2>
          <div className="space-y-3 max-h-[640px] overflow-y-auto">
            {sentNotifications.length === 0 ? (
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] text-center py-10">Nothing sent yet</p>
            ) : (
              sentNotifications.map((n) => (
                <div key={n.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl overflow-hidden">
                  {n.kind === "banner" && n.bannerUrl && (
                    <img src={n.bannerUrl} alt={n.title} className="w-full h-24 object-cover" />
                  )}
                  <div className="p-3 flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
                      <Megaphone className="w-4 h-4 text-[#FF6B00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{n.title}</h3>
                        <button
                          onClick={() => removeNotification(n.id)}
                          className="p-1 -m-1 text-[#9CA3AF] hover:text-[#DC2626] flex-shrink-0"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A] px-2 py-0.5 rounded-full">
                          {n.audience === "both" ? "Rider + Driver" : n.audience}
                        </span>
                        <span className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System notifications preview note */}
      <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#138808] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#138808] dark:text-[#86EFAC]">
          Riders also automatically get notified when a driver is assigned, when the driver arrives, and when the
          destination is reached — those are sent by the app itself and don't need to be composed here.
        </p>
      </div>
    </AdminLayout>
  );
}
