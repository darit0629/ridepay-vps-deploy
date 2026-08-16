import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Users, Route, IndianRupee, Bus, Phone, UserCog, Check, X,
  MapPin, Pencil, Plus, Trash2, GraduationCap, CreditCard, ShieldCheck, Ban, RotateCcw,
  Upload, ImageIcon, CalendarDays, Clock3, Map as MapIcon,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import LocationPickerModal from "@/components/LocationPickerModal";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { attachAutocomplete } from "@/lib/googlePlaces";
import { trpc } from "@/providers/trpc";
import type { SubscriptionStatus } from "../../../api/school-router";

const DEFAULT_STOP_COORDS = { lat: 22.69, lng: 88.37 }; // Ranaghat, same fallback used elsewhere

const SUB_STATUS_LABEL: Record<SubscriptionStatus, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Pending Review", color: "#FF6B00", bg: "#FFF5EB" },
  reupload_requested: { label: "Re-upload Requested", color: "#DC2626", bg: "#FEE2E2" },
  approved: { label: "Approved", color: "#138808", bg: "#E8F5E8" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
  suspended: { label: "Suspended", color: "#6B7280", bg: "#F3F4F6" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

const selectCls = "bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]";

function SubscriptionVerificationQueue() {
  const utils = trpc.useUtils();
  const { data: subs } = trpc.school.listAllSubscriptions.useQuery(undefined, { refetchInterval: 8000, refetchIntervalInBackground: true });
  const { data: availableDrivers } = trpc.school.listAvailableDrivers.useQuery();
  const verifyMutation = trpc.school.verifySubscription.useMutation({ onSuccess: () => utils.school.listAllSubscriptions.invalidate() });
  const [assignError, setAssignError] = useState<string | null>(null);
  const assignMutation = trpc.school.assignDriver.useMutation({
    onSuccess: (result) => {
      utils.school.listAllSubscriptions.invalidate();
      if (!result.ok) {
        setAssignError(result.error);
        setTimeout(() => setAssignError(null), 4000);
      }
    },
  });
  const activateBackupMutation = trpc.school.activateBackupDriver.useMutation({
    onSuccess: (result) => {
      utils.school.listAllSubscriptions.invalidate();
      if (!result.ok) {
        setAssignError(result.error);
        setTimeout(() => setAssignError(null), 4000);
      }
    },
  });
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const pending = (subs ?? []).filter((s) => s.status === "pending_review");
  const others = (subs ?? []).filter((s) => s.status !== "pending_review");

  const act = (id: string, action: "approve" | "reject" | "reupload" | "suspend" | "reactivate") => {
    verifyMutation.mutate({ id, action, note: noteDraft[id]?.trim() || undefined });
  };

  const row = (sub: NonNullable<typeof subs>[number]) => {
    const badge = SUB_STATUS_LABEL[sub.status];
    return (
      <div key={sub.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-3">
          {sub.studentPhotoUrl ? (
            <img src={sub.studentPhotoUrl} alt={sub.studentName} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-[#FF6B00]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{sub.studentName}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">
              {sub.schoolName} · Class {sub.className}{sub.section ? sub.section : ""} · Guardian: {sub.guardianName}
            </p>
          </div>
          <span className="px-2 py-1 rounded-lg text-xs font-semibold flex-shrink-0" style={{ color: badge.color, backgroundColor: badge.bg }}>
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-[#6B7280] dark:text-[#9CA3AF]">
          {sub.studentIdPhotoUrl && (
            <a href={sub.studentIdPhotoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#0EA5E9] hover:underline">
              <ImageIcon className="w-3.5 h-3.5" /> Student ID
            </a>
          )}
          {sub.guardianPhotoUrl && (
            <a href={sub.guardianPhotoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#0EA5E9] hover:underline">
              <ImageIcon className="w-3.5 h-3.5" /> Guardian Photo
            </a>
          )}
          <span>Phone: {sub.guardianPhone}</span>
          <span>Emergency: {sub.emergencyContact}</span>
          <span className={sub.paymentStatus === "paid" ? "text-[#138808]" : "text-[#DC2626]"}>Payment: {sub.paymentStatus}</span>
        </div>

        {sub.status === "pending_review" && (
          <>
            <input
              value={noteDraft[sub.id] ?? ""}
              onChange={(e) => setNoteDraft((prev) => ({ ...prev, [sub.id]: e.target.value }))}
              placeholder="Note (required for reject / re-upload)"
              className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => act(sub.id, "approve")} className="flex items-center gap-1 bg-[#138808] text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => act(sub.id, "reupload")} className="flex items-center gap-1 bg-[#FF6B00] text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                <Upload className="w-3.5 h-3.5" /> Request Re-upload
              </button>
              <button onClick={() => act(sub.id, "reject")} className="flex items-center gap-1 bg-[#DC2626] text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </>
        )}

        {sub.status === "approved" && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={sub.assignedDriverName ?? ""}
              onChange={(e) => {
                const driver = (availableDrivers ?? []).find((d) => d.name === e.target.value);
                if (driver) assignMutation.mutate({ id: sub.id, driverId: driver.id, driverName: driver.name, vehicle: driver.vehicle });
              }}
              className={selectCls}
            >
              <option value="">Assign primary driver...</option>
              {(availableDrivers ?? []).map((d) => (
                <option key={d.name} value={d.name}>{d.name} · {d.vehicle}</option>
              ))}
            </select>
            <select
              value={sub.backupDriverName ?? ""}
              disabled={!sub.assignedDriverId}
              onChange={(e) => {
                if (!sub.assignedDriverId || !sub.assignedDriverName) return;
                const driver = (availableDrivers ?? []).find((d) => d.name === e.target.value);
                assignMutation.mutate({
                  id: sub.id,
                  driverId: sub.assignedDriverId,
                  driverName: sub.assignedDriverName,
                  vehicle: sub.assignedVehicle ?? "",
                  backup: driver ? { driverId: driver.id, driverName: driver.name, vehicle: driver.vehicle } : null,
                });
              }}
              className={`${selectCls} disabled:opacity-50`}
            >
              <option value="">No backup</option>
              {(availableDrivers ?? []).map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
            {sub.backupDriverName && (
              <button
                onClick={() => activateBackupMutation.mutate({ id: sub.id })}
                className="flex items-center gap-1 bg-[#0EA5E9] text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                <UserCog className="w-3.5 h-3.5" /> Activate Backup
              </button>
            )}
            <button onClick={() => act(sub.id, "suspend")} className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-semibold px-3 py-1.5 rounded-lg">
              <Ban className="w-3.5 h-3.5" /> Suspend
            </button>
          </div>
        )}

        {sub.status === "suspended" && (
          <button onClick={() => act(sub.id, "reactivate")} className="flex items-center gap-1 bg-[#138808] text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            <RotateCcw className="w-3.5 h-3.5" /> Reactivate
          </button>
        )}

        {sub.adminNote && sub.status !== "pending_review" && (
          <p className="text-xs text-[#9CA3AF] italic">Note: {sub.adminNote}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-[#138808]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">School Subscription Verification</h2>
        {pending.length > 0 && (
          <span className="bg-[#FF6B00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pending.length} pending</span>
        )}
      </div>
      {assignError && (
        <div className="flex items-center gap-2 bg-[#FEE2E2] text-[#DC2626] text-xs font-medium px-3 py-2 rounded-lg mb-3">
          <X className="w-3.5 h-3.5 flex-shrink-0" /> {assignError}
        </div>
      )}
      <div className="space-y-2">
        {[...pending, ...others].map(row)}
        {(subs ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No subscriptions yet.</p>}
      </div>
    </div>
  );
}

function SchoolPlansAndCalendar() {
  const utils = trpc.useUtils();
  const { data: plans } = trpc.school.listPlans.useQuery();
  const { data: calendarEvents } = trpc.school.listCalendarEvents.useQuery();
  const upsertPlanMutation = trpc.school.upsertPlan.useMutation({ onSuccess: () => utils.school.listPlans.invalidate() });
  const publishMutation = trpc.school.publishCalendarEvent.useMutation({ onSuccess: () => utils.school.listCalendarEvents.invalidate() });
  const removeEventMutation = trpc.school.removeCalendarEvent.useMutation({ onSuccess: () => utils.school.listCalendarEvents.invalidate() });

  const [newEventDate, setNewEventDate] = useState("");
  const [newEventType, setNewEventType] = useState<"holiday" | "exam" | "half_day" | "event" | "transport_closed">("holiday");
  const [newEventTitle, setNewEventTitle] = useState("");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-[#7C3AED]" />
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Subscription Plans</h2>
        </div>
        <div className="space-y-2">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2.5">
              <button
                onClick={() => upsertPlanMutation.mutate({ ...plan, active: !plan.active })}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors flex-shrink-0 ${plan.active ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${plan.active ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.name}</p>
                <p className="text-xs text-[#9CA3AF] truncate">{plan.description}</p>
              </div>
              <input
                type="number"
                value={plan.pricePerMonth}
                onChange={(e) => upsertPlanMutation.mutate({ ...plan, pricePerMonth: Number(e.target.value) })}
                className="w-20 bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-2">Changing a price creates a fresh Razorpay Plan for future subscribers — existing subscriptions keep billing at the price they signed up for.</p>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-[#0EA5E9]" />
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">School Calendar</h2>
        </div>
        <div className="flex gap-1.5 mb-2">
          <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          <select value={newEventType} onChange={(e) => setNewEventType(e.target.value as typeof newEventType)} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]">
            <option value="holiday">Holiday</option>
            <option value="exam">Exam</option>
            <option value="half_day">Half Day</option>
            <option value="event">Event</option>
            <option value="transport_closed">Transport Closed</option>
          </select>
        </div>
        <div className="flex gap-1.5 mb-3">
          <input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Title" className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          <button
            onClick={() => {
              if (!newEventDate || !newEventTitle.trim()) return;
              publishMutation.mutate({ date: newEventDate, type: newEventType, title: newEventTitle.trim() });
              setNewEventDate(""); setNewEventTitle("");
            }}
            className="bg-[#0EA5E9] text-white text-xs font-semibold px-3 rounded-lg flex-shrink-0"
          >
            Publish
          </button>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(calendarEvents ?? []).map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2.5 py-1.5">
              <Clock3 className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
              <span className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB] flex-1 truncate">{ev.date} — {ev.title}</span>
              <button onClick={() => removeEventMutation.mutate({ id: ev.id })}><Trash2 className="w-3 h-3 text-[#DC2626]" /></button>
            </div>
          ))}
          {(calendarEvents ?? []).length === 0 && <p className="text-xs text-[#9CA3AF] text-center py-2">No events published.</p>}
        </div>
      </div>
    </div>
  );
}

type RouteRow = { id: string; name: string; vehicleLabel: string; stops: string[]; primaryDriverId?: number; backupDriverId?: number; monthlyFee: number };

// Real replacement for the old mock initialRoutes array — CRUD against
// schoolRoutes. Only primary+backup driver pairs are supported (no
// arbitrary N-driver "flexible pool"), matching what the schema actually
// models — see the Dispatch Engine's deliberate scope decision against
// building full driver-pool automation for school routes.
function RoutesAndFleet() {
  const utils = trpc.useUtils();
  const { data: routes } = trpc.school.listRoutes.useQuery();
  const { data: availableDrivers } = trpc.school.listAvailableDrivers.useQuery();
  const upsertMutation = trpc.school.upsertRoute.useMutation({ onSuccess: () => utils.school.listRoutes.invalidate() });
  const removeMutation = trpc.school.removeRoute.useMutation({ onSuccess: () => utils.school.listRoutes.invalidate() });

  const [editRoute, setEditRoute] = useState<RouteRow | "new" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftVehicle, setDraftVehicle] = useState("");
  const [draftStops, setDraftStops] = useState<string[]>([]);
  const [draftPrimary, setDraftPrimary] = useState<number | "">("");
  const [draftBackup, setDraftBackup] = useState<number | "">("");
  const [draftFee, setDraftFee] = useState(0);
  const [newStop, setNewStop] = useState("");
  const [showStopMapPicker, setShowStopMapPicker] = useState(false);
  const newStopInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editRoute || !hasGoogleMapsKey) return;
    let disposed = false;
    loadGoogleMaps().then(() => {
      if (disposed || !newStopInputRef.current) return;
      attachAutocomplete(newStopInputRef.current, (place) => setNewStop(place.name), DEFAULT_STOP_COORDS);
    });
    return () => {
      disposed = true;
    };
  }, [editRoute]);

  const openNew = () => {
    setEditRoute("new");
    setDraftName(""); setDraftVehicle(""); setDraftStops([]); setDraftPrimary(""); setDraftBackup(""); setDraftFee(0); setNewStop("");
  };
  const openEdit = (route: RouteRow) => {
    setEditRoute(route);
    setDraftName(route.name); setDraftVehicle(route.vehicleLabel); setDraftStops(route.stops);
    setDraftPrimary(route.primaryDriverId ?? ""); setDraftBackup(route.backupDriverId ?? ""); setDraftFee(route.monthlyFee); setNewStop("");
  };
  const addStop = () => {
    if (!newStop.trim()) return;
    setDraftStops((prev) => [...prev, newStop.trim()]);
    setNewStop("");
  };
  const removeStop = (stop: string) => setDraftStops((prev) => prev.filter((s) => s !== stop));

  const saveRoute = () => {
    if (!draftName.trim()) return;
    upsertMutation.mutate({
      id: editRoute !== "new" ? editRoute?.id : undefined,
      name: draftName.trim(),
      vehicleLabel: draftVehicle.trim(),
      stops: draftStops,
      primaryDriverId: draftPrimary === "" ? undefined : draftPrimary,
      backupDriverId: draftBackup === "" ? undefined : draftBackup,
      monthlyFee: draftFee,
    });
    setEditRoute(null);
  };

  const driverName = (id?: number) => (availableDrivers ?? []).find((d) => d.id === id)?.name ?? "Unassigned";

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Routes</h2>
        <button onClick={openNew} className="flex items-center gap-1 text-xs font-semibold text-[#FF6B00]">
          <Plus className="w-3.5 h-3.5" /> Add Route
        </button>
      </div>
      <div className="space-y-2">
        {(routes ?? []).map((route) => (
          <div key={route.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E8EEF5] flex items-center justify-center flex-shrink-0">
                <Bus className="w-5 h-5 text-[#1E3A5F]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{route.name}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{route.vehicleLabel || "No vehicle set"}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => openEdit(route)} className="flex items-center gap-1 text-xs font-medium text-[#7C3AED]">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => removeMutation.mutate({ id: route.id })} aria-label="Remove route">
                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                </button>
              </div>
            </div>
            {route.stops.length > 0 && (
              <div className="flex items-start gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{route.stops.join(" → ")}</p>
              </div>
            )}
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              <span>Primary: {driverName(route.primaryDriverId)} · Backup: {driverName(route.backupDriverId)}</span>
              <span>Ref. fee ₹{route.monthlyFee}/mo</span>
            </div>
          </div>
        ))}
        {(routes ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No routes yet.</p>}
      </div>

      {editRoute && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditRoute(null)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl sm:rounded-3xl sm:my-8 p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{editRoute === "new" ? "Add Route" : "Edit Route"}</h2>
              <button onClick={() => setEditRoute(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Route Name</label>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Vehicle</label>
                <input
                  value={draftVehicle}
                  onChange={(e) => setDraftVehicle(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Primary Driver</label>
                  <select
                    value={draftPrimary}
                    onChange={(e) => setDraftPrimary(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    <option value="">Unassigned</option>
                    {(availableDrivers ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Backup Driver</label>
                  <select
                    value={draftBackup}
                    onChange={(e) => setDraftBackup(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    <option value="">None</option>
                    {(availableDrivers ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Reference Fee (not billed — actual billing is per child's plan)</label>
                <input
                  type="number"
                  value={draftFee}
                  onChange={(e) => setDraftFee(Number(e.target.value))}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Stops (pickup → drop locations)</label>
                <div className="space-y-1.5 mb-2">
                  {draftStops.map((stop, i) => (
                    <div key={stop + i} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                      <span className="flex-1 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{stop}</span>
                      <button onClick={() => removeStop(stop)}>
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    ref={newStopInputRef}
                    value={newStop}
                    onChange={(e) => setNewStop(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStop()}
                    placeholder="Search for a stop, or pick on map"
                    className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                  <button
                    onClick={() => setShowStopMapPicker(true)}
                    className="w-9 h-9 rounded-lg bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center flex-shrink-0"
                    aria-label="Pick stop location on map"
                  >
                    <MapIcon className="w-4 h-4 text-[#7C3AED]" />
                  </button>
                  <button onClick={addStop} className="w-9 h-9 rounded-lg bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-[#7C3AED]" />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={saveRoute}
              disabled={!draftName.trim() || upsertMutation.isPending}
              className="w-full bg-[#7C3AED] text-white font-semibold py-3.5 rounded-xl mt-4 hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
            >
              {upsertMutation.isPending ? "Saving…" : "Save Route"}
            </button>
          </div>
        </div>
      )}

      <LocationPickerModal
        open={showStopMapPicker}
        title="Pick Stop Location"
        initialCoords={DEFAULT_STOP_COORDS}
        onClose={() => setShowStopMapPicker(false)}
        onConfirm={({ address }) => {
          setDraftStops((prev) => [...prev, address]);
          setShowStopMapPicker(false);
        }}
      />
    </div>
  );
}

// Real replacement for the old mock "Student Management" + "Travel Groups"
// sections — both were really the same "which kids ride together" concept
// under two names; routeId is the one real grouping key that exists.
function StudentsByRoute() {
  const { data: subs } = trpc.school.listAllSubscriptions.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const { data: routes } = trpc.school.listRoutes.useQuery();

  const grouped = new Map<string, NonNullable<typeof subs>>();
  for (const sub of subs ?? []) {
    const key = sub.routeId ?? "unassigned";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(sub);
  }
  const routeName = (id: string) => (id === "unassigned" ? "Unassigned" : (routes ?? []).find((r) => r.id === id)?.name ?? "Unknown route");

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="w-4 h-4 text-[#7C3AED]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Students by Route</h2>
      </div>
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([routeId, groupSubs]) => (
          <div key={routeId} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
            <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">
              {routeName(routeId)} · {groupSubs.length} student{groupSubs.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-1.5">
              {groupSubs.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#7C3AED]">{sub.studentName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{sub.studentName}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">Class {sub.className}{sub.section} · Guardian: {sub.guardianName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      sub.paymentStatus === "paid" ? "text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22]" : "text-[#DC2626] bg-red-50 dark:bg-[#3A1A1A]"
                    }`}
                  >
                    {sub.paymentStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {(subs ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No students yet.</p>}
      </div>
    </div>
  );
}

export default function AdminSchoolTransport() {
  const navigate = useNavigate();

  const { data: allSubs } = trpc.school.listAllSubscriptions.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true });
  const { data: plans } = trpc.school.listPlans.useQuery();
  const { data: routes } = trpc.school.listRoutes.useQuery();
  const activeSubs = (allSubs ?? []).filter((s) => s.status === "approved");
  const pendingSubs = (allSubs ?? []).filter((s) => s.status === "pending_review");
  const unpaidRevenue = activeSubs
    .filter((s) => s.paymentStatus !== "paid")
    .reduce((sum, s) => sum + (plans?.find((p) => p.id === s.planId)?.pricePerMonth ?? 0), 0);

  return (
    <AdminLayout title="School Transport" subtitle="Subscriptions, Verification, Routes & Fleet">
      <div className="space-y-4">
        {/* Real stats, backed by school-router — no mock/hardcoded figures */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">Active Subscriptions</p>
            <p className="text-2xl font-bold text-[#138808]">{activeSubs.length}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">Pending Verification</p>
            <p className="text-2xl font-bold text-[#FF6B00]">{pendingSubs.length}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">Unpaid This Cycle</p>
            <p className="text-2xl font-bold text-[#DC2626]">₹{unpaidRevenue}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Route className="w-3.5 h-3.5 text-[#0EA5E9]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Routes</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{(routes ?? []).length}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-[#FF6B00]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Total Students</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{(allSubs ?? []).length}</p>
          </div>
        </div>

        <SubscriptionVerificationQueue />
        <SchoolPlansAndCalendar />
        <RoutesAndFleet />
        <StudentsByRoute />

        {/* Quick link to parent view */}
        <button
          onClick={() => activeSubs[0] && navigate(`/parent/tracking/${activeSubs[0].id}`)}
          disabled={activeSubs.length === 0}
          className="w-full flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow disabled:opacity-50"
        >
          <Phone className="w-5 h-5 text-[#7C3AED]" />
          <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
            {activeSubs.length === 0 ? "Preview Parent App View (no approved students yet)" : "Preview Parent App View"}
          </span>
        </button>

        <button
          onClick={() => navigate("/admin/school-billing")}
          className="w-full flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
        >
          <IndianRupee className="w-5 h-5 text-[#138808]" />
          <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Billing, Payments & Requests</span>
        </button>
      </div>
    </AdminLayout>
  );
}
