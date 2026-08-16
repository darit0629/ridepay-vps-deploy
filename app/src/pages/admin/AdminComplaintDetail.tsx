import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { User, Phone, Send, Car, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { complaintStatusConfig, complaintStatusFlow, type ComplaintStatus } from "@/lib/mockComplaints";
import AdminLayout from "@/components/admin/AdminLayout";
import { useNotifications } from "@/contexts/NotificationsContext";

export default function AdminComplaintDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { pushSystemNotification } = useNotifications();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.complaint.get.useQuery({ id: id ?? "" }, { enabled: !!id });
  const updateStatusMutation = trpc.complaint.updateStatus.useMutation({
    onSuccess: () => utils.complaint.get.invalidate({ id }),
  });
  const addMessageMutation = trpc.complaint.addMessage.useMutation({
    onSuccess: () => utils.complaint.get.invalidate({ id }),
  });

  const [draftMessage, setDraftMessage] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">Loading ticket…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-4">Ticket not found</p>
        <button onClick={() => navigate("/admin/complaints")} className="btn-saffron px-6 py-2.5">
          Back to Complaints
        </button>
      </div>
    );
  }

  const { complaint, messages } = data;
  const config = complaintStatusConfig[complaint.status];

  const handleStatusChange = (status: ComplaintStatus) => {
    updateStatusMutation.mutate({ id: complaint.id, status });
  };

  const handleSend = () => {
    if (!draftMessage.trim()) return;
    const text = draftMessage.trim();
    addMessageMutation.mutate({ id: complaint.id, sender: "admin", text });
    setDraftMessage("");
    pushSystemNotification({
      audience: complaint.reporterType === "Driver" ? "driver" : "rider",
      title: `Update on your ticket ${complaint.id}`,
      message: text,
    });
  };

  return (
    <AdminLayout
      title={complaint.id}
      subtitle={new Date(complaint.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      backTo="/admin/complaints"
      headerActions={
        <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: config.color, backgroundColor: config.bg }}>
          {config.label}
        </span>
      }
    >
      <div className="max-w-2xl space-y-4">
        {/* Complaint Details */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">{complaint.subject}</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{complaint.description}</p>
          {complaint.relatedRideId && (
            <button
              onClick={() => navigate(`/admin/rides/${complaint.relatedRideId!.replace("#", "")}`)}
              className="flex items-center gap-2 mt-3 text-xs font-medium text-[#0EA5E9] hover:underline"
            >
              <Car className="w-3.5 h-3.5" /> View related ride {complaint.relatedRideId}
            </button>
          )}
        </div>

        {/* Reporter */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#9CA3AF]">Reported by ({complaint.reporterType})</p>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{complaint.reporterName}</p>
            </div>
            <a
              href={`tel:${complaint.reporterPhone.replace(/\s/g, "")}`}
              className="flex items-center gap-1.5 text-xs font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A2D1A] px-3 py-1.5 rounded-full flex-shrink-0"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          </div>
        </div>

        {/* Status Flow */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm mb-3">Resolution Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {complaintStatusFlow.map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  complaint.status === s ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {complaint.status === s && <CheckCircle2 className="w-3.5 h-3.5" />}
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Message Thread */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm mb-3">Messages</h3>
          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-4">No messages yet — start the conversation below.</p>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.sender === "admin"
                        ? "bg-[#FF6B00] text-white rounded-br-sm"
                        : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.sender === "admin" ? "text-white/70" : "text-[#9CA3AF]"}`}>
                      {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={`Message ${complaint.reporterName}...`}
              className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
            <button
              onClick={handleSend}
              disabled={!draftMessage.trim()}
              className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center flex-shrink-0 hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
