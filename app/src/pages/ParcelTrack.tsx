import { useState } from "react";
import { useParams } from "react-router";
import {
  PackageCheck, Phone, ShieldAlert, KeyRound, IndianRupee, Smartphone, Wallet, CheckCircle2, MapPin,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

// Same single simulated customer identity used everywhere else in the app
// (see UserHome.tsx / UserPayment.tsx) — this public link has no login, so
// whoever pays here is treated as that same demo wallet.
const CUSTOMER_NAME = "Anjali Sharma";

const PARCEL_STAGE_FLOW: { id: "assigned" | "picked_up" | "arrived" | "delivered"; label: string }[] = [
  { id: "assigned", label: "Courier Assigned" },
  { id: "picked_up", label: "Picked Up" },
  { id: "arrived", label: "Arrived" },
  { id: "delivered", label: "Delivered" },
];

// Public, read-only-until-needed page a sender's shared WhatsApp link opens
// to. No login and no app chrome, same spirit as TripShare.tsx — this is what
// the receiver sees, including entering the delivery PIN and paying if the
// sender assigned them as payer.
export default function ParcelTrack() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const code = (trackingId || "").toUpperCase();

  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [walletError, setWalletError] = useState("");

  const trpcUtils = trpc.useUtils();
  const { data: parcel, isFetching } = trpc.parcel.getByTrackingId.useQuery(
    { trackingId: code },
    { enabled: !!code, refetchInterval: 2500, refetchIntervalInBackground: true }
  );
  const confirmDeliveryMutation = trpc.parcel.confirmDelivery.useMutation();
  const submitPaymentMutation = trpc.parcel.submitPayment.useMutation({
    onSuccess: () => trpcUtils.parcel.getByTrackingId.invalidate({ trackingId: code }),
  });
  const debitWalletMutation = trpc.settlement.debitWallet.useMutation();

  const handleConfirmPin = () => {
    if (!pinInput.trim()) return;
    confirmDeliveryMutation.mutate(
      { trackingId: code, pin: pinInput.trim() },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setPinError(result.error);
            return;
          }
          setPinError("");
          trpcUtils.parcel.getByTrackingId.invalidate({ trackingId: code });
        },
      }
    );
  };

  const handlePay = (method: "cash" | "upi" | "wallet") => {
    if (!parcel) return;
    const finish = () => {
      setWalletError("");
      submitPaymentMutation.mutate({ trackingId: code, method });
      if (method === "upi") {
        window.location.href = `upi://pay?pa=ridepay@okhdfc&pn=Ridepay&am=${parcel.cost}&cu=INR&tn=ParcelDelivery`;
      }
    };
    if (method === "wallet") {
      debitWalletMutation.mutate(
        { walletType: "customer", ownerId: CUSTOMER_NAME, amount: parcel.cost, description: `Parcel delivery ${code}` },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setWalletError("Insufficient wallet balance. Please choose another payment method.");
              return;
            }
            finish();
          },
        }
      );
      return;
    }
    finish();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col">
      <div className="bg-gradient-to-b from-[#0EA5E9] to-[#0284C7] px-6 pt-12 pb-10 text-center">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
          <img src="/assets/logo-light.png" alt="Ridepay" className="w-8 h-8 object-contain" />
        </div>
        <h1 className="text-lg font-bold text-white">Ridepay Parcel Tracking</h1>
        <p className="text-white/80 text-sm tracking-widest">{code || "No code provided"}</p>
      </div>

      <div className="flex-1 px-4 -mt-6">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-lg p-4 space-y-4">
          {!code ? (
            <p className="text-sm text-center text-[#6B7280] dark:text-[#9CA3AF] py-6">No tracking code provided.</p>
          ) : isFetching && !parcel ? (
            <p className="text-sm text-center text-[#6B7280] dark:text-[#9CA3AF] py-6">Looking up {code}...</p>
          ) : !parcel ? (
            <p className="text-sm text-center text-[#DC2626] py-6">No parcel found for this tracking code.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">From</p>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{parcel.pickup}</p>
                </div>
                <span className="text-xs font-medium text-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536] px-2.5 py-1 rounded-full capitalize">
                  {parcel.stage.replace("_", " ")}
                </span>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">To</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{parcel.destination}</p>
              </div>

              {/* Opens driving directions between pickup/destination for now —
                  swap the href here once the native-app deep link is ready. */}
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${parcel.pickupCoords.lat},${parcel.pickupCoords.lng}&destination=${parcel.destinationCoords.lat},${parcel.destinationCoords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#E0F2FE] dark:bg-[#0C2536] text-[#0EA5E9] text-sm font-medium"
              >
                <MapPin className="w-4 h-4" /> View on Map
              </a>

              <div className="flex items-center justify-between px-1">
                {PARCEL_STAGE_FLOW.map((step, i) => {
                  const currentIndex = PARCEL_STAGE_FLOW.findIndex((s) => s.id === parcel.stage);
                  const reached = i <= currentIndex;
                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center relative">
                      {i > 0 && (
                        <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`} />
                      )}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`}>
                        {reached && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-[9px] mt-1 text-center ${reached ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#FF6B00]">{parcel.driverName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{parcel.driverName}</p>
                  <p className="text-xs text-[#9CA3AF] truncate">{parcel.vehicle}</p>
                </div>
                <a href={`tel:${parcel.driverPhone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-[#138808]" />
                </a>
              </div>

              {parcel.stage === "arrived" && (
                <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <p className="text-xs font-medium text-[#FF6B00]">
                      The courier has arrived — enter the delivery PIN the sender shared with you
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="4-digit PIN"
                      inputMode="numeric"
                      className="flex-1 bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] tracking-widest text-center"
                    />
                    <button
                      onClick={handleConfirmPin}
                      disabled={pinInput.length !== 4 || confirmDeliveryMutation.isPending}
                      className="px-4 rounded-lg bg-[#FF6B00] text-white text-sm font-medium disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                  {pinError && <p className="text-xs text-[#DC2626]">{pinError}</p>}
                </div>
              )}

              {parcel.stage !== "delivered" && parcel.stage !== "arrived" && (
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF] justify-center">
                  <ShieldAlert className="w-3.5 h-3.5" /> Keep this link handy — you'll enter the delivery PIN here once the courier arrives.
                </div>
              )}

              {parcel.stage === "delivered" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-[#138808]">
                    <PackageCheck className="w-5 h-5" /> <span className="text-sm font-semibold">Delivered</span>
                  </div>
                  {parcel.paymentStatus === "confirmed" ? (
                    <p className="text-xs text-center text-[#9CA3AF]">₹{parcel.cost} paid via {parcel.paymentMethod}.</p>
                  ) : parcel.paidBy === "receiver" ? (
                    <>
                      <p className="text-xs text-center text-[#6B7280] dark:text-[#9CA3AF]">Pay ₹{parcel.cost} to complete this delivery</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["cash", "upi", "wallet"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => handlePay(m)}
                            disabled={submitPaymentMutation.isPending}
                            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium bg-gray-100 dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-50 transition-colors"
                          >
                            {submitPaymentMutation.isPending && submitPaymentMutation.variables?.method === m ? (
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                            ) : m === "cash" ? (
                              <IndianRupee className="w-3.5 h-3.5" />
                            ) : m === "upi" ? (
                              <Smartphone className="w-3.5 h-3.5" />
                            ) : (
                              <Wallet className="w-3.5 h-3.5" />
                            )}
                            {m === "cash" ? "Cash" : m === "upi" ? "UPI (Scan)" : "Wallet"}
                          </button>
                        ))}
                      </div>
                      {walletError && <p className="text-xs text-[#DC2626] text-center">{walletError}</p>}
                      <p className="text-[10px] text-center text-[#9CA3AF]">Tap a method to pay ₹{parcel.cost}</p>
                    </>
                  ) : (
                    <p className="text-xs text-center text-[#9CA3AF]">Waiting for the sender to complete payment...</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-center text-[10px] text-[#9CA3AF] py-6">This page updates automatically — no Ridepay login needed.</p>
    </div>
  );
}
