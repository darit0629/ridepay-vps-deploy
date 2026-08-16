import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, Phone, ShieldCheck, School, CreditCard, Star, Award,
  CheckCircle2, ShieldAlert, MessageCircle, HeartPulse, History, IdCard, Pause, Play, XCircle, Share2, LayoutGrid,
  CalendarOff, X, Receipt, AlertTriangle, RefreshCw, UserCog,
} from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { createDriverIcon } from "@/lib/googleMarkerIcons";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { useRickshawOverlay } from "@/hooks/useRickshawOverlay";
import { trpc } from "@/providers/trpc";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/useAuth";
import { MORNING_STAGES, EVENING_STAGES, STAGE_LABELS } from "@/lib/schoolStages";
import { openRazorpaySubscriptionCheckout } from "@/lib/razorpayCheckout";

const vehicleCoords: google.maps.LatLngLiteral = { lat: 23.178, lng: 88.5605 };
const schoolCoords: google.maps.LatLngLiteral = { lat: 23.1745, lng: 88.5605 };

export default function SchoolDashboard() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const vehicleMarkerRef = useRef<google.maps.Marker | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, true);
  const schoolVehicle = useRickshawOverlay(mapInstance, "e-riksha-school");
  const { pushSystemNotification } = useNotifications();
  const { user } = useAuth();

  const direction = new Date().getHours() < 13 ? "morning" : "evening";
  const stages = direction === "morning" ? MORNING_STAGES : EVENING_STAGES;

  const utils = trpc.useUtils();
  const { data: sub } = trpc.school.getSubscription.useQuery({ id: id ?? "" }, { enabled: !!id, refetchInterval: 8000, refetchIntervalInBackground: true });
  const { data: trip } = trpc.school.getTodayTrip.useQuery({ subscriptionId: id ?? "", direction }, { enabled: !!id, refetchInterval: 5000, refetchIntervalInBackground: true });
  const { data: plans } = trpc.school.listPlans.useQuery();
  const pauseMutation = trpc.school.pauseSubscription.useMutation({ onSuccess: () => utils.school.getSubscription.invalidate({ id }) });
  const resumeMutation = trpc.school.resumeSubscription.useMutation({ onSuccess: () => utils.school.getSubscription.invalidate({ id }) });
  const cancelMutation = trpc.school.cancelSubscription.useMutation({ onSuccess: () => utils.school.getSubscription.invalidate({ id }) });

  // Retry-payment flow — re-opens Razorpay checkout against the subscription's
  // existing razorpaySubscriptionId (createCheckout is idempotent once one
  // exists, see api/queries/schoolBilling.ts) rather than creating a new one.
  const createCheckoutMutation = trpc.schoolBilling.createCheckout.useMutation();
  const verifyCheckoutMutation = trpc.schoolBilling.verifyCheckout.useMutation();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  const handleRetryPayment = async () => {
    if (!id) return;
    setRetryError("");
    setRetrying(true);
    try {
      const checkout = await createCheckoutMutation.mutateAsync({ subscriptionId: id });
      await openRazorpaySubscriptionCheckout({
        subscriptionId: checkout.razorpaySubscriptionId,
        name: "RidePay School Ride",
        description: `${sub?.studentName ?? ""} — ${sub?.schoolName ?? ""}`,
        prefill: { name: user?.name ?? undefined, contact: user?.phone ?? undefined },
        onSuccess: async (result) => {
          try {
            await verifyCheckoutMutation.mutateAsync({ subscriptionId: id, ...result });
            utils.school.getSubscription.invalidate({ id });
          } catch (err) {
            setRetryError(err instanceof Error ? err.message : "Could not confirm payment — please contact support.");
          }
        },
        onFailure: (message) => setRetryError(message),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong — please try again.";
      setRetryError(message.includes("disabled in this environment") ? "Payments aren't live on this environment yet — please contact support." : message);
    } finally {
      setRetrying(false);
    }
  };

  // Real GPS for the assigned driver — polled and fed into the 3D overlay
  // below, replacing the fixed decorative coordinates this map used to show.
  const { data: driverLocation } = trpc.school.getAssignedDriverLocation.useQuery(
    { subscriptionId: id ?? "" },
    { enabled: !!id && !!sub?.assignedDriverId, refetchInterval: 5000, refetchIntervalInBackground: true }
  );

  const [showSkipSheet, setShowSkipSheet] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [skipDate, setSkipDate] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const { data: skipRequests } = trpc.school.listSkipRequests.useQuery({ subscriptionId: id ?? "" }, { enabled: !!id });
  const requestSkipMutation = trpc.school.requestSkipDay.useMutation({
    onSuccess: () => {
      utils.school.listSkipRequests.invalidate({ subscriptionId: id });
      setShowSkipSheet(false);
      setSkipDate("");
      setSkipReason("");
    },
  });
  const cancelSkipMutation = trpc.school.cancelSkipRequest.useMutation({ onSuccess: () => utils.school.listSkipRequests.invalidate({ subscriptionId: id }) });
  const { data: paymentHistory } = trpc.schoolBilling.listInvoices.useQuery({ subscriptionId: id ?? "" }, { enabled: !!id && showPaymentHistory });
  const raiseSosMutation = trpc.sos.raise.useMutation();

  const handleSOS = () => {
    raiseSosMutation.mutate({ role: "user", subscriptionId: id, note: `SOS raised during ${sub?.studentName ?? "school"} transport` });
    window.location.href = "tel:112";
  };

  const upcomingSkips = (skipRequests ?? []).filter((s) => s.date >= new Date().toISOString().slice(0, 10));

  const plan = plans?.find((p) => p.id === sub?.planId);

  // Detects the assigned driver changing (replacement) and each new trip
  // stage as they arrive from polling, firing real notifications locally —
  // same pattern used for withdrawal/referral status transitions elsewhere.
  const knownDriverRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!sub) return;
    if (knownDriverRef.current && sub.assignedDriverName && knownDriverRef.current !== sub.assignedDriverName) {
      pushSystemNotification({ audience: "rider", title: "Driver changed", message: `${sub.assignedDriverName} is now assigned to ${sub.studentName}'s school transport.` });
    }
    knownDriverRef.current = sub.assignedDriverName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub?.assignedDriverName]);

  const knownStageRef = useRef<number>(-2);
  useEffect(() => {
    if (!trip || !sub) return;
    if (knownStageRef.current >= -1 && trip.stageIndex > knownStageRef.current) {
      const stageKey = stages[trip.stageIndex];
      pushSystemNotification({ audience: "rider", title: STAGE_LABELS[stageKey] ?? stageKey, message: `${sub.studentName}: ${STAGE_LABELS[stageKey] ?? stageKey}.` });
    }
    knownStageRef.current = trip.stageIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.stageIndex]);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;
    let disposed = false;
    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;
        const gMap = new google.maps.Map(mapContainer.current, {
          center: vehicleCoords, zoom: 14, disableDefaultUI: true, zoomControl: true,
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);
        vehicleMarkerRef.current = new google.maps.Marker({ position: vehicleCoords, map: gMap, icon: createDriverIcon() });
        new google.maps.Marker({
          position: schoolCoords, map: gMap,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#1E3A5F", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
        });
        schoolVehicle.setPosition(vehicleCoords.lat, vehicleCoords.lng, 0);
        setTimeout(() => { if (schoolVehicle.isAvailableRef.current) vehicleMarkerRef.current?.setMap(null); }, 300);
      })
      .catch((error) => { console.error("Error loading Google Maps:", error); setMapLoadError(true); });
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed each real GPS update into the 3D overlay — it eases between points
  // itself, so this just needs to fire on every new poll result.
  useEffect(() => {
    if (!driverLocation) return;
    schoolVehicle.setPosition(driverLocation.lat, driverLocation.lng, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng]);

  if (!sub) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#9CA3AF]">Loading...</p>
      </div>
    );
  }

  const currentStageIdx = trip?.stageIndex ?? -1;
  const currentStageLabel = currentStageIdx >= 0 ? STAGE_LABELS[stages[currentStageIdx]] ?? stages[currentStageIdx] : "Not started yet";
  const tripComplete = currentStageIdx >= stages.length - 1;
  const boardedIdx = (stages as readonly string[]).indexOf("student_boarded");
  const activePin = currentStageIdx < boardedIdx ? sub.pickupPin : sub.dropPin;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-8">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/user/school-subscribe")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{sub.studentName}</h1>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Class {sub.className}{sub.section} · {sub.schoolName}</p>
        </div>
        <button onClick={() => navigate(`/user/school-id/${sub.id}`)} className="w-9 h-9 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
          <IdCard className="w-4 h-4 text-[#FF6B00]" />
        </button>
      </div>

      {/* Map */}
      <div className="px-4 pt-3">
        <div className="relative h-56 rounded-2xl overflow-hidden shadow-sm">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}
          <div className="absolute top-3 left-3 right-3 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-2.5 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tripComplete ? "bg-[#138808]" : "bg-[#FF6B00] animate-pulse"}`} />
            <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB] flex-1">{currentStageLabel}</p>
            {sub.assignedDriverId && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${driverLocation ? "text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22]" : "text-[#9CA3AF] bg-gray-100 dark:bg-gray-800"}`}>
                {driverLocation ? "Live" : "Locating…"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Driver of the day */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Today's Driver</h2>
            {sub.assignedDriverName && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#138808]"><ShieldCheck className="w-3 h-3" /> Verified</span>
            )}
          </div>
          {sub.assignedDriverName ? (
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <img src="/assets/driver-avatar.png" alt={sub.assignedDriverName} className="w-11 h-11 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.assignedDriverName}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{sub.assignedVehicle}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#9CA3AF]">
                  <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-[#FF6B00] fill-[#FF6B00]" /> 4.8</span>
                  <span className="flex items-center gap-0.5"><Award className="w-3 h-3" /> 3+ yrs</span>
                </div>
              </div>
              {sub.assignedDriverPhone && (
                <a href={`tel:${sub.assignedDriverPhone}`} className="w-9 h-9 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-white" />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#9CA3AF] text-center py-4">No driver assigned yet — admin will assign one shortly.</p>
          )}
          {sub.backupDriverName && (
            <div className="flex items-center gap-2 mt-2 px-1">
              <UserCog className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
              <p className="text-xs text-[#9CA3AF]">Backup driver: <span className="text-[#1A1A2E] dark:text-[#E5E7EB] font-medium">{sub.backupDriverName}</span></p>
            </div>
          )}
        </div>

        {/* Pickup/Drop PIN */}
        {sub.assignedDriverName && !tripComplete && (
          <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-[#138808]" />
              <p className="text-sm font-medium text-[#138808] dark:text-[#86EFAC]">{currentStageIdx < 4 ? "Pickup" : "Drop-off"} PIN</p>
            </div>
            <div className="flex justify-center gap-3 mb-1">
              {activePin.split("").map((digit, i) => (
                <div key={i} className="w-12 h-14 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm">{digit}</div>
              ))}
            </div>
            <p className="text-xs text-[#138808]/80 dark:text-[#86EFAC]/80 text-center">Share only with the driver at the moment of pickup/drop-off</p>
          </div>
        )}

        {/* Trip timeline */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm mb-3">{direction === "morning" ? "Morning" : "Evening"} Trip Timeline</h2>
          <div className="space-y-2">
            {stages.map((stage, i) => {
              const event = trip?.stageHistory.find((h) => h.stage === stage);
              const done = i <= currentStageIdx;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-[#138808]" : "bg-gray-100 dark:bg-gray-700"}`}>
                    {done && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`text-sm flex-1 ${done ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>{STAGE_LABELS[stage]}</span>
                  {event && <span className="text-xs text-[#9CA3AF]">{new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscription status */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#7C3AED]" /> Subscription</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-[#9CA3AF]">Plan</p><p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{plan?.name ?? "—"}</p></div>
            <div><p className="text-xs text-[#9CA3AF]">Valid Till</p><p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.validTill}</p></div>
            <div><p className="text-xs text-[#9CA3AF]">Payment Status</p>
              <p className={`font-medium capitalize ${sub.paymentStatus === "paid" ? "text-[#138808]" : "text-[#DC2626]"}`}>{sub.paymentStatus}</p>
            </div>
            <div><p className="text-xs text-[#9CA3AF]">Auto-Renew</p><p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.autoRenew ? "On" : "Off"}</p></div>
          </div>
          {sub.paymentStatus === "overdue" && (
            <div className="bg-red-50 dark:bg-[#3A1A1A] rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#DC2626]">
                  Your last payment couldn't be processed.
                  {sub.graceEndsAt ? ` Update your payment method by ${sub.graceEndsAt} to avoid interruption.` : " Update your payment method to avoid interruption."}
                </p>
              </div>
              {retryError && <p className="text-[11px] text-[#DC2626]">{retryError}</p>}
              <button
                onClick={handleRetryPayment}
                disabled={retrying}
                className="w-full flex items-center justify-center gap-1.5 bg-[#DC2626] disabled:opacity-60 text-white text-xs font-semibold py-2.5 rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} /> {retrying ? "Opening…" : "Update Payment"}
              </button>
            </div>
          )}
          {sub.paymentStatus === "unpaid" && !sub.razorpaySubscriptionId && (
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg p-2.5">
              Subscription authorization wasn't completed during sign-up. Contact support to finish setting up billing.
            </p>
          )}
          <div className="flex gap-2">
            {sub.status === "approved" ? (
              <button onClick={() => pauseMutation.mutate({ id: sub.id })} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold py-2.5 rounded-xl">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            ) : sub.status === "suspended" ? (
              <button onClick={() => resumeMutation.mutate({ id: sub.id })} className="flex-1 flex items-center justify-center gap-1.5 bg-[#138808] text-white text-xs font-semibold py-2.5 rounded-xl">
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
            ) : null}
            <button onClick={() => cancelMutation.mutate({ id: sub.id })} className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-[#3A1A1A] text-[#DC2626] text-xs font-semibold py-2.5 rounded-xl">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={() => navigate(`/user/school-history/${sub.id}`)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold py-2.5 rounded-xl">
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSkipSheet(true)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold py-2.5 rounded-xl">
              <CalendarOff className="w-3.5 h-3.5" /> Pause a Day
            </button>
            <button onClick={() => setShowPaymentHistory(true)} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold py-2.5 rounded-xl">
              <Receipt className="w-3.5 h-3.5" /> Payment History
            </button>
          </div>
          {upcomingSkips.length > 0 && (
            <div className="space-y-1.5">
              {upcomingSkips.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">No pickup on {s.date}</p>
                    {s.reason && <p className="text-[11px] text-[#9CA3AF] truncate">{s.reason}</p>}
                  </div>
                  <button onClick={() => cancelSkipMutation.mutate({ id: s.id })} className="text-[#DC2626] p-1 flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[#DC2626]" /> Emergency</h2>
          <div className="grid grid-cols-4 gap-2">
            <button onClick={handleSOS} className="flex flex-col items-center gap-1 bg-red-50 dark:bg-[#3A1A1A] rounded-xl py-3">
              <ShieldAlert className="w-4 h-4 text-[#DC2626]" /><span className="text-[10px] font-medium text-[#DC2626]">SOS</span>
            </button>
            {sub.assignedDriverPhone ? (
              <a href={`tel:${sub.assignedDriverPhone}`} className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl py-3">
                <Phone className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" /><span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Driver</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl py-3 opacity-40">
                <Phone className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" /><span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Driver</span>
              </div>
            )}
            <button
              onClick={() => navigate(`/help/report-issue?category=${encodeURIComponent("School Transport")}&context=${encodeURIComponent(`Student: ${sub.studentName}, Subscription: ${sub.id}`)}`)}
              className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl py-3"
            >
              <MessageCircle className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" /><span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Support</span>
            </button>
            {sub.schoolPhone ? (
              <a href={`tel:${sub.schoolPhone}`} className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl py-3">
                <School className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" /><span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">School</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl py-3 opacity-40">
                <School className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" /><span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">School</span>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              const text = `Tracking ${sub.studentName}'s school ride live: ${window.location.href}`;
              if (navigator.share) {
                try { await navigator.share({ title: "Ridepay — Live School Trip", text }); return; } catch { /* cancelled */ }
              }
              await navigator.clipboard.writeText(text);
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold py-2.5 rounded-xl"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Live Location
          </button>
          {(sub.medicalNotes || sub.allergies) && (
            <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 flex items-start gap-2">
              <HeartPulse className="w-4 h-4 text-[#FF6B00] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">
                {sub.medicalNotes && <p>{sub.medicalNotes}</p>}
                {sub.allergies && <p className="font-medium">Allergies: {sub.allergies}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] px-1">
          <School className="w-3.5 h-3.5" /> {sub.homeAddress} → {sub.schoolName}
        </div>

        {/* The bottom-nav slot this dashboard occupies replaces "Services" for
            school-subscribed guardians (see BottomNav.tsx) — this is their way
            back into the rest of Ridepay's services without it. */}
        <button
          onClick={() => navigate("/user/services")}
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-semibold py-3 rounded-2xl shadow-sm"
        >
          <LayoutGrid className="w-4 h-4 text-[#FF6B00]" /> Explore More Services
        </button>
      </div>

      {/* Skip a day sheet */}
      {showSkipSheet && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowSkipSheet(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Pause pickup for a day</h2>
              <button onClick={() => setShowSkipSheet(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">No trip will be created for this date — takes effect immediately.</p>
            <div className="space-y-3">
              <input
                type="date"
                value={skipDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSkipDate(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
            <button
              onClick={() => id && requestSkipMutation.mutate({ subscriptionId: id, date: skipDate, reason: skipReason })}
              disabled={!skipDate || requestSkipMutation.isPending}
              className="w-full btn-saffron py-3.5 mt-4 disabled:opacity-50"
            >
              {requestSkipMutation.isPending ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Payment history sheet */}
      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowPaymentHistory(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Payment History</h2>
              <button onClick={() => setShowPaymentHistory(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            {paymentHistory && paymentHistory.length > 0 ? (
              <div className="space-y-2">
                {paymentHistory.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{p.amount}</p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {p.status === "failed" && p.failureReason ? ` · ${p.failureReason}` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${p.status === "captured" ? "text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22]" : "text-[#DC2626] bg-red-50 dark:bg-[#3A1A1A]"}`}>
                      {p.status === "captured" ? "Paid" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#9CA3AF] text-center py-6">No payments recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
