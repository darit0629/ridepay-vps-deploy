import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

const CATEGORIES = [
  { value: "Ride Problem", label: "Ride Problem" },
  { value: "Payment Problem", label: "Payment Problem" },
  { value: "Lost Item", label: "Lost Item" },
  { value: "Driver Behaviour", label: "Driver Behaviour" },
  { value: "School Transport", label: "School Transport" },
  { value: "App Issue", label: "App Issue" },
  { value: "Other", label: "Other" },
] as const;

function currentIdentity() {
  if (typeof window === "undefined") return { name: "", phone: "" };
  const phone = window.localStorage.getItem("userPhone") ?? "";
  const role = window.localStorage.getItem("userRole") ?? "user";
  try {
    const cached = window.localStorage.getItem(`ridepay_profile_${role}_${phone}`);
    const parsed = cached ? JSON.parse(cached) : null;
    return { name: parsed?.name ?? "", phone: phone ? `+91 ${phone}` : "" };
  } catch {
    return { name: "", phone: phone ? `+91 ${phone}` : "" };
  }
}

export default function ReportIssue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identity = currentIdentity();
  const role = typeof window !== "undefined" ? window.localStorage.getItem("userRole") : "user";

  const categoryParam = searchParams.get("category");
  const contextParam = searchParams.get("context");
  const initialCategory = (CATEGORIES.find((c) => c.value === categoryParam)?.value ?? "Ride Problem") as (typeof CATEGORIES)[number]["value"];

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(initialCategory);
  const [name, setName] = useState(identity.name);
  const [phone, setPhone] = useState(identity.phone);
  const [relatedId, setRelatedId] = useState("");
  const [description, setDescription] = useState(contextParam ? `${contextParam}\n\n` : "");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const createComplaintMutation = trpc.complaint.create.useMutation({
    onSuccess: (complaint) => setSubmitted(complaint.id),
  });

  const canSubmit = name.trim() && phone.trim() && description.trim().length >= 10;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createComplaintMutation.mutate({
      subject: category,
      description: description.trim(),
      reporterName: name.trim(),
      reporterPhone: phone.trim(),
      reporterType: role === "driver" ? "Driver" : "Customer",
      relatedRideId: relatedId.trim() || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#138808]" />
        </div>
        <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Report submitted</h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-1">
          Your ticket ID is <strong className="text-[#1A1A2E] dark:text-[#E5E7EB]">{submitted}</strong>.
        </p>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6">We typically respond within 48 hours.</p>
        <button onClick={() => navigate(-1)} className="btn-saffron px-6 py-2.5">Done</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-12">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Report an Issue</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number]["value"])}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Related ride/parcel ID (optional)</label>
            <input
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              placeholder="e.g. #RID12345"
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">What happened?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe the issue in as much detail as you can — at least 10 characters."
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] resize-none"
            />
          </div>

          {createComplaintMutation.isError && (
            <p className="text-sm text-[#DC2626]">Couldn't submit your report — please try again.</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createComplaintMutation.isPending}
            className="w-full py-3 rounded-xl bg-[#FF6B00] text-white font-medium text-sm disabled:opacity-40"
          >
            {createComplaintMutation.isPending ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
