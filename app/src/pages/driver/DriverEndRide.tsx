import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Check, Banknote, Download, Repeat, Share2, IndianRupee, Loader2 } from "lucide-react";
import { downloadTextFile, buildInvoiceHtml } from "@/lib/downloadFile";
import { trpc } from "@/providers/trpc";

export default function DriverEndRide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));
  const validRideId = Number.isFinite(rideId) && rideId > 0;

  const utils = trpc.useUtils();
  const { data: ride } = trpc.ride.getById.useQuery({ id: rideId }, { enabled: validRideId, refetchInterval: 3000 });
  const { data: payment } = trpc.ride.getPayment.useQuery(
    { rideId },
    { enabled: validRideId, refetchInterval: 2000, refetchIntervalInBackground: true }
  );
  const updateStatusMutation = trpc.ride.updateStatus.useMutation({
    onError: () => {
      // Server-side arrival check rejected this (e.g. this screen was
      // reached directly, without the drop-off screen's own gate ever
      // confirming real GPS proximity) — send the driver back to keep
      // navigating instead of silently stranding them on a screen that
      // never marks the ride complete.
      markedCompleteRef.current = false;
      navigate(`/driver/ride-dropoff?rideId=${rideId}`);
    },
  });
  const confirmCashMutation = trpc.ride.confirmCashPayment.useMutation({
    onSuccess: () => utils.ride.getPayment.invalidate({ rideId }),
  });

  // Marks the trip itself as finished the moment the driver lands on this
  // screen — payment settlement (below) is tracked separately and can lag
  // behind this, same as it would in reality for a cash fare.
  const markedCompleteRef = useRef(false);
  useEffect(() => {
    if (!validRideId || markedCompleteRef.current) return;
    if (ride && ride.status === "ongoing") {
      markedCompleteRef.current = true;
      updateStatusMutation.mutate({ rideId, status: "completed" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride, validRideId]);

  const fare = ride ? Number(ride.totalFare) : 0;

  const handleEndRide = () => {
    navigate("/driver/earnings");
  };

  const handleDownloadReceipt = () => {
    if (!ride) return;
    const html = buildInvoiceHtml({
      invoiceNo: `RCPT-${ride.id}`,
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      billedTo: ride.riderName || "Rider",
      billedToDetail: `${ride.rideType === "share" ? "Share Ride" : "Reserve Ride"} · ${Number(ride.distance).toFixed(1)} KM · ${ride.estimatedTime} min`,
      lineItems: [{ label: "Ride Fare", amount: fare }],
      total: fare,
    });
    downloadTextFile(`receipt-${ride.id}.html`, html, "text/html");
  };

  const handleShareEarnings = async () => {
    const text = `I just completed a ride on Ridepay and earned ₹${Math.max(0, fare - 2)}! 🚖`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled share sheet — no-op
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!ride) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0F172A]">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading ride…</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A] overflow-y-auto">
      {/* Green Header */}
      <div className="bg-[#138808] px-4 pt-12 pb-8 text-center flex-shrink-0">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-white font-bold text-lg">You have reached</h1>
        <p className="text-white/80">Drop-off Location</p>
      </div>

      <div className="px-4 -mt-4 space-y-4 flex-1 pb-4">
        {/* Payment Status — live, driven by what the rider picked on their payment screen */}
        {!payment && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#9CA3AF] animate-spin flex-shrink-0" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Waiting for the passenger to choose a payment method...</p>
          </div>
        )}

        {payment && payment.status === "pending" && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Collect cash payment</h3>
            <p className="text-2xl font-bold text-[#FF6B00] mb-3">₹{Number(payment.amount)}</p>
            <div className="w-16 h-16 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center mx-auto mb-4">
              <IndianRupee className="w-8 h-8 text-[#138808]" />
            </div>
            <button
              onClick={() => confirmCashMutation.mutate({ rideId })}
              disabled={confirmCashMutation.isPending}
              className="w-full btn-green py-3.5 disabled:opacity-50"
            >
              Confirm Cash Received
            </button>
          </div>
        )}

        {payment && payment.status === "completed" && (
          <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#138808]">
                Payment Received{payment.method === "wallet" ? " via Wallet" : payment.method === "upi" ? " via UPI" : ""}
              </p>
              <p className="text-xs text-[#138808]/80">₹{Number(payment.amount)} credited</p>
            </div>
          </div>
        )}

        {/* Trip Summary */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Trip Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#9CA3AF]">Distance</span>
              <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">{Number(ride.distance).toFixed(1)} KM</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#9CA3AF]">Duration</span>
              <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">{ride.estimatedTime} min</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280] dark:text-[#9CA3AF]">Ride Type</span>
              <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">{ride.rideType === "share" ? "Share Ride" : "Reserve Ride"}</span>
            </div>
            <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
              <span className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Total Fare</span>
              <span className="font-bold text-xl text-[#FF6B00]">₹{fare}</span>
            </div>
          </div>
        </div>

        {/* Payment method (once known) */}
        {payment && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Payment Method</h3>
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5 text-[#138808]" />
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB] capitalize">{payment.method}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadReceipt}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Download className="w-4 h-4" /> Receipt
          </button>
          <button
            onClick={handleShareEarnings}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Share2 className="w-4 h-4" /> Share Earnings
          </button>
        </div>
      </div>

      {/* End Ride Button */}
      <div className="p-4 bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-gray-700 flex-shrink-0 space-y-2">
        <button
          onClick={handleEndRide}
          disabled={payment?.status !== "completed"}
          className="w-full btn-green py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Repeat className="w-4 h-4" /> End Ride & Go Online Again
        </button>
        {payment?.status !== "completed" && (
          <p className="text-center text-xs text-[#9CA3AF]">Waiting for payment to be settled before you can go back online.</p>
        )}
      </div>
    </div>
  );
}
