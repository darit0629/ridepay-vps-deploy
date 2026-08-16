import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { X, Route, Shapes, Search, Users, Car, Undo2, Check } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { attachAutocomplete } from "@/lib/googlePlaces";
import { trpc } from "@/providers/trpc";
import { SEVERITY_META, REASON_LABEL, type RestrictionSeverity, type RestrictionReason } from "./AdminRouteRestrictions";

const KOLKATA_CENTER = { lat: 22.69, lng: 88.37 };

interface LatLng {
  lat: number;
  lng: number;
}

interface Segment {
  roadName: string;
  geometry: LatLng[];
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminBlockRoute() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [restrictionType, setRestrictionType] = useState<"road" | "area">("road");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [areaGeometry, setAreaGeometry] = useState<LatLng[] | null>(null);
  const [pendingSegmentPath, setPendingSegmentPath] = useState<LatLng[] | null>(null);
  const [pendingRoadName, setPendingRoadName] = useState("");

  // Google's DrawingManager was removed from the Maps JS API (deprecated as
  // of v3.65 — the type itself is now an empty class with no methods), so
  // tracing a shape here is manual click-to-add-points instead: click the
  // map while `activeDraw` is set to append a vertex, "Finish" commits it.
  const [activeDraw, setActiveDraw] = useState<"road" | "area" | null>(null);
  const [drawPoints, setDrawPoints] = useState<LatLng[]>([]);

