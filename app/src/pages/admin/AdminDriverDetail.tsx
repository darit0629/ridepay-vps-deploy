import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Phone, Mail, Car, FileText, IndianRupee, Clock, Smartphone, Banknote,
  ChevronDown, ShieldBan, ShieldCheck, Check, X, MapPin,
  Landmark, ClipboardList, CheckCircle2, XCircle, HourglassIcon,
} from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import MapUnavailable from "@/components/MapUnavailable";
import AdminLayout from "@/components/admin/AdminLayout";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";
import { useNotifications } from "@/contexts/NotificationsContext";
import { trpc } from "@/providers/trpc";
import { requiredDocumentsFor, DOCUMENT_LABELS, VEHICLE_TYPES, type VehicleTypeId } from "@/pages/driver/onboarding/onboardingTypes";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "Approved", color: "#138808", bg: "#E8F5E8" },
  pending: { label: "Pending", color: "#FF6B00", bg: "#FFF5EB" },
  blocked: { label: "Blocked", color: "#DC2626", bg: "#FEE2E2" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
};

interface TripEntry {
  paymentId: number;
  rideId: number;
  pickupAddress: string;
  dropAddress: string;
  pickupLat: string;
  pickupLng: string;
  dropLat: string;
  dropLng: string;
  amount: number;
  method: string;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminDriverDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const driverId = Number(id);
  const { pushSystemNotification } = useNotifications();
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.getDriverDetail.useQuery(
    { driverId },
    { enabled: Number.isFinite(driverId) && driverId > 0 }
  );
  const blockMutation = trpc.admin.blockDriver.useMutation({ onSuccess: () => utils.admin.getDriverDetail.invalidate({ driverId }) });
  const approveMutation = trpc.admin.approveDriver.useMutation({ onSuccess: () => utils.admin.getDriverDetail.invalidate({ driverId }) });
  const rejectMutation = trpc.admin.rejectDriver.useMutation({ onSuccess: () => utils.admin.getDriverDetail.invalidate({ driverId }) });

