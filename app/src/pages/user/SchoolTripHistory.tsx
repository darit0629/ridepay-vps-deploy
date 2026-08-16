import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Circle, MapPin } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { MORNING_STAGES, EVENING_STAGES } from "@/lib/schoolStages";

export default function SchoolTripHistory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: sub } = trpc.school.getSubscription.useQuery({ id: id ?? "" }, { enabled: !!id });
  const { data: trips } = trpc.school.listTripHistory.useQuery({ subscriptionId: id ?? "" }, { enabled: !!id, refetchInterval: 10000 });

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-8">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Trip History{sub ? ` — ${sub.studentName}` : ""}</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {(trips ?? []).map((trip) => {
          const stages = trip.direction === "morning" ? MORNING_STAGES : EVENING_STAGES;
          const complete = trip.stageIndex >= stages.length - 1;
          return (
            <div key={trip.id} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">
                  {trip.date} · {trip.direction === "morning" ? "Morning" : "Evening"} Run
                </p>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${complete ? "bg-[#E8F5E8] text-[#138808]" : "bg-[#FFF5EB] text-[#FF6B00]"}`}>
                  {complete ? "Completed" : "In Progress"}
                </span>
              </div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">{trip.driverName} · {trip.vehicle}</p>
              <div className="space-y-1.5">
                {trip.stageHistory.map((event, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i === trip.stageHistory.length - 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-[#138808] flex-shrink-0" /> : <Circle className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />}
                    <span className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB] flex-1">{event.stage.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-[#9CA3AF]">{new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                <MapPin className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-xs text-[#9CA3AF]">
                  {trip.pickupPinVerified ? "Pickup verified" : "Pickup not verified"} · {trip.dropPinVerified ? "Drop verified" : "Drop not verified"}
                </span>
              </div>
            </div>
          );
        })}
        {(trips ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-8">No trips recorded yet.</p>}
      </div>
    </div>
  );
}