  const [name, setName] = useState("");
  const [reason, setReason] = useState<RestrictionReason>("construction");
  const [reasonNote, setReasonNote] = useState("");
  const [severity, setSeverity] = useState<RestrictionSeverity>("fully_blocked");
  const [startTime, setStartTime] = useState(() => toDatetimeLocal(new Date()));
  const [endTime, setEndTime] = useState(() => toDatetimeLocal(new Date(Date.now() + 4 * 60 * 60 * 1000)));
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [formError, setFormError] = useState("");

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const segmentShapesRef = useRef<google.maps.Polyline[]>([]);
  const areaShapeRef = useRef<google.maps.Polygon | null>(null);
  const drawPreviewRef = useRef<google.maps.Polyline | google.maps.Polygon | null>(null);
  const drawVertexMarkersRef = useRef<google.maps.Marker[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [mapReady, setMapReady] = useState(false);

  // Map created once on mount — classic 2D map, no vector/3D overlay needed.
  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;
    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;
        const gMap = new google.maps.Map(mapContainer.current, {
          center: KOLKATA_CENTER,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
        });
        map.current = gMap;
        setMapReady(true);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      segmentShapesRef.current.forEach((s) => s.setMap(null));
      areaShapeRef.current?.setMap(null);
      drawPreviewRef.current?.setMap(null);
      drawVertexMarkersRef.current.forEach((m) => m.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Road search — pans/zooms to the searched location only (Places
  // Autocomplete returns a point, not road-network geometry); the admin
  // still traces the actual segment by hand afterward.
  useEffect(() => {
    if (!mapReady || !searchInputRef.current) return;
    const autocomplete = attachAutocomplete(
      searchInputRef.current,
      (place) => {
        map.current?.panTo({ lat: place.lat, lng: place.lng });
        map.current?.setZoom(17);
      },
      KOLKATA_CENTER
    );
    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [mapReady]);

  // Click-to-add-points while a shape is being traced.
  useEffect(() => {
    if (!map.current || !activeDraw) return;
    const listener = map.current.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      setDrawPoints((prev) => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
    });
    return () => listener.remove();
  }, [activeDraw]);

  // Live preview of the shape currently being traced, plus small vertex dots.
  useEffect(() => {
    if (!map.current) return;
    drawPreviewRef.current?.setMap(null);
    drawVertexMarkersRef.current.forEach((m) => m.setMap(null));
    drawVertexMarkersRef.current = [];

    if (drawPoints.length === 0) {
      drawPreviewRef.current = null;
      return;
    }
    drawPreviewRef.current =
      activeDraw === "area"
        ? new google.maps.Polygon({ paths: drawPoints, map: map.current, fillColor: "#DC2626", fillOpacity: 0.25, strokeColor: "#DC2626", strokeWeight: 2 })
        : new google.maps.Polyline({ path: drawPoints, map: map.current, strokeColor: "#DC2626", strokeWeight: 4, strokeOpacity: 0.85 });
    drawVertexMarkersRef.current = drawPoints.map(
      (p) =>
        new google.maps.Marker({
          position: p,
          map: map.current!,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: "#DC2626", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        })
    );
  }, [drawPoints, activeDraw]);

  // Re-render persisted segments/area whenever they change, so removing a
  // chip also removes its line from the map.
  useEffect(() => {
    if (!map.current) return;
    segmentShapesRef.current.forEach((s) => s.setMap(null));
    segmentShapesRef.current = segments.map(
      (seg) => new google.maps.Polyline({ path: seg.geometry, map: map.current!, strokeColor: "#DC2626", strokeWeight: 4, strokeOpacity: 0.85 })
    );
  }, [segments, mapReady]);

  useEffect(() => {
    if (!map.current) return;
    areaShapeRef.current?.setMap(null);
    areaShapeRef.current = areaGeometry
      ? new google.maps.Polygon({ paths: areaGeometry, map: map.current, fillColor: "#DC2626", fillOpacity: 0.25, strokeColor: "#DC2626", strokeWeight: 2 })
      : null;
  }, [areaGeometry, mapReady]);

  const startDrawing = (mode: "road" | "area") => {
    setDrawPoints([]);
    setActiveDraw(mode);
  };

  const cancelDrawing = () => {
    setActiveDraw(null);
    setDrawPoints([]);
  };

  const undoLastPoint = () => setDrawPoints((prev) => prev.slice(0, -1));

  const finishDrawing = () => {
    if (activeDraw === "road" && drawPoints.length >= 2) {
      setPendingSegmentPath(drawPoints);
    } else if (activeDraw === "area" && drawPoints.length >= 3) {
      setAreaGeometry(drawPoints);
    }
    setActiveDraw(null);
    setDrawPoints([]);
  };

  const confirmPendingSegment = () => {
    if (!pendingSegmentPath || !pendingRoadName.trim()) return;
    setSegments((prev) => [...prev, { roadName: pendingRoadName.trim(), geometry: pendingSegmentPath }]);
    setPendingSegmentPath(null);
    setPendingRoadName("");
  };

  // Live affected-rides estimate, debounced 600ms so the admin isn't
  // triggering a Directions-backed check on every keystroke/draw.
  const [previewDraft, setPreviewDraft] = useState<{ severity: RestrictionSeverity; restrictionType: "road" | "area"; segments?: Segment[]; areaGeometry?: LatLng[] } | null>(null);
  useEffect(() => {
    const hasGeometry = restrictionType === "road" ? segments.length > 0 : !!areaGeometry;
    if (!hasGeometry) {
      setPreviewDraft(null);
      return;
    }
    const timer = setTimeout(() => {
      setPreviewDraft({
        severity,
        restrictionType,
        segments: restrictionType === "road" ? segments : undefined,
        areaGeometry: restrictionType === "area" ? (areaGeometry ?? undefined) : undefined,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [restrictionType, segments, areaGeometry, severity]);

  const { data: preview, isFetching: previewLoading } = trpc.routeRestriction.previewAffectedRides.useQuery(previewDraft!, {
    enabled: !!previewDraft,
  });

  const createMutation = trpc.routeRestriction.create.useMutation({
    onSuccess: () => {
      utils.routeRestriction.list.invalidate();
      navigate("/admin/route-restrictions");
    },
    onError: (error) => setFormError(error.message),
  });

  const removeSegment = (index: number) => setSegments((prev) => prev.filter((_, i) => i !== index));

  const suggestedName = restrictionType === "road" ? segments.map((s) => s.roadName).join(" + ") : name || "Area Restriction";

  const canSubmit =
    (name.trim() || suggestedName.trim()) &&
    (restrictionType === "road" ? segments.length >= 1 : (areaGeometry?.length ?? 0) >= 3) &&
    (isIndefinite || endTime);

  const handleSubmit = () => {
    setFormError("");
    if (!canSubmit) return;
    createMutation.mutate({
      name: (name.trim() || suggestedName).slice(0, 120),
      reason,
      reasonNote: reasonNote.trim() || undefined,
      severity,
      restrictionType,
      segments: restrictionType === "road" ? segments : undefined,
      areaGeometry: restrictionType === "area" ? (areaGeometry ?? undefined) : undefined,
      startTime: new Date(startTime),
      endTime: isIndefinite ? undefined : new Date(endTime),
      isIndefinite,
    });
  };

  return (
    <AdminLayout title="Block Route" subtitle="Search or draw the road/area to close, then set the closure details" backTo="/admin/route-restrictions" fullBleed>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Form panel */}
        <div className="w-full lg:w-[400px] flex-shrink-0 bg-white dark:bg-[#1E293B] border-r border-gray-100 dark:border-gray-800 overflow-y-auto p-4 space-y-4">
          {/* Shape type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRestrictionType("road")}
              disabled={!!activeDraw}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                restrictionType === "road" ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB]"
              }`}
            >
              <Route className="w-4 h-4" /> Road(s)
            </button>
            <button
              onClick={() => setRestrictionType("area")}
              disabled={!!activeDraw}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                restrictionType === "area" ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB]"
              }`}
            >
              <Shapes className="w-4 h-4" /> Area
            </button>
          </div>

          {restrictionType === "road" && !activeDraw && (
            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Search Road</label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="e.g. Jogpur Road, Ranaghat"
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <p className="text-[10px] text-[#9CA3AF] mt-1">Search to find the road, then trace it on the map.</p>
            </div>
          )}

          {/* Drawing controls */}
          {activeDraw ? (
            <div className="bg-[#FEE2E2] dark:bg-[#3A1414] rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-[#DC2626]">
                Click the map to add points ({drawPoints.length} so far{activeDraw === "road" ? ", need 2+" : ", need 3+"})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={undoLastPoint}
                  disabled={drawPoints.length === 0}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-40"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Undo
                </button>
                <button onClick={cancelDrawing} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#1E293B] text-[#6B7280] dark:text-[#9CA3AF]">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  onClick={finishDrawing}
                  disabled={activeDraw === "road" ? drawPoints.length < 2 : drawPoints.length < 3}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold bg-[#DC2626] text-white disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" /> Finish
                </button>
              </div>
            </div>
          ) : restrictionType === "road" ? (
            <button
              onClick={() => startDrawing("road")}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
            >
              <Route className="w-4 h-4" /> Trace Road on Map
            </button>
          ) : (
            <button
              onClick={() => startDrawing("area")}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
            >
              <Shapes className="w-4 h-4" /> {areaGeometry ? "Redraw Area" : "Draw Area on Map"}
            </button>
          )}

          {/* Segment chips — multi-road combination */}
          {restrictionType === "road" && segments.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5">Roads in this closure</p>
              <div className="flex flex-wrap gap-2">
                {segments.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-[#FEE2E2] text-[#DC2626] text-xs font-medium px-2.5 py-1.5 rounded-full">
                    {seg.roadName}
                    <button onClick={() => removeSegment(i)} aria-label={`Remove ${seg.roadName}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Reason / severity / schedule */}
          <div>
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName || "e.g. Jogpur Road Closure"}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
          </div>

          <div>
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as RestrictionReason)}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            >
              {(Object.entries(REASON_LABEL) as [RestrictionReason, string][]).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Note (optional)</label>
            <input
              type="text"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Extra detail for the audit log"
              maxLength={300}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
          </div>

          <div>
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Severity</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SEVERITY_META) as RestrictionSeverity[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSeverity(key)}
                  className="flex items-center justify-center py-2 rounded-lg text-xs font-semibold border-2 transition-colors"
                  style={{
                    color: severity === key ? SEVERITY_META[key].color : "#6B7280",
                    backgroundColor: severity === key ? SEVERITY_META[key].bg : "transparent",
                    borderColor: severity === key ? SEVERITY_META[key].color : "#E5E7EB",
                  }}
                >
                  {SEVERITY_META[key].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Start</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            <input type="checkbox" checked={isIndefinite} onChange={(e) => setIsIndefinite(e.target.checked)} />
            Block indefinitely (until manually unblocked)
          </label>

          {!isIndefinite && (
            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">End</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          )}

          {/* Affected-rides preview */}
          {previewDraft && (
            <div className="bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-xl p-3">
              {previewLoading && !preview ? (
                <p className="text-xs text-[#9CA3AF]">Checking affected rides…</p>
              ) : preview ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#FF6B00]" />
                    This restriction affects {preview.activeRideCount}
                    {preview.cappedAtLimit ? "+" : ""} active ride{preview.activeRideCount === 1 ? "" : "s"} and ~{preview.scheduledRideCount} scheduled ride
                    {preview.scheduledRideCount === 1 ? "" : "s"} nearby.
                  </p>
                  {preview.sampleRides.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {preview.sampleRides.map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          <Car className="w-3 h-3 flex-shrink-0" />
                          Ride #{r.id} · {r.riderName} {r.driverName ? `· ${r.driverName}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {formError && <p className="text-xs text-[#DC2626]">{formError}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending}
            className="w-full bg-[#DC2626] disabled:bg-[#9CA3AF] text-white font-semibold py-3 rounded-xl hover:bg-[#B91C1C] transition-colors"
          >
            {createMutation.isPending ? "Blocking…" : "Block This Route"}
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          {mapLoadError ? <MapUnavailable /> : <div ref={mapContainer} className="absolute inset-0" />}
        </div>
      </div>

      {/* Name-this-road prompt */}
      {pendingSegmentPath && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setPendingSegmentPath(null)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Name this road</h2>
            <input
              type="text"
              autoFocus
              value={pendingRoadName}
              onChange={(e) => setPendingRoadName(e.target.value)}
              placeholder="e.g. Jogpur Road"
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setPendingSegmentPath(null)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-medium py-2.5 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmPendingSegment}
                disabled={!pendingRoadName.trim()}
                className="flex-1 bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white text-sm font-medium py-2.5 rounded-xl"
              >
                Add Road
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
