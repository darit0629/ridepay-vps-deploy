import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, GraduationCap, ChevronRight, ShieldCheck, ShieldAlert, ArrowRightCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useNotifications } from "@/contexts/NotificationsContext";
import { MORNING_STAGES, EVENING_STAGES } from "@/lib/schoolStages";
import { useAuth } from "@/hooks/useAuth";

const STAGE_LABELS: Record<string, string> = {
  driver_assigned: "Driver Assigned", driver_started: "Start Trip", near_pickup: "Near Pickup",
  arrived_pickup: "Arrived at Pickup", student_boarded: "Student Boarded", pickup_confirmed: "Pickup Confirmed",
  left_pickup: "Left Pickup", reached_school: "Reached School", left_school: "Left School",
  near_home: "Near Home", reached_home: "Reached Home", student_dropped: "Student Dropped", trip_completed: "Trip Completed",
};

function StudentTripCard({ subscriptionId, studentName, className, schoolName, direction }: {
  subscriptionId: string; studentName: string; className: string; schoolName: string; direction: "morning" | "evening";
}) {
  const { pushSystemNotification } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const utils = trpc.useUtils();
  const { data: trip } = trpc.school.getTodayTrip.useQuery({ subscriptionId, direction }, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const advanceMutation = trpc.school.advanceTripStage.useMutation({ onSuccess: () => utils.school.getTodayTrip.invalidate({ subscriptionId, direction }) });
  const verifyPinMutation = trpc.school.verifyPin.useMutation({
    onSuccess: (result) => {
      if (!result.ok) { setPinError(result.error); return; }
      setPinError(""); setPinInput("");
      utils.school.getTodayTrip.invalidate({ subscriptionId, direction });
    },
  });

  if (!trip) return null;
  const stages = direction === "morning" ? MORNING_STAGES : EVENING_STAGES;
  const stageLabel = trip.stageIndex >= 0 ? STAGE_LABELS[stages[trip.stageIndex]] : "Not started";
  const nextStage = stages[trip.stageIndex + 1];
  const isComplete = trip.stageIndex >= stages.length - 1;

  // Boarding happens at a different stage per direction — morning picks up
  // from home ("arrived_pickup"), evening picks up from school
  // ("reached_school") — so the PIN gate stage isn't the same name in both.
  const boardingGateStage = direction === "morning" ? "arrived_pickup" : "reached_school";
  const dropGateStage = direction === "morning" ? "reached_school" : "reached_home";
  const boardingGateIdx = (stages as readonly string[]).indexOf(boardingGateStage);
  const dropGateIdx = (stages as readonly string[]).indexOf(dropGateStage);
  const boardedIdx = (stages as readonly string[]).indexOf("student_boarded");
  const needsPickupPin = trip.stageIndex >= boardingGateIdx && !trip.pickupPinVerified && trip.stageIndex < boardedIdx;
  const needsDropPin = trip.stageIndex >= dropGateIdx && !trip.dropPinVerified;

  const handleAdvance = () => {
    advanceMutation.mutate({ tripId: trip.id }, {
      onSuccess: (updated) => {
        if (!updated) return;
        const label = STAGE_LABELS[stages[updated.stageIndex]] ?? stages[updated.stageIndex];
        pushSystemNotification({ audience: "rider", title: label, message: `${studentName}: ${label}.` });
      },
    });
  };

  const handleVerifyPin = (kind: "pickup" | "drop") => {
    if (!pinInput.trim()) return;
    verifyPinMutation.mutate({ tripId: trip.id, pin: pinInput.trim(), kind });
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-[#FF6B00]" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{studentName}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">Class {className} · {schoolName}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0 ${isComplete ? "bg-[#E8F5E8] text-[#138808]" : "bg-[#FFF5EB] text-[#FF6B00]"}`}>{stageLabel}</span>
        <ChevronRight className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 dark:border-gray-700 pt-3">
          {needsPickupPin && (
            <div className="space-y-2">
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Enter pickup PIN from guardian to confirm boarding</p>
              <div className="flex gap-2">
                <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} maxLength={4} className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" placeholder="4-digit PIN" />
                <button onClick={() => handleVerifyPin("pickup")} className="bg-[#138808] text-white text-xs font-semibold px-3 rounded-lg flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verify</button>
              </div>
            </div>
          )}
          {needsDropPin && (
            <div className="space-y-2">
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Enter drop PIN to confirm hand-off</p>
              <div className="flex gap-2">
                <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} maxLength={4} className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" placeholder="4-digit PIN" />
                <button onClick={() => handleVerifyPin("drop")} className="bg-[#138808] text-white text-xs font-semibold px-3 rounded-lg flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verify</button>
              </div>
            </div>
          )}
          {pinError && <p className="text-xs text-[#DC2626]">{pinError}</p>}

          {!isComplete && (
            <button
              onClick={handleAdvance}
              disabled={(needsPickupPin && !trip.pickupPinVerified) || (needsDropPin && !trip.dropPinVerified)}
              className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              <ArrowRightCircle className="w-4 h-4" /> {nextStage ? STAGE_LABELS[nextStage] : "Complete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function DriverSchoolMode() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const driverName = user?.name ?? "";
  const { pushSystemNotification } = useNotifications();
  const direction = new Date().getHours() < 13 ? "morning" : "evening";

  const { data: students } = trpc.school.listMyAssignedStudents.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // School Duty Mode isn't gated by the normal "online" toggle (Driver
  // Dashboard's watchPosition only runs while that screen is mounted and
  // isOnline is on), so guardians' live-location view would go stale the
  // moment a driver opens this screen without its own GPS feed.
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastPushRef = useRef(0);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastPushRef.current < 5000) return;
        lastPushRef.current = now;
        updateLocationMutation.mutate({ lat: position.coords.latitude.toString(), lng: position.coords.longitude.toString() });
      },
      (error) => console.error("Error watching driver location:", error),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raiseSosMutation = trpc.sos.raise.useMutation();
  const handleEmergency = () => {
    raiseSosMutation.mutate({ role: "driver", note: "Emergency raised during School Duty Mode" });
    pushSystemNotification({ audience: "both", title: "Emergency alert — School Duty", message: `${driverName} raised an emergency alert during school transport duty. Contacting support.` });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      <div className="bg-gradient-to-b from-[#1E3A5F] to-[#2C5282] px-4 pt-4 pb-6">
        <button onClick={() => navigate("/driver/dashboard")} className="mb-3"><ArrowLeft className="w-6 h-6 text-white" /></button>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-white" />
          <h1 className="text-white font-bold text-lg">School Duty Mode</h1>
        </div>
        <p className="text-white/80 text-sm mt-1">{direction === "morning" ? "Morning pickup run" : "Evening drop-off run"} · {(students ?? []).length} students assigned</p>
      </div>

      <div className="px-4 -mt-3 space-y-3">
        {(students ?? []).map((s) => (
          <StudentTripCard key={s.id} subscriptionId={s.id} studentName={s.studentName} className={s.className} schoolName={s.schoolName} direction={direction} />
        ))}
        {(students ?? []).length === 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
            <p className="text-sm text-[#9CA3AF]">No school students assigned to you right now.</p>
          </div>
        )}

        <button onClick={handleEmergency} className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-[#3A1A1A] text-[#DC2626] font-semibold py-3.5 rounded-xl">
          <ShieldAlert className="w-5 h-5" /> Emergency / Incident Report
        </button>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
