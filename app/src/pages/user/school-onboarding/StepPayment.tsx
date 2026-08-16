import { useState, useEffect } from "react";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { openRazorpaySubscriptionCheckout } from "@/lib/razorpayCheckout";
import { useAuth } from "@/hooks/useAuth";
import { cardCls } from "./onboardingUi";
import type { SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
  onDone: () => void;
}

// The one step that isn't driven by the shell's shared "Continue" button —
// it manages its own async chain (create subscription -> create Razorpay
// checkout -> open modal -> verify) since Razorpay's own handler fires
// asynchronously, on its own timeline, not as a simple awaited step.
export default function StepPayment({ data, update, onDone }: Props) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [starting, setStarting] = useState(false);

  const createSubscriptionMutation = trpc.school.createSubscription.useMutation();
  const createCheckoutMutation = trpc.schoolBilling.createCheckout.useMutation();
  const verifyCheckoutMutation = trpc.schoolBilling.verifyCheckout.useMutation();

  // The definitive "payment succeeded" signal is the server-side webhook
  // flipping paymentStatus, not this tab's own optimistic verifyCheckout
  // call — poll for it once a subscription exists.
  const { data: subscription } = trpc.school.getSubscription.useQuery(
    { id: data.subscriptionId },
    { enabled: !!data.subscriptionId, refetchInterval: data.subscriptionId ? 4000 : false }
  );

  useEffect(() => {
    if (subscription?.paymentStatus === "paid") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.paymentStatus]);

  const handleSubscribe = async () => {
    setError("");
    setStarting(true);
    try {
      let subscriptionId = data.subscriptionId;
      if (!subscriptionId) {
        const created = await createSubscriptionMutation.mutateAsync({
          guardianPhone: user?.phone ?? "",
          guardianName: user?.name ?? "",
          guardianPhotoUrl: data.guardianPhotoUrl || undefined,
          guardianEmail: data.guardianEmail,
          emergencyContact: data.emergencyContact,
          studentName: data.studentName,
          studentPhotoUrl: data.studentPhotoUrl || undefined,
          studentIdPhotoUrl: data.studentIdPhotoUrl || undefined,
          schoolName: data.schoolName,
          schoolAddress: data.schoolAddress,
          schoolPhone: data.schoolPhone,
          className: data.className,
          section: data.section,
          rollNumber: data.rollNumber,
          homeAddress: data.homeAddress,
          pickupCoords: data.pickupCoords,
          dropCoords: data.dropCoords,
          morningPickupTime: data.morningPickupTime,
          schoolReportingTime: data.schoolReportingTime,
          schoolEndTime: data.schoolEndTime,
          returnPickupTime: data.returnPickupTime,
          medicalNotes: data.medicalNotes,
          allergies: data.allergies,
          specialInstructions: data.specialInstructions,
          authorizedPickupPersons: data.authorizedPickupPersons.split(",").map((s) => s.trim()).filter(Boolean),
          planId: data.planId,
          consentAccepted: data.consentAccepted,
        });
        subscriptionId = created.id;
        update("subscriptionId", subscriptionId);
      }

      const checkout = await createCheckoutMutation.mutateAsync({ subscriptionId });
      await openRazorpaySubscriptionCheckout({
        subscriptionId: checkout.razorpaySubscriptionId,
        name: "RidePay School Ride",
        description: `${data.studentName} — ${data.schoolName}`,
        prefill: { name: user?.name ?? undefined, email: data.guardianEmail || undefined, contact: user?.phone ?? undefined },
        onSuccess: async (result) => {
          try {
            await verifyCheckoutMutation.mutateAsync({ subscriptionId, ...result });
            utils.school.getSubscription.invalidate({ id: subscriptionId });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not confirm payment — please contact support.");
          }
        },
        onFailure: (message) => setError(message),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong — please try again.";
      // assertSubscriptionAuthorizationAllowed's guard message — see
      // api/lib/razorpayClient.ts. Only LIVE Razorpay keys are configured in
      // this environment, so this is the expected path here, not an error.
      if (message.includes("disabled in this environment")) {
        setBlocked(true);
      } else {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  };

  if (blocked) {
    return (
      <div className="space-y-4">
        <div className={`${cardCls} text-center`}>
          <AlertCircle className="w-10 h-10 text-[#FF6B00] mx-auto mb-2" />
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">You're on the list</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Payments aren't live on this environment yet — your request has been saved and our team will reach out once billing is enabled.
          </p>
        </div>
        <button onClick={onDone} className="w-full bg-[#FF6B00] text-white font-semibold py-3.5 rounded-xl">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${cardCls} text-center`}>
        <CreditCard className="w-10 h-10 text-[#FF6B00] mx-auto mb-2" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Subscribe & Continue</h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
          You'll authorize a recurring monthly payment via Razorpay. Pause or cancel anytime from your School dashboard.
        </p>
      </div>
      {error && <p className="text-xs text-[#DC2626] text-center">{error}</p>}
      <button
        onClick={handleSubscribe}
        disabled={starting}
        className="w-full bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2"
      >
        {starting && <Loader2 className="w-4 h-4 animate-spin" />}
        {starting ? "Starting..." : "Subscribe & Continue"}
      </button>
    </div>
  );
}
