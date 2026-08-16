import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, AlertTriangle, Trash2, X } from "lucide-react";
import { trpc } from "@/providers/trpc";

const WHAT_GETS_DELETED = [
  "Your name, email, date of birth, gender, and profile photo",
  "Your phone number and login access — you will be signed out immediately",
  "Saved places, emergency contacts, and app preferences",
  "Driver documents (licence, RC, insurance) if you have a driver account",
  "Push-notification subscriptions",
];

const WHAT_IS_RETAINED = [
  "Wallet and payment transaction history, retained for legal/tax purposes as required by Indian law",
  "Historical ride, parcel, and complaint records already tied to completed transactions",
];

export default function AccountDelete() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  const deleteAccountMutation = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      localStorage.removeItem("userRole");
      localStorage.removeItem("userPhone");
      // Any ridepay_profile_* keys and similar cached identity data should
      // not persist past a real account deletion — clear everything this
      // app has ever written to localStorage, not just the two role keys.
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ridepay_"))
        .forEach((k) => localStorage.removeItem(k));
      navigate("/app", { replace: true });
    },
    onError: (err) => setError(err.message || "Couldn't delete your account — please try again."),
  });

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-12">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Delete Account</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <div className="bg-red-50 dark:bg-[#3A1A1A] rounded-2xl p-4 border border-red-100 dark:border-[#5A2A2A] flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#DC2626]">This permanently deactivates your Ridepay account. This action cannot be undone.</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">What gets deleted</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#4B5563] dark:text-[#9CA3AF]">
            {WHAT_GETS_DELETED.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">What's retained, and why</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#4B5563] dark:text-[#9CA3AF]">
            {WHAT_IS_RETAINED.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <a href="/legal/data-deletion" className="text-sm text-[#FF6B00] hover:underline inline-block">Read the full Data Deletion Policy</a>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-[#3A1A1A] rounded-xl p-3 text-sm text-[#DC2626]">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 py-3 rounded-xl bg-[#DC2626] text-white font-medium text-sm flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete My Account
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">Confirm account deletion</h3>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                aria-label="Cancel"
              >
                <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Type <strong className="text-[#DC2626]">DELETE</strong> below to confirm. This cannot be undone.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              autoFocus
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#DC2626] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAccountMutation.mutate()}
                disabled={!canConfirm || deleteAccountMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-[#DC2626] text-white font-medium text-sm disabled:opacity-40"
              >
                {deleteAccountMutation.isPending ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
