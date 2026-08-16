import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Construction, Clock, User, AlertTriangle, Users, History as HistoryIcon } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { trpc } from "@/providers/trpc";
import { SEVERITY_META, REASON_LABEL, restrictionStatus, type RestrictionSeverity, type RestrictionReason } from "./AdminRouteRestrictions";

const KOLKATA_CENTER = { lat: 22.69, lng: 88.37 };

function fmt(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  activated: "Activated",
  edited: "Edited",
  unblocked: "Unblocked",
  auto_expired: "Auto-expired",
  ride_rerouted: "Ride rerouted",
  no_alternative_route: "No alternative route found",
  scheduled_ride_delay_flagged: "Scheduled ride delay flagged",
};

export default function AdminRouteRestrictionDetail() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: restriction } = trpc.routeRestriction.getById.useQuery({ id: id! }, { enabled: !!id, refetchInterval: 10000 });
  const { data: events } = trpc.routeRestriction.events.useQuery({ restrictionId: id! }, { enabled: !!id, refetchInterval: 10000 });
  const { data: affectedRides } = trpc.routeRestriction.listAffectedRides.useQuery({ restrictionId: id! }, { enabled: !!id, refetchInterval: 10000 });

  const [showUnblockPrompt, setShowUnblockPrompt] = useState(false);
  const [unblockReason, setUnblockReason] = useState("");
  const unblockMutation = trpc.routeRestriction.unblock.useMutation({
    onSuccess: () => {
      utils.routeRestriction.getById.invalidate({ id: id! });
      utils.routeRestriction.events.invalidate({ restrictionId: id! });
      utils.routeRestriction.list.invalidate();
      setShowUnblockPrompt(false);
    },
  });

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current || !restriction) return;
    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;
        const bounds = new google.maps.LatLngBounds();
        const gMap = new google.maps.Map(mapContainer.current, {
          center: KOLKATA_CENTER,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
        });
        map.current = gMap;

        if (restriction.restrictionType === "road") {
          for (const seg of restriction.segments) {
            new google.maps.Polyline({ path: seg.geometry, map: gMap, strokeColor: "#DC2626", strokeWeight: 4, strokeOpacity: 0.85 });
            seg.geometry.forEach((p) => bounds.extend(p));
          }
        } else if (restriction.areaGeometry) {
          new google.maps.Polygon({ paths: restriction.areaGeometry, map: gMap, fillColor: "#DC2626", fillOpacity: 0.25, strokeColor: "#DC2626", strokeWeight: 2 });
          restriction.areaGeometry.forEach((p) => bounds.extend(p));
        }
        if (!bounds.isEmpty()) gMap.fitBounds(bounds, 60);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
    };
  }, [restriction]);

  if (!restriction) {
    return (
      <AdminLayout title="Route Restriction" backTo="/admin/route-restrictions">
        <p className="text-sm text-[#9CA3AF] text-center py-12">Loading…</p>
      </AdminLayout>
    );
  }

  const severity = SEVERITY_META[restriction.severity as RestrictionSeverity] ?? SEVERITY_META.advisory;
  const status = restrictionStatus(restriction);
  const scheduleImpactEvents = (events ?? []).filter((e) => e.eventType === "scheduled_ride_delay_flagged");

  return (
    <AdminLayout title={restriction.name} subtitle={REASON_LABEL[restriction.reason as RestrictionReason] ?? restriction.reason} backTo="/admin/route-restrictions" fullBleed>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[420px] flex-shrink-0 bg-white dark:bg-[#1E293B] border-r border-gray-100 dark:border-gray-800 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ color: severity.color, backgroundColor: severity.bg }}>
              {severity.label}
            </span>
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                color: status === "active" ? "#DC2626" : status === "scheduled" ? "#0EA5E9" : "#6B7280",
                backgroundColor: status === "active" ? "#FEE2E2" : status === "scheduled" ? "#E0F2FE" : "#F3F4F6",
              }}
            >
              {status === "active" ? "Active" : status === "scheduled" ? "Scheduled" : "Expired"}
            </span>
          </div>

          {restriction.reasonNote && <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{restriction.reasonNote}</p>}

          <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              Start: {fmt(restriction.startTime)}
            </div>
            <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {restriction.isIndefinite ? "Indefinite — until manually unblocked" : `End: ${fmt(restriction.endTime)}`}
            </div>
            {restriction.unblockedAt && (
              <div className="flex items-center gap-2 text-[#DC2626]">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                Unblocked {fmt(restriction.unblockedAt)}
                {restriction.unblockReason ? ` — ${restriction.unblockReason}` : ""}
              </div>
            )}
          </div>

          {restriction.restrictionType === "road" && restriction.segments.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5">Roads blocked</p>
              <div className="flex flex-wrap gap-2">
                {restriction.segments.map((s, i) => (
                  <span key={i} className="bg-[#FEE2E2] text-[#DC2626] text-xs font-medium px-2.5 py-1.5 rounded-full">
                    {s.roadName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {status === "active" && (
            <button
              onClick={() => setShowUnblockPrompt(true)}
              className="w-full bg-[#138808] text-white font-semibold py-2.5 rounded-xl hover:bg-[#0F6E06] transition-colors"
            >
              Unblock Now
            </button>
          )}

          {/* Scheduled Ride Impact */}
          {scheduleImpactEvents.length > 0 && (
            <div className="bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-xl p-3">
              <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#FF6B00]" /> Scheduled Ride Impact
              </h3>
              <div className="space-y-1.5">
                {scheduleImpactEvents.map((e) => (
                  <p key={e.id} className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    {e.detail}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Affected rides drill-down */}
          <div>
            <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#DC2626]" /> Affected Rides ({(affectedRides ?? []).length})
            </h3>
            {(affectedRides ?? []).length === 0 ? (
              <p className="text-xs text-[#9CA3AF] py-2">No rides affected yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(affectedRides ?? []).map((r) => (
                  <div key={r.eventId} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg p-2.5 text-xs">
                    <p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                      Ride #{r.rideId} — {EVENT_LABEL[r.eventType] ?? r.eventType}
                    </p>
                    <p className="text-[#6B7280] dark:text-[#9CA3AF]">
                      {r.riderName ?? "Rider"} {r.driverName ? `· ${r.driverName}` : ""} · {fmt(r.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit history */}
          <div>
            <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mb-2 flex items-center gap-1.5">
              <HistoryIcon className="w-4 h-4 text-[#6B7280]" /> History
            </h3>
            <div className="space-y-1.5">
              {(events ?? []).map((e) => (
                <div key={e.id} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg p-2.5 text-xs">
                  <p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                    {EVENT_LABEL[e.eventType] ?? e.eventType} <span className="text-[#9CA3AF] font-normal">· {e.actor}</span>
                  </p>
                  {e.detail && <p className="text-[#6B7280] dark:text-[#9CA3AF]">{e.detail}</p>}
                  <p className="text-[#9CA3AF]">{fmt(new Date(e.createdAt).getTime())}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 relative min-h-[300px]">
          {mapLoadError ? <MapUnavailable /> : <div ref={mapContainer} className="absolute inset-0" />}
        </div>
      </div>

      {showUnblockPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowUnblockPrompt(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1 flex items-center gap-2">
              <Construction className="w-5 h-5 text-[#138808]" /> Unblock this road?
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">Routing will immediately stop avoiding it.</p>
            <input
              type="text"
              autoFocus
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder="Reason (e.g. road reopened)"
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#138808] text-[#1A1A2E] dark:text-[#E5E7EB] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowUnblockPrompt(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-medium py-2.5 rounded-xl">
                Cancel
              </button>
              <button
                onClick={() => unblockMutation.mutate({ id: restriction.id, reason: unblockReason.trim() || undefined })}
                disabled={unblockMutation.isPending}
                className="flex-1 bg-[#138808] text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
              >
                {unblockMutation.isPending ? "Unblocking…" : "Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
