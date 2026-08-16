import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, MapPin, Clock, Repeat, Trash2, Copy, Pencil, X, Bell,
  Car, Bike, CircleDot, Zap,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };

type Frequency = "once" | "weekly" | "monthly";
type VehicleType = "e-riksha" | "auto-rickshaw" | "car" | "bike";
type ScheduleStatus = "upcoming" | "active" | "completed" | "cancelled" | "expired";

const VEHICLE_OPTIONS: { id: VehicleType; label: string; icon: typeof Car }[] = [
  { id: "e-riksha", label: "E-Riksha", icon: Zap },
  { id: "auto-rickshaw", label: "Auto", icon: CircleDot },
  { id: "car", label: "Car", icon: Car },
  { id: "bike", label: "Bike", icon: Bike },
];

const DAYS_OF_WEEK = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 0, label: "Sun" },
];

const frequencyLabel: Record<Frequency, string> = { once: "One Time", weekly: "Weekly", monthly: "Monthly" };

const REMINDER_OPTIONS = [5, 15, 30, 60];

const STATUS_META: Record<ScheduleStatus, { label: string; bg: string; color: string }> = {
  upcoming: { label: "Upcoming", bg: "#E0F2FE", color: "#0EA5E9" },
  active: { label: "Active", bg: "#E8F5E8", color: "#138808" },
  completed: { label: "Completed", bg: "#F3E8FF", color: "#7C3AED" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#DC2626" },
  expired: { label: "Expired", bg: "#F3F4F6", color: "#6B7280" },
};

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormState {
  label: string;
  pickupAddress: string; pickupLat: number | null; pickupLng: number | null;
  dropAddress: string; dropLat: number | null; dropLng: number | null;
  vehicleType: VehicleType;
  time: string;
  frequency: Frequency;
  scheduledDate: string;
  daysOfWeek: number[];
  dayOfMonth: number;
  reminderMinutesBefore: number;
}

const emptyForm: FormState = {
  label: "",
  pickupAddress: "", pickupLat: null, pickupLng: null,
  dropAddress: "", dropLat: null, dropLng: null,
  vehicleType: "e-riksha",
  time: "08:00",
  frequency: "once",
  scheduledDate: todayDateStr(),
  daysOfWeek: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
  reminderMinutesBefore: 15,
};

export default function UserScheduleRide() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: schedules, isLoading } = trpc.schedule.list.useQuery();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [pickerTarget, setPickerTarget] = useState<"pickup" | "drop" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const invalidate = () => utils.schedule.list.invalidate();

  const createMutation = trpc.schedule.create.useMutation({
    onSuccess: () => { invalidate(); setForm(emptyForm); showToast("Ride scheduled! We'll remind you before it's due."); },
    onError: (err) => setFormError(err.message),
  });
  const updateMutation = trpc.schedule.update.useMutation({
    onSuccess: () => { invalidate(); setEditingId(null); setForm(emptyForm); showToast("Schedule updated."); },
    onError: (err) => setFormError(err.message),
  });
  const cancelMutation = trpc.schedule.cancel.useMutation({ onSuccess: () => { invalidate(); showToast("Schedule cancelled."); } });
  const duplicateMutation = trpc.schedule.duplicate.useMutation({ onSuccess: () => { invalidate(); showToast("Duplicated — edit the copy below."); } });
  const deleteMutation = trpc.schedule.delete.useMutation({ onSuccess: () => { invalidate(); showToast("Schedule deleted."); } });

  const toggleDay = (day: number) => {
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day] }));
  };

  const canSubmit =
    form.pickupLat !== null && form.pickupLng !== null && form.dropLat !== null && form.dropLng !== null &&
    (form.frequency !== "once" || !!form.scheduledDate) &&
    (form.frequency !== "weekly" || form.daysOfWeek.length > 0) &&
    (form.frequency !== "monthly" || (form.dayOfMonth >= 1 && form.dayOfMonth <= 31));

  const buildPayload = () => ({
    label: form.label.trim() || undefined,
    pickupLat: String(form.pickupLat), pickupLng: String(form.pickupLng), pickupAddress: form.pickupAddress,
    dropLat: String(form.dropLat), dropLng: String(form.dropLng), dropAddress: form.dropAddress,
    vehicleType: form.vehicleType, segment: "reserve" as const,
    scheduledTime: form.time,
    frequency: form.frequency,
    scheduledDate: form.frequency === "once" ? form.scheduledDate : undefined,
    daysOfWeek: form.frequency === "weekly" ? form.daysOfWeek : undefined,
    dayOfMonth: form.frequency === "monthly" ? form.dayOfMonth : undefined,
    reminderMinutesBefore: form.reminderMinutesBefore,
  });

  const handleSubmit = () => {
    if (!canSubmit) return;
    setFormError(null);
    if (editingId !== null) updateMutation.mutate({ id: editingId, ...buildPayload() });
    else createMutation.mutate(buildPayload());
  };

  const startEdit = (s: NonNullable<typeof schedules>[number]) => {
    setEditingId(s.id);
    setForm({
      label: s.label ?? "",
      pickupAddress: s.pickupAddress, pickupLat: Number(s.pickupLat), pickupLng: Number(s.pickupLng),
      dropAddress: s.dropAddress, dropLat: Number(s.dropLat), dropLng: Number(s.dropLng),
      vehicleType: (s.vehicleType as VehicleType) ?? "e-riksha",
      time: s.scheduledTime,
      frequency: s.frequency as Frequency,
      scheduledDate: s.scheduledDate ? String(s.scheduledDate) : todayDateStr(),
      daysOfWeek: s.daysOfWeek ?? [1, 2, 3, 4, 5],
      dayOfMonth: s.dayOfMonth ?? 1,
      reminderMinutesBefore: s.reminderMinutesBefore,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setFormError(null); };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/services")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Scheduled Rides</h1>
      </div>

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-[#1A1A2E]/90 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap animate-slide-up">
          {toast}
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Create / Edit Schedule */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{editingId !== null ? "Edit Schedule" : "Create a Schedule"}</h2>
            {editingId !== null && (
              <button onClick={cancelEdit} className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Label (optional) — e.g. Office Pickup"
              className="w-full text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
            />

            <button
              onClick={() => setPickerTarget("pickup")}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className="w-3 h-3 rounded-full bg-[#138808] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${form.pickupAddress ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {form.pickupAddress || "Pickup location"}
              </span>
            </button>
            <button
              onClick={() => setPickerTarget("drop")}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className="w-3 h-3 rounded-full bg-[#FF6B00] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${form.dropAddress ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {form.dropAddress || "Destination"}
              </span>
            </button>

            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Vehicle</p>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLE_OPTIONS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setForm((f) => ({ ...f, vehicleType: v.id }))}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                      form.vehicleType === v.id ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                    }`}
                  >
                    <v.icon className="w-4 h-4" /> {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="flex-1 text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Repeat</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(frequencyLabel) as Frequency[]).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setForm((f) => ({ ...f, frequency: freq }))}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      form.frequency === freq ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                    }`}
                  >
                    {frequencyLabel[freq]}
                  </button>
                ))}
              </div>
            </div>

            {form.frequency === "once" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0 w-14">Date</span>
                <input
                  type="date"
                  min={todayDateStr()}
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  className="flex-1 text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            )}

            {form.frequency === "weekly" && (
              <div>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Repeat on</p>
                <div className="flex gap-1.5">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      className={`w-9 h-9 rounded-full text-[10px] font-semibold transition-colors ${
                        form.daysOfWeek.includes(d.value) ? "bg-[#138808] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.frequency === "monthly" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0 w-20">Day of month</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) }))}
                  className="w-20 text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
            )}

            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" /> Remind me before
              </p>
              <div className="grid grid-cols-4 gap-2">
                {REMINDER_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setForm((f) => ({ ...f, reminderMinutesBefore: mins }))}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      form.reminderMinutesBefore === mins ? "bg-[#0EA5E9] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {formError && <p className="text-xs text-[#DC2626] mt-3">{formError}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending || updateMutation.isPending}
            className="w-full btn-saffron py-3.5 mt-4 disabled:opacity-50"
          >
            {editingId !== null ? "Save Changes" : "Schedule Ride"}
          </button>
        </div>

        {/* Existing Schedules */}
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">My Scheduled Rides</h2>
          {isLoading ? (
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
              <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">Loading...</p>
            </div>
          ) : !schedules || schedules.length === 0 ? (
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
              <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">No scheduled rides yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => {
                const meta = STATUS_META[s.status as ScheduleStatus];
                const canEdit = s.status === "upcoming" || s.status === "active";
                return (
                  <div key={s.id} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
                          <Repeat className="w-5 h-5 text-[#FF6B00]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{s.label || "Scheduled Ride"}</p>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                            <Repeat className="w-3 h-3" />
                            {frequencyLabel[s.frequency as Frequency]}
                            {s.frequency === "weekly" && s.daysOfWeek && s.daysOfWeek.length > 0 &&
                              ` · ${s.daysOfWeek.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(", ")}`}
                            {s.frequency === "monthly" && ` · Day ${s.dayOfMonth}`}
                            {" · "}{s.scheduledTime}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] pl-1">
                      <MapPin className="w-3.5 h-3.5 text-[#138808] flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{s.pickupAddress}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] pl-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6B00] flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{s.dropAddress}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                      {canEdit && (
                        <button onClick={() => startEdit(s)} className="flex items-center gap-1 text-xs font-medium text-[#0EA5E9]">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      <button onClick={() => duplicateMutation.mutate({ id: s.id })} className="flex items-center gap-1 text-xs font-medium text-[#7C3AED]">
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </button>
                      {canEdit && (
                        <button onClick={() => cancelMutation.mutate({ id: s.id })} className="flex items-center gap-1 text-xs font-medium text-[#FF6B00]">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate({ id: s.id })} className="flex items-center gap-1 text-xs font-medium text-[#DC2626] ml-auto">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {pickerTarget && (
        <LocationPickerModal
          open
          title={pickerTarget === "pickup" ? "Set Pickup Location" : "Set Destination"}
          initialCoords={RANAGHAT_COORDS}
          onConfirm={({ address, lat, lng }) => {
            if (pickerTarget === "pickup") setForm((f) => ({ ...f, pickupAddress: address, pickupLat: lat, pickupLng: lng }));
            else setForm((f) => ({ ...f, dropAddress: address, dropLat: lat, dropLng: lng }));
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      <BottomNav role="user" />
    </div>
  );
}