  if (!isLoading && !data) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-4">Driver not found</p>
        <button onClick={() => navigate("/admin/drivers")} className="btn-saffron px-6 py-2.5">
          Back to Drivers
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading driver…</p>
      </div>
    );
  }

  const { profile, user, trips, totalEarnings, cashTotal, onlineTotal } = data;
  const config = STATUS_CONFIG[profile.status] ?? STATUS_CONFIG.pending;
  const paymentTotal = onlineTotal + cashTotal;
  const onlinePercent = paymentTotal > 0 ? Math.round((onlineTotal / paymentTotal) * 100) : 0;
  const name = user?.name || "Unnamed";

  const handleBlock = () => {
    blockMutation.mutate({ driverId });
    pushSystemNotification({
      audience: "driver",
      title: "Account blocked",
      message: "Your Ridepay driver account has been blocked by the admin team. Contact support for details.",
    });
  };

  const handleUnblock = () => {
    approveMutation.mutate({ driverId });
    pushSystemNotification({
      audience: "driver",
      title: "Account unblocked",
      message: "Your Ridepay driver account has been unblocked. You can go online and accept rides again.",
    });
  };

  const handleApprove = () => {
    approveMutation.mutate({ driverId });
    pushSystemNotification({
      audience: "driver",
      title: "You're approved! 🎉",
      message: "Your Ridepay driver account has been approved. You're ready to go online and start earning.",
    });
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate({ driverId, reason: rejectReason.trim() });
    pushSystemNotification({
      audience: "driver",
      title: "Registration needs a fix",
      message: `Your driver registration was rejected: ${rejectReason.trim()}`,
    });
    setShowRejectModal(false);
    setRejectReason("");
  };

  return (
    <AdminLayout title="Driver Profile" backTo="/admin/drivers">
      <div className="max-w-2xl space-y-4">
        {/* Identity Card */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-[#FF6B00]">{name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{name}</h2>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{profile.vehicleModel || profile.vehicleType} · {profile.vehicleNumber}</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: config.color, backgroundColor: config.bg }}>
              {config.label}
            </span>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-gray-50 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{user?.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Car className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.vehicleModel || profile.vehicleType} · {profile.vehicleNumber || "—"}</span>
            </div>
          </div>

          {profile.status === "pending" && profile.onboardingSubmittedAt ? (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] text-sm font-medium hover:bg-[#D1EBD1] dark:hover:bg-[#204020] transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 dark:bg-[#3D1414] text-[#DC2626] text-sm font-medium hover:bg-red-100 dark:hover:bg-[#4D1A1A] transition-colors"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          ) : profile.status === "pending" ? (
            <div className="flex items-center gap-2 mt-4 py-2.5 px-3 rounded-xl bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00] text-sm font-medium">
              <HourglassIcon className="w-4 h-4 flex-shrink-0" /> Still completing onboarding
            </div>
          ) : profile.status === "rejected" ? (
            <div className="mt-4 space-y-2">
              {profile.rejectionReason && (
                <p className="text-xs text-[#DC2626] bg-red-50 dark:bg-[#3D1414] rounded-xl p-3">
                  <span className="font-semibold">Reason: </span>{profile.rejectionReason}
                </p>
              )}
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] text-sm font-medium hover:bg-[#D1EBD1] dark:hover:bg-[#204020] transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Approve Anyway
              </button>
            </div>
          ) : profile.status !== "blocked" ? (
            <button
              onClick={handleBlock}
              disabled={blockMutation.isPending}
              className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-xl bg-red-50 dark:bg-[#3D1414] text-[#DC2626] text-sm font-medium hover:bg-red-100 dark:hover:bg-[#4D1A1A] transition-colors disabled:opacity-50"
            >
              <ShieldBan className="w-4 h-4" /> Block Driver
            </button>
          ) : (
            <button
              onClick={handleUnblock}
              disabled={approveMutation.isPending}
              className="w-full flex items-center justify-center gap-2 mt-4 py-2.5 rounded-xl bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] text-sm font-medium hover:bg-[#D1EBD1] dark:hover:bg-[#204020] transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" /> Unblock Driver
            </button>
          )}
        </div>

        {/* Onboarding Status */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-[#0EA5E9]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Onboarding Status</h3>
          </div>
          <div className="space-y-2">
            {(() => {
              const vt = VEHICLE_TYPES.includes(profile.vehicleType as VehicleTypeId) ? (profile.vehicleType as VehicleTypeId) : "";
              const personalDone = !!(user?.name && user?.dob && user?.gender && profile.emergencyContact);
              const vehicleDone = !!(profile.vehicleType && profile.vehicleNumber);
              const docsDone = requiredDocumentsFor(vt).every((k) => !!profile.documents?.[k]);
              const items: { label: string; done: boolean }[] = [
                { label: "Mobile Verified", done: true },
                { label: "Personal Details Completed", done: personalDone },
                { label: "Vehicle Added", done: vehicleDone },
                { label: "Documents Uploaded", done: docsDone },
                { label: "Bank Verified", done: profile.bankVerified },
              ];
              return items.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#9CA3AF]">{item.label}</span>
                  {item.done ? (
                    <span className="flex items-center gap-1 text-[#138808] font-medium"><CheckCircle2 className="w-4 h-4" /> Done</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[#9CA3AF] font-medium"><XCircle className="w-4 h-4" /> Pending</span>
                  )}
                </div>
              ));
            })()}
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-50 dark:border-gray-700">
              <span className="text-[#6B7280] dark:text-[#9CA3AF]">Application Status</span>
              <span className="font-semibold" style={{ color: config.color }}>
                {profile.status === "pending" && !profile.onboardingSubmittedAt ? "In Progress" : config.label}
              </span>
            </div>
          </div>
        </div>

        {/* Address */}
        {profile.address && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#DC2626]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Address</h3>
            </div>
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
              {profile.address}{profile.landmark ? `, near ${profile.landmark}` : ""}
            </p>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{[profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}</p>
          </div>
        )}

        {/* Bank Details */}
        {profile.bankAccountNumber && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="w-4 h-4 text-[#7C3AED]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Bank Details</h3>
              {profile.bankVerified && (
                <span className="ml-auto flex items-center gap-1 text-xs font-medium text-[#138808]"><ShieldCheck className="w-3.5 h-3.5" /> Verified</span>
              )}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280] dark:text-[#9CA3AF]">Account Holder</span><span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.bankAccountHolderName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280] dark:text-[#9CA3AF]">Bank</span><span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.bankName || "—"}{profile.bankBranchName ? ` · ${profile.bankBranchName}` : ""}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280] dark:text-[#9CA3AF]">Account No.</span><span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.bankAccountNumber.replace(/.(?=.{4})/g, "•")}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280] dark:text-[#9CA3AF]">IFSC</span><span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.bankIfscCode || "—"}</span></div>
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Documents</h3>
          </div>
          <div className="space-y-2">
            {(() => {
              const vt = VEHICLE_TYPES.includes(profile.vehicleType as VehicleTypeId) ? (profile.vehicleType as VehicleTypeId) : "";
              const keys = requiredDocumentsFor(vt);
              return keys.map((key) => {
                // Uploaded as a base64 data: URI (no object storage in this
                // prototype) — shown as a thumbnail rather than an
                // open-in-new-tab link, since browsers commonly block
                // top-level navigation to data: URIs.
                const url = profile.documents?.[key];
                return (
                  <div key={key} className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                    {url && <img src={url} alt={DOCUMENT_LABELS[key]} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{DOCUMENT_LABELS[key]}</p>
                    </div>
                    {url ? (
                      <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 text-[#138808] bg-[#E8F5E8]">
                        <Check className="w-3 h-3" /> Uploaded
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 text-[#DC2626] bg-red-50">
                        Not submitted
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Preferences */}
        {profile.serviceType && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-[#FF6B00]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Ride Preferences</h3>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-[#9CA3AF]">Service</span>
                <span className="text-[#1A1A2E] dark:text-[#E5E7EB] capitalize">{profile.serviceType === "both" ? "Ride + Parcel" : `${profile.serviceType} only`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280] dark:text-[#9CA3AF]">Availability</span>
                <span className="text-[#1A1A2E] dark:text-[#E5E7EB] capitalize">{profile.availability}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0">Operating Areas</span>
                <span className="text-[#1A1A2E] dark:text-[#E5E7EB] text-right">{(profile.operatingAreas ?? []).join(", ") || "—"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Earnings & Payment Breakdown */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-[#138808]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Earnings & Payments</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-xs text-[#9CA3AF] mb-1">Total Earnings (last 20 rides)</p>
              <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{totalEarnings.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-xs text-[#9CA3AF] mb-1">Total Rides</p>
              <p className="text-lg font-bold text-[#138808]">{profile.totalRides}</p>
            </div>
          </div>

          {paymentTotal > 0 && (
            <>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Payment Method Breakdown (recent trips)</p>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex mb-2">
                <div className="h-full bg-[#0EA5E9]" style={{ width: `${onlinePercent}%` }} />
                <div className="h-full bg-[#FF6B00]" style={{ width: `${100 - onlinePercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[#0EA5E9]"><Smartphone className="w-3.5 h-3.5" /> Online ₹{onlineTotal} ({onlinePercent}%)</span>
                <span className="flex items-center gap-1.5 text-[#FF6B00]"><Banknote className="w-3.5 h-3.5" /> Cash ₹{cashTotal} ({100 - onlinePercent}%)</span>
              </div>
            </>
          )}
        </div>

        {/* Trip History */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#FF6B00]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Trip History</h3>
          </div>
          {trips.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">No trips yet</p>
          ) : (
            <div className="space-y-2">
              {trips.map((trip) => (
                <TripRow
                  key={trip.paymentId}
                  trip={trip}
                  expanded={expandedTrip === trip.paymentId}
                  onToggle={() => setExpandedTrip(expandedTrip === trip.paymentId ? null : trip.paymentId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Reject Registration</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-3">Tell the driver what needs to be fixed.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Driving license photo is blurry — please re-upload"
              rows={3}
              autoFocus
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#DC2626] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-[#DC2626] text-white font-semibold py-2.5 rounded-xl hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function TripRow({ trip, expanded, onToggle }: { trip: TripEntry; expanded: boolean; onToggle: () => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, false);

  const pickup = { lat: parseFloat(trip.pickupLat), lng: parseFloat(trip.pickupLng) };
  const dropoff = { lat: parseFloat(trip.dropLat), lng: parseFloat(trip.dropLng) };

  useEffect(() => {
    if (!expanded || !hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(async () => {
        if (disposed || !mapContainer.current) return;
        const gMap = new google.maps.Map(mapContainer.current, {
          center: pickup,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;
        new google.maps.Marker({ position: pickup, map: gMap, label: "A" });
        new google.maps.Marker({ position: dropoff, map: gMap, label: "B" });

        const fallbackBounds = new google.maps.LatLngBounds();
        fallbackBounds.extend(pickup);
        fallbackBounds.extend(dropoff);
        gMap.fitBounds(fallbackBounds, 40);

        // A route-fetch failure (e.g. Directions API billing not enabled) shouldn't
        // hide the map itself — just skip the polyline and keep the two markers.
        try {
          const route = await fetchGoogleRoute(pickup, dropoff);
          if (disposed) return;
          if (route) {
            new google.maps.Polyline({
              path: route.path,
              strokeColor: "#FF6B00",
              strokeWeight: 4,
              map: gMap,
            });
            gMap.fitBounds(route.bounds, 40);
          }
        } catch (routeError) {
          console.error("Error fetching route for trip map:", routeError);
        }
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, trip.paymentId]);

  return (
    <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl overflow-hidden">
      <div role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()} className="flex items-center gap-3 p-3 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">#{trip.rideId}</p>
            <span className="text-[10px] text-[#9CA3AF]">{formatDate(trip.createdAt)}</span>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{trip.pickupAddress} → {trip.dropAddress}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{trip.amount}</p>
          <p className={`text-[10px] flex items-center justify-end gap-0.5 capitalize ${trip.method === "cash" ? "text-[#FF6B00]" : "text-[#0EA5E9]"}`}>
            {trip.method === "cash" ? <Banknote className="w-2.5 h-2.5" /> : <Smartphone className="w-2.5 h-2.5" />}
            {trip.method}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>
      {expanded && (
        <div className="relative h-40 mx-3 mb-3 rounded-lg overflow-hidden">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}
        </div>
      )}
    </div>
  );
}
