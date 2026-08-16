import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import {
  Bell, Navigation, X, Car, Clock, CalendarClock, Sparkles, Mic,
  ChevronRight, ChevronDown, GraduationCap, ShieldAlert, Zap,
  Users, Building2, Package, PackageCheck, Truck, Phone, MessageCircle, CheckCircle2,
  Moon, Sun, Wallet, Crown, Cloud, Cross, Shield, ParkingCircle,
  BatteryCharging, History, Megaphone, MapPin, Eye, Gift, Star, Plus, QrCode, ShieldCheck, Minus,
  Share2, IndianRupee, Smartphone, KeyRound, Search, Tag, Compass, Home, Briefcase, Pencil,
  Check, Heart, FileText, Headset,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import RouteRestrictionBanner from "@/components/RouteRestrictionBanner";
import Vehicle3DPreview from "@/components/Vehicle3DPreview";
import MapViewToggle from "@/components/MapViewToggle";
import MapUnavailable from "@/components/MapUnavailable";
import ServiceModeToggle, { type ServiceMode } from "@/components/ServiceModeToggle";
import FloatingAiChat from "@/components/FloatingAiChat";
import { useGoogleMapViewToggle } from "@/hooks/useGoogleMapViewToggle";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { useRickshawFleetOverlay } from "@/hooks/useRickshawFleetOverlay";
import { useWeather } from "@/hooks/useWeather";
import type { VehicleModelType } from "@/lib/vehicleModels3D";
import {
  createCurrentLocationIcon, createDestinationIcon, createVehicleIcon, createPoiIcon, createCourierIcon,
  createDriverIcon, createNavigationVehicleIcon, categorizeGoogleTypes, poiEmoji,
  type VehicleStatus,
} from "@/lib/googleMarkerIcons";
import { attachAutocomplete, fetchNearbyPlaces, searchPlacesNearby, type NearbyPlace, type PlaceSearchResult } from "@/lib/googlePlaces";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import { fetchSafeRoute } from "@/hooks/useSafeRoute";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import jsPDF from "jspdf";
import { predictFare, type FarePrediction } from "@/lib/aiFarePrediction";
import { isVoiceBookingSupported, listenOnce, type VoiceLanguage } from "@/lib/voiceBooking";
import { estimateParcelDelivery, type ParcelEstimate } from "@/lib/mockParcels";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import QRCode from "qrcode";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import type { AdCampaign } from "@/lib/mockAdCampaigns";
import { useSubscriptionPlans } from "@/contexts/SubscriptionPlansContext";
import { useHomeContent } from "@/contexts/HomeContentContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useFareConfig } from "@/contexts/FareConfigContext";
import { resolveHeading } from "@/lib/heading";
import { deriveFareVehicleId } from "@/lib/fareVehicleMapping";
import type { FareVehicleTypeId } from "@/contexts/FareConfigContext";
import { animateAlongPath, type PathAnimationHandle } from "@/lib/animatePath";
import type { PromoSlide, PromoSlideIcon, NearbyServiceIcon, RideTypeId, QuickTileId } from "@/lib/mockHomeContent";

const DEFAULT_COORDS: google.maps.LatLngLiteral = { lat: 22.69, lng: 88.37 }; // Ranaghat

const AI_DESTINATION_SUGGESTIONS = ["Home", "Office", "Railway Station", "Hospital", "Market"];
// Display-only translations — the underlying English value is still what's
// geocoded (handleAiSuggestion builds "{label} near {pickup}") and looked up
// in AI_SUGGESTION_TO_SAVED_NAME, so only the chip's rendered text is localized.
const AI_DESTINATION_SUGGESTION_KEYS: Record<string, string> = {
  Home: "places.home",
  Office: "home.office",
  "Railway Station": "dashboard.railwayStation",
  Hospital: "dashboard.hospital",
  Market: "dashboard.market",
};

const CANCEL_REASONS = [
  "Captain is taking too long",
  "Wrong pickup location",
  "Change of plans",
  "Booked by mistake",
  "Found another ride",
  "Price too high",
];
const OTHER_CANCEL_REASON = "Other";
// Display-only translations for CANCEL_REASONS — the reason itself is still
// recorded server-side in English (recordCancellationMutation), so only the
// label shown to the rider is localized, not the underlying value.
const CANCEL_REASON_KEYS: Record<string, string> = {
  "Captain is taking too long": "home.cancelReasonTakingTooLong",
  "Wrong pickup location": "home.cancelReasonWrongPickup",
  "Change of plans": "home.cancelReasonChangeOfPlans",
  "Booked by mistake": "home.cancelReasonBookedByMistake",
  "Found another ride": "home.cancelReasonFoundAnotherRide",
  "Price too high": "home.cancelReasonPriceTooHigh",
  Other: "home.cancelReasonOther",
};
const TIP_PRESETS = [10, 20, 50];

// Selectable ride options shown on the fare screen, each priced off the same
// base fare so riders can compare and pick before confirming.
const RIDE_OPTIONS = [
  { id: "share" as const, labelKey: "home.rideOptionShare", subtitleKey: "home.rideOptionShareSubtitle", perSeat: true },
  { id: "reserve" as const, labelKey: "home.rideOptionReserve", subtitleKey: "home.rideOptionReserveSubtitle", perSeat: false },
  { id: "auto" as const, labelKey: "home.rideOptionAuto", subtitleKey: "home.rideOptionAutoSubtitle", perSeat: false },
];

// Deterministic "nearest driver" ETA per ride option — there's no real
// per-vehicle-type driver-distance feed yet, so this derives a stable 2-5 min
// figure from the option + pickup text instead of a real query. Pure (no
// Math.random) so it's safe to call straight from render.
function pseudoPickupEtaMin(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 2 + (hash % 4);
}

const PACKAGE_SIZES = [
  { id: "small", labelKey: "home.sizeSmall", subtitleKey: "home.sizeSmallSubtitle", weightKg: "1" },
  { id: "medium", labelKey: "home.sizeMedium", subtitleKey: "home.sizeMediumSubtitle", weightKg: "3" },
  { id: "large", labelKey: "home.sizeLarge", subtitleKey: "home.sizeLargeSubtitle", weightKg: "6" },
] as const;

// Mirrors the server's ParcelStage union (app/api/parcel-router.ts) — kept as
// a display-only label list here since the client never needs the type, only tRPC's inferred data.
const PARCEL_STAGE_FLOW: { id: "assigned" | "picked_up" | "arrived" | "delivered"; labelKey: string }[] = [
  { id: "assigned", labelKey: "home.stageCourierAssigned" },
  { id: "picked_up", labelKey: "home.stagePickedUp" },
  { id: "arrived", labelKey: "home.stageArrived" },
  { id: "delivered", labelKey: "home.stageDelivered" },
];

// Trip progress stepper shown on the matched/in_ride driver card.
const TRIP_TIMELINE_STEPS = ["Confirmed", "On the way", "Arrived", "Trip Started", "Completed"] as const;
const TRIP_TIMELINE_STEP_KEYS: Record<(typeof TRIP_TIMELINE_STEPS)[number], string> = {
  Confirmed: "home.timelineConfirmed",
  "On the way": "home.timelineOnTheWay",
  Arrived: "home.timelineArrived",
  "Trip Started": "home.timelineTripStarted",
  Completed: "home.timelineCompleted",
};

// Simulated status per nearby-vehicle marker (index-aligned with the 4 synthetic positions below).
const VEHICLE_STATUSES: VehicleStatus[] = ["available", "premium", "busy", "available"];

// Index-aligned with VEHICLE_STATUSES/vehiclePositions — gives the ambient
// "nearby drivers" fleet real vehicle variety instead of four identical rickshaws.
const NEARBY_VEHICLE_MODELS: VehicleModelType[] = ["e-riksha", "car", "auto-rickshaw", "bike"];
// Swapped in instead of the above whenever Parcel mode is active, so nearby
// courier-capable vehicles read as delivery vehicles rather than passenger rides.
const NEARBY_PARCEL_VEHICLE_MODELS: VehicleModelType[] = ["bike-parcel", "bike-parcel", "e-riksha-parcel", "bike-parcel"];

type RideFlowStage = "idle" | "searching" | "matched" | "in_ride" | "completed";

// A google.maps.OverlayView keeps a plain <div> pinned to a LatLng's actual
// on-screen pixel position, re-projecting it on every map pan/zoom (Google
// calls draw() automatically) — this is what lets the "current location"
// pill float directly above the real pickup pin instead of sitting at a
// fixed spot on the screen. The div itself is a portal target; React still
// owns and renders the pill's actual content into it.
interface PickupPillOverlay extends google.maps.OverlayView {
  setPosition(position: google.maps.LatLngLiteral): void;
  getDiv(): HTMLDivElement;
}

// Icon lookups for admin-configurable content (icons are chosen from a fixed
// palette in the admin UI and stored as string keys, since components can't be persisted as data).
const PROMO_ICON_MAP: Record<PromoSlideIcon, typeof Crown> = {
  Crown, GraduationCap, Package, Users, Sparkles, Megaphone, Gift, Car,
};
const NEARBY_ICON_MAP: Record<NearbyServiceIcon, typeof Cross> = {
  Cross, Shield, ParkingCircle, BatteryCharging, MapPin, Star,
};

export default function UserHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const customerName = user?.name ?? "";
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupPillOverlayRef = useRef<PickupPillOverlay | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const poiClusterRef = useRef<MarkerClusterer | null>(null);
  const poiInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const poiLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const pickupAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const pickupAutocompletePacElRef = useRef<HTMLElement | null>(null);
  const destinationSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchSeqRef = useRef(0);

  const [pickupPillContainer, setPickupPillContainer] = useState<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const rickshawFleet = useRickshawFleetOverlay(mapInstance);
  const [pickup, setPickup] = useState("Station Road, Ranaghat");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral>(DEFAULT_COORDS);
  const [destinationCoords, setDestinationCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [isEditingPickup, setIsEditingPickup] = useState(false);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [destinationSearchResults, setDestinationSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [showFareSheet, setShowFareSheet] = useState(false);
  const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0 });
  const [farePrediction, setFarePrediction] = useState<FarePrediction | null>(null);

  // Ride-flow state machine: booking now happens entirely inline in the bottom
  // sheet instead of navigating to separate booking/searching/active-ride pages.
  const [rideFlowStage, setRideFlowStage] = useState<RideFlowStage>("idle");
  const [confirmedFare, setConfirmedFare] = useState(0);
  const [driverEtaMin, setDriverEtaMin] = useState(4);
  const [driverDistanceKm, setDriverDistanceKm] = useState(2.4);
  const [seats, setSeats] = useState(1);
  const [womenOnly, setWomenOnly] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [nightSafeMode, setNightSafeMode] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "upi" | "wallet">("cash");
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null);
  const [customCancelReason, setCustomCancelReason] = useState("");
  // The vehicle actually booked (captured at confirm-booking time, so a
  // later womenOnly toggle can't retroactively change what this ride's
  // cancellation fee is based on) and when the driver was matched — both
  // feed the cancellation-fee preview/charge, which needs to know the exact
  // vehicle and elapsed time regardless of what the fare sheet shows now.
  const [bookedVehicleType, setBookedVehicleType] = useState<FareVehicleTypeId>("e-riksha-share");
  const [matchedAtMs, setMatchedAtMs] = useState<number | null>(null);
  const driverArrivedNotifiedRef = useRef(false);
  // Route Restriction system — tracks the last-seen notice *timestamp*, not
  // a boolean, since a single ride can be rerouted more than once as
  // different closures activate over its lifetime.
  const lastSeenRestrictionNoticeAtRef = useRef<number | null>(null);
  const [showOtpQr, setShowOtpQr] = useState(false);
  const [otpQrDataUrl, setOtpQrDataUrl] = useState<string | null>(null);

  // Trip Completed panel — rate/tip popups, and UPI/wallet pay-button state.
  // Cash needs none of this: it's auto-confirmed the moment the ride
  // completes (see the effect near handleConfirmBooking) and just polls
  // getPayment for the driver's own "cash received" confirmation.
  const [showRatePopup, setShowRatePopup] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [showTipPopup, setShowTipPopup] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [tipError, setTipError] = useState("");
  const [tipSentAmount, setTipSentAmount] = useState<number | null>(null);
  const [razorpayError, setRazorpayError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [walletError, setWalletError] = useState("");
  // Guards the cash auto-confirm effect from firing its mutation more than
  // once per ride (it depends on a poll result, not a one-shot event).
  const cashAutoConfirmedForRideRef = useRef<number | null>(null);

  // The real ride this booking flow is tracking — set once trpc.ride.book
  // succeeds, cleared back to null when the flow resets to "idle". Polled via
  // getById (not getCurrent, which stops matching once status is
  // "completed"/"cancelled") so this device can see the ride all the way
  // through to a real driver's real completion/payment.
  const [currentRideId, setCurrentRideId] = useState<number | null>(null);
  const bookRideMutation = trpc.ride.book.useMutation();
  const cancelRideMutation = trpc.ride.cancel.useMutation();
  const startReturnMutation = trpc.ride.startReturn.useMutation({
    onSuccess: () => trpcUtils.ride.getById.invalidate({ id: currentRideId ?? 0 }),
  });
  const completeHourlyRentalMutation = trpc.ride.completeHourlyRental.useMutation({
    onSuccess: () => trpcUtils.ride.getById.invalidate({ id: currentRideId ?? 0 }),
  });
  const { data: activeRideFromServer } = trpc.ride.getCurrent.useQuery(undefined, {
    enabled: rideFlowStage === "idle",
  });

  // Real "Recent Places" — derived from the rider's own completed rides,
  // not a hardcoded/admin-configured list. Home/Work (if set) are merged in
  // ahead of these in recentPlaces below.
  const { data: rideHistoryForRecents } = trpc.user.getRideHistory.useQuery(
    { limit: 20 },
    { enabled: rideFlowStage === "idle" }
  );
  const { data: savedPlacesList = [] } = trpc.user.getSavedPlaces.useQuery(undefined, { enabled: rideFlowStage === "idle" });
  const { data: rideById } = trpc.ride.getById.useQuery(
    { id: currentRideId ?? 0 },
    { enabled: currentRideId !== null, refetchInterval: 2000, refetchIntervalInBackground: true }
  );
  const currentRide = currentRideId !== null ? rideById : null;

  // Recovers an in-progress ride after a page refresh — without this, a
  // reload while "searching"/"matched"/"in_ride" would silently drop back to
  // "idle" even though the real ride is still active server-side. Adjusted
  // directly during render (React's documented pattern for this) rather than
  // in an effect — self-terminating, since setting currentRideId makes the
  // guard below false on the very next render.
  if (rideFlowStage === "idle" && currentRideId === null && activeRideFromServer) {
    setCurrentRideId(activeRideFromServer.id);
    setRideFlowStage(
      activeRideFromServer.status === "searching" ? "searching"
        : activeRideFromServer.status === "accepted" ? "matched"
        : "in_ride"
    );
  }

  const rideOtp = currentRide?.otp ?? "";

  // Only ticks while an hourly rental is actually live — avoids a pointless
  // per-second re-render for every other ride type/stage.
  const [rentalNow, setRentalNow] = useState(Date.now());
  useEffect(() => {
    if (rideFlowStage !== "in_ride" || !currentRide?.isHourlyRental) return;
    const interval = setInterval(() => setRentalNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [rideFlowStage, currentRide?.isHourlyRental]);

  useEffect(() => {
    if (!showOtpQr || !rideOtp) return;
    let cancelled = false;
    QRCode.toDataURL(`ridepay:pickup-otp:${rideOtp}`, { width: 240, margin: 1 })
      .then((url) => { if (!cancelled) setOtpQrDataUrl(url); })
      .catch((error) => console.error("Error generating pickup OTP QR code:", error));
    return () => { cancelled = true; };
  }, [showOtpQr, rideOtp]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverRouteRef = useRef<google.maps.Polyline | null>(null);
  // Real captain GPS tracking (matched stage) — last position used, so we
  // can compute a heading and only re-fetch the road route once the driver
  // has actually moved, instead of hitting Directions on every poll.
  const lastCaptainPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastCaptainRouteFetchPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastCaptainHeadingRef = useRef(0);
  const [isListening, setIsListening] = useState(false);
  const voiceLang: VoiceLanguage = "en-IN";
  const [voiceError, setVoiceError] = useState("");
  const [showAiChat, setShowAiChat] = useState(false);
  const [selectedAdCampaign, setSelectedAdCampaign] = useState<AdCampaign | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mapView, toggleMapView: toggleTileView } = useGoogleMapViewToggle();
  const { theme, toggleTheme } = useTheme();
  const weather = useWeather(pickupCoords);
  const { campaigns } = useAdCampaigns();
  const { plans } = useSubscriptionPlans();
  const { promoSlides, offerTeasers, nearbyServices, quickTiles, rideTypes } = useHomeContent();
  const { isVehicleEnabled } = useFareConfig();

  // All fare math happens server-side (api/fare-router.ts) — these queries
  // are the only source of any price shown or charged in the ride flow.
  const hasRoute = !!destinationCoords && routeInfo.distance > 0;
  const womenOnlyVehicleAvailable = isVehicleEnabled("e-riksha-woman", "women");
  const fareVehicleFor = (optionId: "share" | "reserve" | "auto") =>
    womenOnly && womenOnlyVehicleAvailable ? "e-riksha-woman" : optionId === "auto" ? "auto-rickshaw" : "e-riksha";

  // Reference quote (auto segment, no AI boost) used only to seed the
  // client-side "AI suggested pricing" flourish's reasoning/multiplier —
  // the actual charged numbers below always come from their own quote.
  const { data: referenceFare } = trpc.fare.calculateFare.useQuery(
    { vehicleType: "auto-rickshaw", segment: "auto", distanceKm: routeInfo.distance, durationMin: routeInfo.duration, seats: 1, aiMultiplier: 1 },
    { enabled: hasRoute }
  );

  // Admin can turn "AI Suggested Pricing" off entirely (Admin → Surge
  // Pricing) — calculateFare already ignores a boosted aiMultiplier
  // server-side when this is off, but gating it here too means a disabled
  // rider never even sees the sparkle/strikethrough flourish in the first
  // place, instead of seeing it and then getting charged the plain price.
  const { data: surgeSettings } = trpc.fare.getSurge.useQuery();
  const aiPricingEnabled = surgeSettings?.aiPricingEnabled ?? true;

  useEffect(() => {
    // predictFare() uses Math.random() internally, so it's called here in an
    // effect rather than during render.
    if (referenceFare && aiPricingEnabled) setFarePrediction(predictFare(referenceFare.total));
    else setFarePrediction(null);
  }, [referenceFare, aiPricingEnabled]);

  const aiMultiplier = farePrediction?.multiplier ?? 1;
  const shareFareQuery = trpc.fare.calculateFare.useQuery(
    { vehicleType: fareVehicleFor("share"), segment: "share", distanceKm: routeInfo.distance, durationMin: routeInfo.duration, seats, aiMultiplier, couponCode: appliedCouponCode ?? undefined, pickupText: pickup, destinationText: destination },
    { enabled: hasRoute }
  );
  const reserveFareQuery = trpc.fare.calculateFare.useQuery(
    { vehicleType: fareVehicleFor("reserve"), segment: "reserve", distanceKm: routeInfo.distance, durationMin: routeInfo.duration, seats: 1, aiMultiplier, couponCode: appliedCouponCode ?? undefined, pickupText: pickup, destinationText: destination },
    { enabled: hasRoute }
  );
  const autoFareQuery = trpc.fare.calculateFare.useQuery(
    { vehicleType: fareVehicleFor("auto"), segment: "auto", distanceKm: routeInfo.distance, durationMin: routeInfo.duration, seats: 1, aiMultiplier, couponCode: appliedCouponCode ?? undefined, pickupText: pickup, destinationText: destination },
    { enabled: hasRoute }
  );
  const fareQuoteFor = (optionId: "share" | "reserve" | "auto") =>
    optionId === "share" ? shareFareQuery.data : optionId === "reserve" ? reserveFareQuery.data : autoFareQuery.data;
  const redeemCouponMutation = trpc.coupon.redeem.useMutation();
  // Live preview of what cancelling right now would cost — same calculation
  // the actual charge uses, computed server-side so the number in the sheet
  // is never out of sync with what's actually collected on confirm.
  const cancelPreviewQuery = trpc.cancellation.previewFee.useQuery(
    {
      vehicleType: bookedVehicleType,
      stage: rideFlowStage === "matched" ? "matched" : "searching",
      fareAmount: confirmedFare,
      matchedAtMs,
      riderName: customerName,
    },
    { enabled: showCancelSheet && !!customerName, refetchInterval: showCancelSheet ? 5000 : false }
  );
  const recordCancellationMutation = trpc.cancellation.record.useMutation();
  // Tracks this device's ride as part of the live "active rides" demand
  // signal the surge engine's auto mode reacts to (see api/fare-router.ts).
  const rideStartedMutation = trpc.fare.rideStarted.useMutation();
  const rideEndedMutation = trpc.fare.rideEnded.useMutation();
  const { unreadCountFor, pushEnabled, requestNotificationPermission, pushSystemNotification } = useNotifications();
  const unreadNotifications = unreadCountFor("rider");
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  const visiblePromoSlides = promoSlides.filter((s) => s.enabled);
  const visibleOfferTeasers = offerTeasers.filter((o) => o.enabled);
  const visibleNearbyServices = nearbyServices.filter((s) => s.enabled);
  const visibleQuickTiles = quickTiles.filter((t) => t.enabled);

  // Real Recent Places: saved Home/Work first, then distinct recent drop
  // addresses from the rider's own ride history (most recent first, capped).
  type RecentPlace = { key: string; label: string; address: string; coords: google.maps.LatLngLiteral; icon: typeof Home };
  const savedHome = savedPlacesList.find((p) => p.name === "Home");
  const savedWork = savedPlacesList.find((p) => p.name === "Work");
  const recentPlaces: RecentPlace[] = [
    ...(savedHome ? [{ key: "home", label: t("places.home"), address: savedHome.address, coords: { lat: Number(savedHome.lat), lng: Number(savedHome.lng) }, icon: Home }] : []),
    ...(savedWork ? [{ key: "work", label: t("places.work"), address: savedWork.address, coords: { lat: Number(savedWork.lat), lng: Number(savedWork.lng) }, icon: Briefcase }] : []),
  ];
  const seenRecentAddresses = new Set(recentPlaces.map((p) => p.address));
  for (const ride of rideHistoryForRecents?.items ?? []) {
    if (recentPlaces.length >= 4) break;
    if (ride.status !== "completed") continue;
    if (seenRecentAddresses.has(ride.dropAddress)) continue;
    seenRecentAddresses.add(ride.dropAddress);
    recentPlaces.push({
      key: `ride-${ride.id}`,
      label: ride.dropAddress.split(",")[0],
      address: ride.dropAddress,
      coords: { lat: Number(ride.dropLat), lng: Number(ride.dropLng) },
      icon: History,
    });
  }
  const rideTypeMeta: Record<string, { icon: typeof Users; path?: string; subtitle: string }> = {
    share: { icon: Users, subtitle: "Save More" },
    reserve: { icon: Car, subtitle: "Book in Advance" },
    women: { icon: ShieldAlert, path: "/user/safety", subtitle: "Safe & Secure" },
    school: { icon: GraduationCap, path: "/user/student-pass", subtitle: "For Students" },
    corporate: { icon: Building2, path: "/user/subscription", subtitle: "For Businesses" },
    schedule: { icon: CalendarClock, path: "/user/schedule", subtitle: "Plan Ahead" },
  };
  const visibleRideTypes = rideTypes.filter((r) => r.enabled).map((r) => ({ ...r, ...rideTypeMeta[r.id] }));
  const QUICK_TILE_META: Record<QuickTileId, { icon: typeof Users; bg: string; color: string; action: () => void }> = {
    schoolPass: { icon: GraduationCap, bg: "#E0F2FE", color: "#0EA5E9", action: () => navigate("/user/student-pass") },
    sendParcel: { icon: Package, bg: "#F3E8FF", color: "#7C3AED", action: () => setMode("parcel") },
    referEarn: { icon: Users, bg: "#E8F5E8", color: "#138808", action: () => navigate("/user/refer") },
    support: { icon: MessageCircle, bg: "#FFF5EB", color: "#FF6B00", action: () => navigate("/user/support") },
  };

  // Draggable bottom sheet: three snap states, changed by tapping/dragging the handle.
  const [sheetState, setSheetState] = useState<"min" | "peek" | "half" | "full">("peek");
  const sheetDragRef = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });
  const [sheetDragPx, setSheetDragPx] = useState(0);

  // Auto-sliding promo banner at the top of the sheet, swipeable + auto-advancing.
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerDragRef = useRef<{ startX: number; active: boolean }>({ startX: 0, active: false });

  // Larger client-advertising banner (full-state only), independent slider.
  const [adSlideIndex, setAdSlideIndex] = useState(0);
  const adBannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adBannerDragRef = useRef<{ startX: number; active: boolean }>({ startX: 0, active: false });

  // The right-side floating action rail is positioned just below the header
  // card, whose height varies (voice language chips, AI status chip, mode).
  const headerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(220);
  // Lets recenterPickupPill (called from a visualViewport listener, outside
  // React's render cycle) always read the current height instead of whatever
  // was captured the last time that listener was attached.
  const headerHeightRef = useRef(headerHeight);

  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const observer = new ResizeObserver((entries) => {
      setHeaderHeight(entries[0].contentRect.height);
      headerHeightRef.current = entries[0].contentRect.height;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Primary service mode: Ride or Parcel (Parcel merges sending a parcel and tracking an incoming one in one panel)
  const [mode, setMode] = useState<ServiceMode>("ride");
  const [selectedRideType, setSelectedRideType] = useState<RideTypeId>("share");
  const [parcelSize, setParcelSize] = useState<(typeof PACKAGE_SIZES)[number]["id"]>("small");
  const [parcelWeight, setParcelWeight] = useState("1");
  const [parcelNotes, setParcelNotes] = useState("");
  const [parcelFragile, setParcelFragile] = useState(false);
  const [parcelInstant, setParcelInstant] = useState(true);
  const [parcelPaidBy, setParcelPaidBy] = useState<"sender" | "receiver">("sender");
  const [parcelSearching, setParcelSearching] = useState(false);
  const [parcelTrackingId, setParcelTrackingId] = useState<string | null>(null);
  const [parcelWalletError, setParcelWalletError] = useState("");
  // "Track a Parcel" — lets anyone (e.g. the receiver, on any device/session)
  // look a parcel up by its shareable code and, once the courier has arrived,
  // confirm receipt with the delivery PIN and/or pay if the sender assigned them as payer.
  const [trackCodeInput, setTrackCodeInput] = useState("");
  const [trackedCode, setTrackedCode] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // Deep-link support for the Services hub's Parcel card (?mode=parcel),
  // Shared Toto card (?rideType=share — already selectedRideType's own
  // default, set explicitly anyway so the link stays correct even if that
  // default ever changes), and for a tapped "scheduled ride due" push
  // notification (?scheduleId=123, see schedule-router.ts's checkDue) — all
  // one-shot on the first render only, not something to keep re-applying as
  // searchParams changes.
  useEffect(() => {
    if (searchParams.get("mode") === "parcel") setMode("parcel");
    if (searchParams.get("rideType") === "share") setSelectedRideType("share");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleIdParam = searchParams.get("scheduleId");
  const { data: scheduleForPrefill } = trpc.schedule.getById.useQuery(
    { id: Number(scheduleIdParam) },
    { enabled: !!scheduleIdParam }
  );
  const scheduleAppliedRef = useRef(false);
  useEffect(() => {
    if (!scheduleForPrefill || !mapInstance || scheduleAppliedRef.current) return;
    scheduleAppliedRef.current = true;
    const pickupPoint = { lat: Number(scheduleForPrefill.pickupLat), lng: Number(scheduleForPrefill.pickupLng) };
    const dropPoint = { lat: Number(scheduleForPrefill.dropLat), lng: Number(scheduleForPrefill.dropLng) };
    setPickup(scheduleForPrefill.pickupAddress);
    setPickupCoords(pickupPoint);
    pickupCoordsRef.current = pickupPoint;
    updatePickupMarker(pickupPoint);
    applyDestination(dropPoint, scheduleForPrefill.dropAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleForPrefill, mapInstance]);

  const trpcUtils = trpc.useUtils();
  const bookParcelMutation = trpc.parcel.book.useMutation({
    onSuccess: (booking) => {
      if (booking) setParcelTrackingId(booking.trackingId);
    },
  });
  const advanceParcelStageMutation = trpc.parcel.advanceStage.useMutation({
    onSuccess: () => trpcUtils.parcel.getByTrackingId.invalidate(),
  });
  const confirmParcelDeliveryMutation = trpc.parcel.confirmDelivery.useMutation();
  const submitParcelPaymentMutation = trpc.parcel.submitPayment.useMutation({
    onSuccess: () => trpcUtils.parcel.getByTrackingId.invalidate(),
  });
  const debitWalletMutation = trpc.settlement.debitWallet.useMutation({
    onSuccess: () => trpcUtils.settlement.getWallet.invalidate({ walletType: "customer", ownerId: customerName }),
  });
  const { data: customerWallet } = trpc.settlement.getWallet.useQuery(
    { walletType: "customer", ownerId: customerName },
    { enabled: !!customerName && rideFlowStage === "completed" }
  );
  // Either side of the ride can poll this to see whether/how it's been paid —
  // null until confirmPayment first runs (which the cash auto-confirm effect
  // below fires immediately on completion, so this is never null for long).
  const { data: currentRidePayment } = trpc.ride.getPayment.useQuery(
    { rideId: currentRideId ?? 0 },
    { enabled: rideFlowStage === "completed" && currentRideId !== null, refetchInterval: 2000, refetchIntervalInBackground: true }
  );
  const createPaymentOrderMutation = trpc.ride.createPaymentOrder.useMutation();
  const verifyRazorpayPaymentMutation = trpc.razorpay.verifyPayment.useMutation();
  const confirmRidePaymentMutation = trpc.ride.confirmPayment.useMutation({
    onSuccess: () => trpcUtils.ride.getPayment.invalidate({ rideId: currentRideId ?? 0 }),
  });
  const rateRideMutation = trpc.ride.rate.useMutation();
  const tipDriverMutation = trpc.ride.tipDriver.useMutation({
    onSuccess: (_data, variables) => {
      setTipError("");
      setTipSentAmount(variables.amount);
      setShowTipPopup(false);
      trpcUtils.settlement.getWallet.invalidate({ walletType: "customer", ownerId: customerName });
    },
    onError: () => setTipError(t("home.insufficientWalletTip")),
  });
  const { data: myParcel } = trpc.parcel.getByTrackingId.useQuery(
    { trackingId: parcelTrackingId ?? "" },
    { enabled: !!parcelTrackingId, refetchInterval: 2000, refetchIntervalInBackground: true }
  );
  const { data: trackedParcel, isFetching: trackedParcelFetching } = trpc.parcel.getByTrackingId.useQuery(
    { trackingId: trackedCode ?? "" },
    { enabled: !!trackedCode, refetchInterval: 2500, refetchIntervalInBackground: true }
  );

  const vehicleMarkersRef = useRef<google.maps.Marker[]>([]);
  const vehicleStateRef = useRef<{ lat: number; lng: number; heading: number }[]>([]);
  const vehicleMoveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fleetSwitchedRef = useRef(false);
  const courierMarkerRef = useRef<google.maps.Marker | null>(null);
  const courierRouteRef = useRef<google.maps.Polyline | null>(null);

  // The map is only initialized once (mount-only effect below), so its event
  // handlers close over stale state. These refs give them a way to always
  // read the latest values without re-creating the map.
  const pickupCoordsRef = useRef(pickupCoords);
  const destinationCoordsRef = useRef(destinationCoords);
  const isEditingPickupRef = useRef(isEditingPickup);
  const modeRef = useRef(mode);
  const isVehicleEnabledRef = useRef(isVehicleEnabled);

  useEffect(() => {
    pickupCoordsRef.current = pickupCoords;
    // Keeps the floating pickup pill anchored to the pin whenever the pin
    // itself moves (drag, GPS upgrade, autocomplete select, POI tap) — pans
    // and zooms are handled automatically by the OverlayView's own draw().
    pickupPillOverlayRef.current?.setPosition(pickupCoords);
  }, [pickupCoords]);

  // Keeps the pickup pin (and the pill anchored to it) a small, fixed
  // distance below the header — not centered in the visible map area, which
  // read as "too low" once a variable-height gap (sheet height, on-screen
  // keyboard) was factored in. A fixed offset from the header is simpler and
  // matches every state without needing to know how tall the remaining space
  // actually is. Pans the MAP's center (not the pill) using the standard
  // pixel-offset-via-projection technique, so it's a real map pan, not just
  // a CSS position trick.
  //
  // Reads the sheet's real getBoundingClientRect() (via sheetRef) instead of
  // a hand-maintained numeric copy of the sheetMaxHeight JSX below — a
  // maxHeight is only ever an upper bound, and the sheet's actual rendered
  // height also depends on its content, so a parallel "what height is it
  // right now" calculation reliably drifts out of sync with reality (it did,
  // twice) — sheetTopPx is only used here as a floor, to stop the pill
  // encroaching on the sheet (or the on-screen keyboard) when either is
  // unusually tall. The 500ms delay lets the sheet's own max-height
  // transition finish before measuring, so this reads the settled position
  // rather than a mid-animation one.
  const recenterPickupPill = () => {
    const gMap = map.current;
    const mapEl = mapContainer.current;
    if (!gMap || !mapEl) return;
    const projection = gMap.getProjection();
    if (!projection) return;

    const containerRect = mapEl.getBoundingClientRect();
    const containerHeight = mapEl.clientHeight;
    const topBoundary = headerHeightRef.current + 24;
    const sheetTopPx = sheetRef.current
      ? sheetRef.current.getBoundingClientRect().top - containerRect.top
      : containerHeight;
    // `sheetTopPx` comes from the layout viewport (fixed positioning doesn't
    // react to the on-screen keyboard), but the keyboard visually covers the
    // bottom of that layout regardless — visualViewport.height is the part
    // actually still visible, and shrinks live as the keyboard opens.
    const visibleBottomPx = Math.min(sheetTopPx, window.visualViewport?.height ?? containerHeight);
    // 118 = ~85px of intended on-screen spacing below the header (enough for
    // the pill's own height plus a margin) + ~33px empirically observed
    // shortfall between where this function targets and where the pin
    // actually ends up on screen (root cause not fully pinned down — some
    // combination of viewport vs. map-container height and the OverlayView's
    // own pixel rounding — confirmed via direct getBoundingClientRect()
    // measurement, not just theory). Clamped so it never gets pushed below
    // the sheet or the keyboard in a cramped viewport.
    const visibleCenterY = Math.min(topBoundary + 118, Math.max(topBoundary + 20, visibleBottomPx - 20));
    const pureCenterY = containerHeight / 2;
    const pixelShiftUp = pureCenterY - visibleCenterY;

    const zoom = gMap.getZoom() ?? 16;
    const scale = 2 ** zoom;
    const pickupPoint = projection.fromLatLngToPoint(new google.maps.LatLng(pickupCoordsRef.current));
    if (!pickupPoint) return;
    // New center sits south of the pin by pixelShiftUp (at current zoom),
    // so the pin — fixed in world space — renders north of screen-center by
    // that same amount, i.e. exactly at visibleCenterY.
    const newCenterPoint = new google.maps.Point(pickupPoint.x, pickupPoint.y + pixelShiftUp / scale);
    const newCenter = projection.fromPointToLatLng(newCenterPoint);
    if (newCenter) gMap.panTo(newCenter);
  };

  // Keeps the pickup pin (and the pill anchored to it) vertically centered
  // in whatever map area is actually still visible above the bottom sheet —
  // so it sits at true screen-center when the sheet is minimized, and rides
  // upward to stay clear as the sheet grows taller. Pans the MAP's center
  // (not the pill) using the standard pixel-offset-via-projection technique,
  // so it's a real map pan, not just a CSS position trick.
  //
  // Reads the sheet's real getBoundingClientRect() (via sheetRef) instead of
  // a hand-maintained numeric copy of the sheetMaxHeight JSX below — a
  // maxHeight is only ever an upper bound, and the sheet's actual rendered
  // height also depends on its content, so a parallel "what height is it
  // right now" calculation reliably drifts out of sync with reality (it did,
  // twice). The 500ms delay lets the sheet's own max-height transition
  // finish before measuring, so this reads the settled position rather than
  // a mid-animation one.
  useEffect(() => {
    if (!mapReady || !map.current || !mapContainer.current) return;
    const timer = setTimeout(recenterPickupPill, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, sheetState, rideFlowStage, mode, headerHeight, pickupCoords]);

  // Re-centers live as the on-screen keyboard opens/closes (visualViewport
  // fires 'resize' for that), so focusing the destination field doesn't need
  // its own dedicated effect just to catch the keyboard's own animation.
  useEffect(() => {
    if (!mapReady || !window.visualViewport) return;
    const vv = window.visualViewport;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(recenterPickupPill, 120);
    };
    vv.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      vv.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  useEffect(() => {
    destinationCoordsRef.current = destinationCoords;
  }, [destinationCoords]);

  useEffect(() => {
    isEditingPickupRef.current = isEditingPickup;
  }, [isEditingPickup]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    isVehicleEnabledRef.current = isVehicleEnabled;
  }, [isVehicleEnabled]);

  const reverseGeocode = (coords: google.maps.LatLngLiteral) => {
    geocoderRef.current?.geocode({ location: coords }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        setPickup(results[0].formatted_address);
      } else {
        setPickup(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      }
    });
  };

  const updatePickupMarker = (coords: google.maps.LatLngLiteral) => {
    pickupMarkerRef.current?.setPosition(coords);
    map.current?.panTo(coords);
    map.current?.setZoom(16);
  };

  const getRoute = async (start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral) => {
    try {
      const route = await fetchGoogleRoute(start, end);
      if (!route) return;

      // Fare itself is computed server-side (api/fare-router.ts) from this
      // distance/duration via the calculateFare queries below — this effect
      // only records the route geometry, never the price.
      setRouteInfo({ distance: Math.round(route.distanceKm * 10) / 10, duration: Math.round(route.durationMin) });
      if (modeRef.current === "ride") {
        setShowFareSheet(true);
        setSheetState("half");
      }

      if (map.current) {
        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = new google.maps.Polyline({
          path: route.path,
          strokeColor: "#FF6B00",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        });
        routePolylineRef.current.setMap(map.current);
        map.current.fitBounds(route.bounds, 50);
      }
    } catch (error) {
      console.error("Error getting route:", error);
    }
  };

  // Selecting a POI pin sets it as pickup or destination, same as picking an autocomplete result.
  const handlePoiAsPickup = (poi: NearbyPlace) => {
    const coords = { lat: poi.lat, lng: poi.lng };
    setPickupCoords(coords);
    setPickup(poi.name);
    updatePickupMarker(coords);
    poiInfoWindowRef.current?.close();
    if (destinationCoordsRef.current) {
      getRoute(coords, destinationCoordsRef.current);
    }
  };

  const handlePoiAsDestination = (poi: NearbyPlace) => {
    const coords = { lat: poi.lat, lng: poi.lng };
    setDestination(poi.name);
    setDestinationCoords(coords);

    if (map.current) {
      destinationMarkerRef.current?.setMap(null);
      destinationMarkerRef.current = new google.maps.Marker({ position: coords, map: map.current, icon: createDestinationIcon() });
      getRoute(pickupCoordsRef.current, coords);
    }
    poiInfoWindowRef.current?.close();
  };

  const buildPoiInfoWindowContent = (poi: NearbyPlace) => {
    const el = document.createElement("div");
    el.className = "text-sm";

    const title = document.createElement("p");
    title.className = "font-semibold text-[#1A1A2E] mb-2";
    title.textContent = poi.name;
    el.appendChild(title);

    const row = document.createElement("div");
    row.className = "flex gap-2";

    const pickupBtn = document.createElement("button");
    pickupBtn.textContent = t("home.setAsPickup");
    pickupBtn.className = "px-2 py-1 rounded-lg bg-[#138808] text-white text-xs font-medium";
    pickupBtn.onclick = () => handlePoiAsPickup(poi);

    const destBtn = document.createElement("button");
    destBtn.textContent = t("home.setAsDestination");
    destBtn.className = "px-2 py-1 rounded-lg bg-[#FF6B00] text-white text-xs font-medium";
    destBtn.onclick = () => handlePoiAsDestination(poi);

    row.append(pickupBtn, destBtn);
    el.appendChild(row);
    return el;
  };

  // Google's base map renders its own clickable business/landmark icons —
  // separate from the fetchNearbyPlaces markers below — and tapping one used
  // to pop Google's own default info window (a bare address card with a
  // small "open in Google Maps" link icon we have no way to restyle or hook
  // a click handler into). Intercepting via e.placeId + e.stop() in the map
  // click listener and re-fetching the same place through the Places API
  // lets it open through our own info window instead, with real "Set as
  // pickup"/"Set as destination" buttons like every other POI on this map.
  const handleBaseMapPoiClick = async (placeId: string, fallback: google.maps.LatLng) => {
    if (!map.current || !poiInfoWindowRef.current) return;
    try {
      const place = new google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ["displayName", "location", "types"] });
      const location = place.location ?? fallback;
      const poi: NearbyPlace = {
        id: placeId,
        name: place.displayName || "Selected location",
        lat: location.lat(),
        lng: location.lng(),
        category: categorizeGoogleTypes(place.types ?? []),
      };
      poiInfoWindowRef.current.setContent(buildPoiInfoWindowContent(poi));
      poiInfoWindowRef.current.setPosition({ lat: poi.lat, lng: poi.lng });
      poiInfoWindowRef.current.open({ map: map.current });
    } catch (error) {
      console.error("Error fetching clicked POI details:", error);
    }
  };

  // Pickup lives inside a google.maps.OverlayView (portaled so it floats
  // pinned to the actual marker) — its <input> only exists in the DOM one
  // render after the overlay's div is created, so this can't run inline in
  // the map-init effect like it used to; it's called from a [pickupPillContainer]
  // effect below instead, once the portal has actually mounted the input.
  const attachPickupAutocomplete = () => {
    if (!pickupInputRef.current) return;
    if (pickupAutocompleteRef.current) {
      google.maps.event.clearInstanceListeners(pickupAutocompleteRef.current);
    }
    pickupAutocompletePacElRef.current?.remove();
    pickupAutocompletePacElRef.current = null;
    pickupAutocompleteRef.current = attachAutocomplete(
      pickupInputRef.current,
      (place) => {
        const coords = { lat: place.lat, lng: place.lng };
        setPickupCoords(coords);
        setPickup(place.name);
        updatePickupMarker(coords);
        setIsEditingPickup(false);
        if (destinationCoordsRef.current) getRoute(coords, destinationCoordsRef.current);
      },
      pickupCoordsRef.current
    );
    const containers = document.querySelectorAll<HTMLElement>(".pac-container");
    pickupAutocompletePacElRef.current = containers[containers.length - 1] ?? null;
  };

  // Destination search is NOT wired to google.maps.places.Autocomplete (see
  // attachPickupAutocomplete above for that pattern, still used for pickup).
  // Google's Autocomplete widget only soft-biases toward nearby results, so
  // a bare category word ("college") came back dominated by far-away,
  // higher-prominence results instead of the nearest match — see
  // runDestinationSearch below, which ranks by actual distance instead.

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        geocoderRef.current = new google.maps.Geocoder();

        const gMap = new google.maps.Map(mapContainer.current, {
          center: pickupCoordsRef.current,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          // Vector rendering (needs a Map ID) is required for the 3D rickshaw
          // fleet overlay showing nearby drivers.
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);

        // Vector maps compute their viewport lazily — without this the map
        // renders into only a fraction of its container until something
        // else forces a relayout.
        setTimeout(() => {
          google.maps.event.trigger(gMap, "resize");
          gMap.setCenter(pickupCoordsRef.current);
        }, 100);

        // Current location / pickup marker
        pickupMarkerRef.current = new google.maps.Marker({
          position: pickupCoordsRef.current,
          map: gMap,
          icon: createCurrentLocationIcon(),
          draggable: true,
        });

        pickupMarkerRef.current.addListener("dragend", () => {
          const pos = pickupMarkerRef.current?.getPosition();
          if (!pos) return;
          const coords = { lat: pos.lat(), lng: pos.lng() };
          setPickupCoords(coords);
          reverseGeocode(coords);
        });

        // Tapping (not just dragging) the current-location marker focuses
        // the floating pickup pill so it can be typed into directly.
        pickupMarkerRef.current.addListener("click", () => {
          setIsEditingPickup(true);
          pickupInputRef.current?.focus();
          pickupInputRef.current?.select();
        });

        // The pill's portal target — a plain div that a google.maps.OverlayView
        // keeps re-projected to the marker's actual screen position on every
        // pan/zoom (Google calls draw() automatically; we only need to push a
        // new position in when the LatLng itself changes, see the pickupCoords
        // effect below).
        class PillOverlayImpl extends google.maps.OverlayView implements PickupPillOverlay {
          private div = document.createElement("div");
          private pos: google.maps.LatLng;
          constructor(position: google.maps.LatLngLiteral) {
            super();
            this.pos = new google.maps.LatLng(position);
            this.div.style.position = "absolute";
          }
          onAdd() {
            this.getPanes()!.floatPane.appendChild(this.div);
          }
          draw() {
            const projection = this.getProjection();
            if (!projection) return;
            const point = projection.fromLatLngToDivPixel(this.pos);
            if (!point) return;
            this.div.style.left = `${point.x}px`;
            this.div.style.top = `${point.y}px`;
          }
          onRemove() {
            this.div.remove();
          }
          setPosition(position: google.maps.LatLngLiteral) {
            this.pos = new google.maps.LatLng(position);
            this.draw();
          }
          getDiv() {
            return this.div;
          }
        }
        const pillOverlay: PickupPillOverlay = new PillOverlayImpl(pickupCoordsRef.current);
        pillOverlay.setMap(gMap);
        pickupPillOverlayRef.current = pillOverlay;
        setPickupPillContainer(pillOverlay.getDiv());

        // Try to upgrade to the device's real GPS location now that the map,
        // marker and geocoder all exist — doing this before they're ready
        // silently drops the update (marker missing) or shows raw lat/lng
        // (geocoder missing), which is why this runs inside .then() instead
        // of racing it in parallel with the map load.
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (disposed) return;
              const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
              setPickupCoords(coords);
              updatePickupMarker(coords);
              reverseGeocode(coords);
            },
            (error) => {
              console.warn("Error getting current location:", error.message);
            },
            { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 }
          );
        }

        // Click on map to set pickup location while editing — or, if a base
        // map business/landmark icon was tapped instead, show our own POI
        // card (pickup/destination buttons) rather than Google's default one.
        gMap.addListener("click", (e: google.maps.IconMouseEvent) => {
          if (e.placeId && e.latLng) {
            e.stop();
            void handleBaseMapPoiClick(e.placeId, e.latLng);
            return;
          }
          if (isEditingPickupRef.current && e.latLng) {
            const coords = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setPickupCoords(coords);
            updatePickupMarker(coords);
            reverseGeocode(coords);
            setIsEditingPickup(false);
          }
        });

        // Nearby vehicle markers (simulated availability)
        const base = pickupCoordsRef.current;
        const vehiclePositions: google.maps.LatLngLiteral[] = [
          { lat: base.lat + 0.005, lng: base.lng - 0.005 },
          { lat: base.lat - 0.005, lng: base.lng + 0.005 },
          { lat: base.lat - 0.01, lng: base.lng - 0.01 },
          { lat: base.lat + 0.005, lng: base.lng + 0.01 },
        ];
        vehicleMarkersRef.current = vehiclePositions.map(
          (pos, i) => new google.maps.Marker({ position: pos, map: gMap, icon: createVehicleIcon({ status: VEHICLE_STATUSES[i] }) })
        );
        vehicleStateRef.current = vehiclePositions.map((pos) => ({ ...pos, heading: 0 }));

        // Nearby drivers drift slightly every couple of seconds so the map
        // reads as "live" — 3D rickshaws (once WebGLOverlayView confirms it
        // can render) replace the flat 2D pins the first time this fires.
        vehicleMoveTimerRef.current = setInterval(() => {
          vehicleStateRef.current = vehicleStateRef.current.map((v) => {
            const dLat = (Math.random() - 0.5) * 0.0012;
            const dLng = (Math.random() - 0.5) * 0.0012;
            const next = { lat: v.lat + dLat, lng: v.lng + dLng };
            const heading = google.maps.geometry?.spherical
              ? google.maps.geometry.spherical.computeHeading(v, next)
              : v.heading;
            return { ...next, heading };
          });

          if (rickshawFleet.isAvailableRef.current) {
            if (!fleetSwitchedRef.current) {
              fleetSwitchedRef.current = true;
              vehicleMarkersRef.current.forEach((m) => m.setMap(null));
            }
            const nearbyModels = modeRef.current === "parcel" ? NEARBY_PARCEL_VEHICLE_MODELS : NEARBY_VEHICLE_MODELS;
            // A vehicle type the admin has disabled shouldn't appear as
            // ambient "nearby availability" either — falls back to the
            // generic car model (which has no enable/disable concept of its
            // own, same as real street traffic) instead of just vanishing.
            const isEnabled = isVehicleEnabledRef.current;
            vehicleStateRef.current.forEach((v, i) => {
              const model = nearbyModels[i];
              const effectiveModel: VehicleModelType =
                (model === "e-riksha" || model === "e-riksha-woman") && !isEnabled("e-riksha") ? "car"
                  : model === "auto-rickshaw" && !isEnabled("auto-rickshaw") ? "car"
                  : model === "e-riksha-parcel" && !isEnabled("e-riksha-parcel") ? "car"
                  : model;
              rickshawFleet.setVehicle(`nearby-${i}`, v.lat, v.lng, v.heading, effectiveModel);
            });
          } else {
            vehicleMarkersRef.current.forEach((marker, i) => {
              marker.setPosition(vehicleStateRef.current[i]);
            });
          }
        }, 2200);

        // Real shops, restaurants, schools and landmarks nearby, clustered so
        // they stay readable while zoomed out and fully split apart up close.
        poiInfoWindowRef.current = new google.maps.InfoWindow();
        poiClusterRef.current = new MarkerClusterer({ map: gMap, markers: [] });

        const loadPois = async () => {
          const currentMap = map.current;
          const cluster = poiClusterRef.current;
          if (!currentMap || !cluster) return;

          if ((currentMap.getZoom() ?? 0) < 15) {
            cluster.clearMarkers();
            return;
          }

          const center = currentMap.getCenter();
          if (!center) return;

          try {
            const places = await fetchNearbyPlaces({ lat: center.lat(), lng: center.lng() }, 1500);
            if (map.current !== currentMap || poiClusterRef.current !== cluster) return;

            cluster.clearMarkers();
            const markers = places.map((poi) => {
              const marker = new google.maps.Marker({
                position: { lat: poi.lat, lng: poi.lng },
                icon: createPoiIcon(poi.category),
              });
              marker.addListener("click", () => {
                if (!poiInfoWindowRef.current || !map.current) return;
                poiInfoWindowRef.current.setContent(buildPoiInfoWindowContent(poi));
                poiInfoWindowRef.current.open({ map: map.current, anchor: marker });
              });
              return marker;
            });
            cluster.addMarkers(markers);
          } catch (error) {
            console.warn("Error fetching nearby places:", error);
          }
        };

        gMap.addListener("idle", () => {
          if (poiLoadTimeoutRef.current) clearTimeout(poiLoadTimeoutRef.current);
          poiLoadTimeoutRef.current = setTimeout(loadPois, 500);
        });

        // Pickup's Places Autocomplete renders its own suggestion dropdown -
        // no custom results list needed there. Its own attachment is NOT
        // done here — see attachPickupAutocomplete and the [pickupPillContainer]
        // effect below (this ran before the portal had mounted the input).
        // Destination search is plain React state (see runDestinationSearch),
        // so it needs no attach-on-mapReady step at all.
        setMapReady(true);
        console.log("Map loaded successfully");
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      if (poiLoadTimeoutRef.current) clearTimeout(poiLoadTimeoutRef.current);
      if (vehicleMoveTimerRef.current) clearInterval(vehicleMoveTimerRef.current);
      poiClusterRef.current?.clearMarkers();
      pickupMarkerRef.current?.setMap(null);
      pickupPillOverlayRef.current?.setMap(null);
      pickupPillOverlayRef.current = null;
      destinationMarkerRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
      vehicleMarkersRef.current.forEach((marker) => marker.setMap(null));
      courierMarkerRef.current?.setMap(null);
      courierRouteRef.current?.setMap(null);
    };
    // `colorScheme` can only be set when a vector map is initialized (Google
    // Maps API constraint — it can't be live-patched via setOptions like the
    // classic `styles` array), so this effect intentionally re-runs and
    // recreates the map whenever the app's theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Pickup's <input> is portaled into the map OverlayView's div — it only
  // exists in the DOM once React has committed a render with
  // pickupPillContainer set, one tick after the overlay itself is created.
  // Attaching here (instead of inline in the map-init effect) is what makes
  // that actually work.
  useEffect(() => {
    if (!pickupPillContainer) return;
    attachPickupAutocomplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupPillContainer]);

  // Map behavior swaps by service mode: Ride shows plain nearby vehicles.
  // Parcel mode badges those same vehicles as parcel-capable AND overlays the
  // assigned incoming courier en route to the pickup address, all at once.
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const gMap = map.current;

    vehicleMarkersRef.current.forEach((marker, i) => {
      marker.setIcon(createVehicleIcon({ parcelBadge: mode === "parcel", status: VEHICLE_STATUSES[i] }));
      // Once the 3D fleet has taken over, leave the flat 2D pins detached —
      // don't let a mode toggle accidentally re-show them underneath.
      if (!fleetSwitchedRef.current) marker.setMap(gMap);
    });

    // The courier marker/route itself is now owned entirely by the active-
    // booking effects below (assigned/picked_up legs) instead of a decorative
    // always-on preview, so leaving Parcel mode just tears down any leftovers.
    if (mode !== "parcel") {
      courierMarkerRef.current?.setMap(null);
      courierRouteRef.current?.setMap(null);
      rickshawFleet.removeVehicle("courier");
    }
    // rickshawFleet's methods are stable (backed by refs internally) even
    // though the hook returns a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mapReady]);

  // Clears the courier marker/route whenever a new parcel booking starts (or
  // the previous one's tracking id is cleared) — the two stage-leg effects
  // below own the marker/route while a booking is in flight.
  useEffect(() => {
    return () => {
      courierMarkerRef.current?.setMap(null);
      courierRouteRef.current?.setMap(null);
      rickshawFleet.removeVehicle("courier");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelTrackingId]);

  // Parcel leg 1: "assigned" — animate the courier driving from a nearby
  // start point to the pickup address, then advance the booking to "picked_up".
  // When the sender is paying, dispatch is held until that payment is
  // confirmed (cash is collected at pickup, so the courier can't be sent
  // out to collect it before the sender has actually paid).
  useEffect(() => {
    if (!myParcel || myParcel.stage !== "assigned" || !mapReady) return;
    if (myParcel.paidBy === "sender" && myParcel.paymentStatus !== "confirmed") return;
    const gMap = map.current;
    const trackingId = myParcel.trackingId;
    let disposed = false;
    let animation: PathAnimationHandle | null = null;

    pushSystemNotification({
      audience: "rider",
      title: "Courier Assigned!",
      message: `${myParcel.driverName} is heading to pick up your parcel from ${myParcel.pickup}.`,
    });

    const courierStart: google.maps.LatLngLiteral = {
      lat: myParcel.pickupCoords.lat + (Math.random() > 0.5 ? 0.012 : -0.012),
      lng: myParcel.pickupCoords.lng + (Math.random() > 0.5 ? 0.012 : -0.012),
    };
    const is3DFleetAvailable = () => rickshawFleet.isAvailableRef.current === true;

    const finishLeg = () => {
      animation?.cancel();
      setTimeout(() => advanceParcelStageMutation.mutate({ trackingId, stage: "picked_up" }), 1000);
    };

    if (gMap) {
      courierMarkerRef.current = new google.maps.Marker({
        position: courierStart,
        map: is3DFleetAvailable() ? null : gMap,
        icon: createCourierIcon(),
      });
      if (is3DFleetAvailable()) rickshawFleet.setVehicle("courier", courierStart.lat, courierStart.lng, 0, "e-riksha-parcel");

      fetchGoogleRoute(courierStart, myParcel.pickupCoords)
        .then((route) => {
          if (disposed || !route) return;
          const pathCoords = route.path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
          courierRouteRef.current?.setMap(null);
          courierRouteRef.current = new google.maps.Polyline({
            path: pathCoords, strokeColor: "#0EA5E9", strokeWeight: 5, strokeOpacity: 0.85, map: gMap,
          });
          gMap.fitBounds(route.bounds, 70);

          animation = animateAlongPath(
            pathCoords,
            7000,
            (point, heading, remainingPath) => {
              if (is3DFleetAvailable()) {
                rickshawFleet.setVehicle("courier", point.lat, point.lng, heading, "e-riksha-parcel", true);
              } else {
                courierMarkerRef.current?.setPosition(point);
              }
              courierRouteRef.current?.setPath(remainingPath);
            },
            finishLeg
          );
        })
        .catch((error) => console.error("Error fetching courier pickup route:", error));
    }

    const fallbackTimer = setTimeout(finishLeg, gMap ? 8000 : 3500);

    return () => {
      disposed = true;
      animation?.cancel();
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myParcel?.trackingId, myParcel?.stage, myParcel?.paymentStatus, mapReady]);

  // Parcel leg 2: "picked_up" — animate the courier driving from pickup to
  // the destination, then advance the booking to "arrived".
  useEffect(() => {
    if (!myParcel || myParcel.stage !== "picked_up" || !mapReady) return;
    const gMap = map.current;
    const trackingId = myParcel.trackingId;
    let disposed = false;
    let animation: PathAnimationHandle | null = null;

    pushSystemNotification({
      audience: "rider",
      title: "Parcel Picked Up!",
      message: `${myParcel.driverName} has picked up your parcel and is on the way to ${myParcel.destination}.`,
    });

    const is3DFleetAvailable = () => rickshawFleet.isAvailableRef.current === true;

    const finishLeg = () => {
      animation?.cancel();
      setTimeout(() => advanceParcelStageMutation.mutate({ trackingId, stage: "arrived" }), 1000);
    };

    if (gMap) {
      if (is3DFleetAvailable()) {
        rickshawFleet.setVehicle("courier", myParcel.pickupCoords.lat, myParcel.pickupCoords.lng, 0, "e-riksha-parcel");
      } else {
        courierMarkerRef.current?.setPosition(myParcel.pickupCoords);
        courierMarkerRef.current?.setMap(gMap);
      }

      fetchGoogleRoute(myParcel.pickupCoords, myParcel.destinationCoords)
        .then((route) => {
          if (disposed || !route) return;
          const pathCoords = route.path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
          courierRouteRef.current?.setMap(null);
          courierRouteRef.current = new google.maps.Polyline({
            path: pathCoords, strokeColor: "#FF6B00", strokeWeight: 5, strokeOpacity: 0.85, map: gMap,
          });
          gMap.fitBounds(route.bounds, 70);

          animation = animateAlongPath(
            pathCoords,
            9000,
            (point, heading, remainingPath) => {
              if (is3DFleetAvailable()) {
                rickshawFleet.setVehicle("courier", point.lat, point.lng, heading, "e-riksha-parcel", true);
              } else {
                courierMarkerRef.current?.setPosition(point);
              }
              courierRouteRef.current?.setPath(remainingPath);
            },
            finishLeg
          );
        })
        .catch((error) => console.error("Error fetching courier delivery route:", error));
    }

    const fallbackTimer = setTimeout(finishLeg, gMap ? 10000 : 4500);

    return () => {
      disposed = true;
      animation?.cancel();
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myParcel?.trackingId, myParcel?.stage, mapReady]);

  // Notify once the courier reaches the destination and is waiting on the
  // delivery PIN — the PIN itself is confirmed from the receiver's side
  // (Track a Parcel, or the shared /track/:id link), not here.
  useEffect(() => {
    if (myParcel?.stage === "arrived") {
      pushSystemNotification({
        audience: "rider",
        title: "Courier has arrived!",
        message: `Share delivery PIN ${myParcel.deliveryPin} with the receiver to confirm the handoff.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myParcel?.stage]);

  // Stage 1: "searching" — advances to "matched" only once a real driver has
  // actually accepted (trpc.ride.accept, from the driver panel), detected via
  // the getById poll above. No fixed timer — this can take as long as it
  // takes for a real driver to respond, same as it should. Adjusted directly
  // during render — self-terminating, since the guard itself flips false the
  // instant rideFlowStage becomes "matched".
  if (rideFlowStage === "searching" && currentRide?.status === "accepted") {
    setRideFlowStage("matched");
  }

  // Stage 2: "matched" — one-time setup on entering this stage: notify the
  // rider, clear the static pickup→destination preview line (it would
  // otherwise sit underneath the live captain route for the rest of the
  // ride), and record when we matched (cancellation-fee logic uses this).
  useEffect(() => {
    if (rideFlowStage !== "matched") return;
    setMatchedAtMs(Date.now());
    driverArrivedNotifiedRef.current = false;
    routePolylineRef.current?.setMap(null);

    pushSystemNotification({
      audience: "rider",
      title: "Booking Confirmed!",
      message: `${currentRide?.driverName || "Your captain"} is on the way to pick you up${pickup ? ` from ${pickup}` : ""}.`,
    });

    return () => {
      driverMarkerRef.current?.setMap(null);
      driverRouteRef.current?.setMap(null);
      rickshawFleet.removeVehicle("captain");
      lastCaptainPosRef.current = null;
      lastCaptainRouteFetchPosRef.current = null;
      lastCaptainHeadingRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage]);

  // Automatic "driver has arrived" notification — fires once the driver
  // taps "Reached Pickup" on their own screen (trpc.ride.updateStatus with
  // status "pickup", driver panel), detected here via the same getById poll
  // already driving the rest of this stage. Guarded by a ref (not just the
  // status check) so a re-render or extra poll tick while still "pickup"
  // doesn't fire it again.
  useEffect(() => {
    if (rideFlowStage !== "matched" || currentRide?.status !== "pickup" || driverArrivedNotifiedRef.current) return;
    driverArrivedNotifiedRef.current = true;
    pushSystemNotification({
      audience: "rider",
      title: "Your captain has arrived!",
      message: `${currentRide?.driverName || "Your captain"} is at the pickup point${pickup ? ` (${pickup})` : ""} — head out and share your OTP to start the ride.`,
    });
  }, [rideFlowStage, currentRide?.status, currentRide?.driverName, pickup]);

  // Route Restriction system — a "rerouted" notice is transient (shown as a
  // toast-style banner for ~15s, since it's just informational: an
  // alternative was already found and applied). "no_alternative" instead
  // renders persistently for as long as the ride carries that notice — see
  // the RouteRestrictionBanner render below — because that's the one case
  // that must never be silently missed.
  const [transientRestrictionNotice, setTransientRestrictionNotice] = useState<"rerouted" | null>(null);
  useEffect(() => {
    const noticeAt = currentRide?.routeRestrictionNoticeAt ? new Date(currentRide.routeRestrictionNoticeAt).getTime() : null;
    if (!noticeAt || noticeAt === lastSeenRestrictionNoticeAtRef.current) return;
    lastSeenRestrictionNoticeAtRef.current = noticeAt;

    const notice = currentRide?.routeRestrictionNotice;
    pushSystemNotification({
      audience: "rider",
      title: notice === "no_alternative" ? "No Alternative Route" : "Route Changed",
      message:
        notice === "no_alternative"
          ? "The road ahead is blocked and we couldn't find another way. Please contact support."
          : "Your driver is taking an alternative route.",
    });
    if (notice === "rerouted") {
      setTransientRestrictionNotice("rerouted");
      const timer = setTimeout(() => setTransientRestrictionNotice(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [currentRide?.routeRestrictionNoticeAt, currentRide?.routeRestrictionNotice]);

  // Real captain tracking — feeds the driver's actual polled GPS position
  // (from currentRide.driverLat/driverLng, refreshed every 2s by the getById
  // poll above) into the map, instead of a scripted animation from a made-up
  // start point. The road route/ETA only re-fetch once the driver has
  // actually moved a meaningful distance, so a stationary captain doesn't
  // hammer the Directions API every poll.
  useEffect(() => {
    if (rideFlowStage !== "matched") return;
    const lat = currentRide?.driverLat ? parseFloat(currentRide.driverLat) : null;
    const lng = currentRide?.driverLng ? parseFloat(currentRide.driverLng) : null;
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const gMap = map.current;
    const position: google.maps.LatLngLiteral = { lat, lng };
    const heading = resolveHeading({
      previous: lastCaptainPosRef.current,
      current: position,
      previousHeading: lastCaptainHeadingRef.current,
    });
    lastCaptainPosRef.current = position;
    lastCaptainHeadingRef.current = heading;

    // Women-only bookings always show the woman-driver e-rickshaw regardless
    // of ride type; otherwise it follows what was actually booked.
    const captainModelType: VehicleModelType = womenOnly
      ? "e-riksha-woman"
      : selectedRideType === "auto"
      ? "auto-rickshaw"
      : "e-riksha";
    const is3DFleetAvailable = rickshawFleet.isAvailableRef.current === true;

    if (is3DFleetAvailable) {
      rickshawFleet.setVehicle("captain", lat, lng, heading, captainModelType);
    } else if (gMap) {
      // 2D marker is the guaranteed fallback for maps without WebGLOverlayView
      // support (e.g. no Vector Map ID configured) — only shown when 3D isn't available.
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new google.maps.Marker({ position, map: gMap, icon: createDriverIcon() });
      } else {
        driverMarkerRef.current.setPosition(position);
      }
    }

    const lastFetchPos = lastCaptainRouteFetchPosRef.current;
    const movedKm = lastFetchPos
      ? Math.sqrt((lastFetchPos.lat - lat) ** 2 + (lastFetchPos.lng - lng) ** 2) * 111
      : Infinity;
    if (!gMap || movedKm < 0.05) return;
    lastCaptainRouteFetchPosRef.current = position;

    let cancelled = false;
    fetchSafeRoute(trpcUtils, position, pickupCoords)
      .then((route) => {
        if (cancelled || !route || "noAlternative" in route) return;
        const pathCoords = route.path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
        driverRouteRef.current?.setMap(null);
        driverRouteRef.current = new google.maps.Polyline({
          path: pathCoords, strokeColor: "#FF6B00", strokeWeight: 4, strokeOpacity: 0.8, map: gMap,
        });
        gMap.fitBounds(route.bounds, 60);
        setDriverDistanceKm(Math.max(0.1, Math.round(route.distanceKm * 10) / 10));
        setDriverEtaMin(Math.max(1, Math.round(route.durationMin)));
      })
      .catch((error) => console.error("Error fetching driver route:", error));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage, currentRide?.driverLat, currentRide?.driverLng]);

  // Real "matched" -> "in_ride" transition — fires once the driver has
  // actually verified the pickup OTP (trpc.ride.verifyOtp, driver panel),
  // which flips the real ride's status to "ongoing". Adjusted directly
  // during render, same self-terminating pattern as stage 1 above.
  if (rideFlowStage === "matched" && currentRide?.status === "ongoing") {
    setRideFlowStage("in_ride");
  }

  // Stage 3: "in_ride" — animate the vehicle from pickup to destination, then
  // hand off to the payment screen once it "arrives". Same map-independent
  // fallback guarantee as stage 2.
  // One-time setup on entering "in_ride": clear whatever the matched-stage
  // left on the map. Real tracking (below) takes over from here.
  useEffect(() => {
    if (rideFlowStage !== "in_ride") return;
    driverMarkerRef.current?.setMap(null);
    driverRouteRef.current?.setMap(null);
    lastCaptainPosRef.current = null;
    lastCaptainRouteFetchPosRef.current = null;
    lastCaptainHeadingRef.current = 0;

    return () => {
      driverMarkerRef.current?.setMap(null);
      driverRouteRef.current?.setMap(null);
      rickshawFleet.removeVehicle("captain");
      lastCaptainPosRef.current = null;
      lastCaptainRouteFetchPosRef.current = null;
      lastCaptainHeadingRef.current = 0;
    };
  }, [rideFlowStage]);

  // Real in-ride tracking — same real-GPS approach as the matched stage
  // above, just routing to the destination instead of the pickup point.
  // Replaces the old scripted pickup->destination animation, which ran on a
  // fixed timer regardless of where the real vehicle actually was.
  useEffect(() => {
    if (rideFlowStage !== "in_ride" || !destinationCoords) return;
    const lat = currentRide?.driverLat ? parseFloat(currentRide.driverLat) : null;
    const lng = currentRide?.driverLng ? parseFloat(currentRide.driverLng) : null;
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const gMap = map.current;
    const position: google.maps.LatLngLiteral = { lat, lng };
    const heading = resolveHeading({
      previous: lastCaptainPosRef.current,
      current: position,
      previousHeading: lastCaptainHeadingRef.current,
    });
    lastCaptainPosRef.current = position;
    lastCaptainHeadingRef.current = heading;

    const captainModelType: VehicleModelType = womenOnly
      ? "e-riksha-woman"
      : selectedRideType === "auto"
      ? "auto-rickshaw"
      : "e-riksha";
    const is3DFleetAvailable = rickshawFleet.isAvailableRef.current === true;

    if (is3DFleetAvailable) {
      rickshawFleet.setVehicle("captain", lat, lng, heading, captainModelType);
    } else if (gMap) {
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new google.maps.Marker({ position, map: gMap, icon: createNavigationVehicleIcon(heading) });
      } else {
        driverMarkerRef.current.setIcon(createNavigationVehicleIcon(heading));
        driverMarkerRef.current.setPosition(position);
      }
    }

    const lastFetchPos = lastCaptainRouteFetchPosRef.current;
    const movedKm = lastFetchPos
      ? Math.sqrt((lastFetchPos.lat - lat) ** 2 + (lastFetchPos.lng - lng) ** 2) * 111
      : Infinity;
    if (!gMap || movedKm < 0.05) return;
    lastCaptainRouteFetchPosRef.current = position;

    let cancelled = false;
    fetchSafeRoute(trpcUtils, position, destinationCoords)
      .then((route) => {
        if (cancelled || !route || "noAlternative" in route) return;
        const pathCoords = route.path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
        driverRouteRef.current?.setMap(null);
        driverRouteRef.current = new google.maps.Polyline({
          path: pathCoords, strokeColor: "#138808", strokeWeight: 5, strokeOpacity: 0.85, map: gMap,
        });
        gMap.fitBounds(route.bounds, 60);
        setDriverDistanceKm(Math.max(0, Math.round(route.distanceKm * 10) / 10));
        setDriverEtaMin(Math.max(0, Math.round(route.durationMin)));
      })
      .catch((error) => console.error("Error fetching in-ride route:", error));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage, currentRide?.driverLat, currentRide?.driverLng]);

  // Real "in_ride" -> completed hand-off — fires once the driver has actually
  // ended the trip (trpc.ride.updateStatus({status:"completed"}), driver
  // panel), not on a fixed animation timer. Stays right here in the home
  // sheet instead of navigating to a separate payment page.
  useEffect(() => {
    if (rideFlowStage !== "in_ride") return;
    if (currentRide?.status === "completed") {
      rideEndedMutation.mutate();
      setRideFlowStage("completed");
      setSheetState("full");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage, currentRide?.status]);

  // Cash needs no rider action to move to "pending" — the method was already
  // chosen back on the vehicle-selection sheet, so the instant the ride is
  // complete this fires confirmPayment itself (status starts "pending" until
  // the driver taps "Cash Received"). UPI/wallet still wait for an explicit
  // Pay tap below, since those actually move money right away.
  useEffect(() => {
    if (rideFlowStage !== "completed" || currentRideId === null) return;
    if (currentRide?.paymentMethod !== "cash") return;
    if (currentRidePayment) return; // already confirmed (or settling)
    if (cashAutoConfirmedForRideRef.current === currentRideId) return;
    cashAutoConfirmedForRideRef.current = currentRideId;
    confirmRidePaymentMutation.mutate({ rideId: currentRideId, method: "cash" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage, currentRideId, currentRide?.paymentMethod, currentRidePayment]);

  // Once payment has actually settled, the Trip Completed panel clears
  // itself back to a blank home screen after 10s if the rider doesn't tap
  // Home first — restarts if they open the rate/tip popup, so it doesn't
  // yank the panel away mid-interaction.
  useEffect(() => {
    if (rideFlowStage !== "completed" || currentRidePayment?.status !== "completed") return;
    if (showRatePopup || showTipPopup) return;
    const timer = setTimeout(resetToIdleAfterTrip, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideFlowStage, currentRidePayment?.status, showRatePopup, showTipPopup]);

  const toggleMapView = () => toggleTileView(map.current);

  const handleVoiceSearch = async () => {
    setVoiceError("");
    setIsListening(true);
    try {
      const transcript = await listenOnce(voiceLang);
      setDestination(transcript);

      if (!geocoderRef.current) return;
      geocoderRef.current.geocode({ address: transcript }, (results, status) => {
        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          setVoiceError(`${t("home.couldntFind")} "${transcript}"`);
          return;
        }

        const location = results[0].geometry.location;
        const coords = { lat: location.lat(), lng: location.lng() };
        setDestination(results[0].formatted_address || transcript);
        setDestinationCoords(coords);

        if (map.current) {
          destinationMarkerRef.current?.setMap(null);
          destinationMarkerRef.current = new google.maps.Marker({
            position: coords,
            map: map.current,
            icon: createDestinationIcon(),
          });
          getRoute(pickupCoordsRef.current, coords);
        }
      });
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Voice search failed");
    } finally {
      setIsListening(false);
    }
  };

  const handlePickupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickup(e.target.value);
  };

  // Ranks by actual distance from the pickup point instead of Google's
  // relevance/prominence ranking — see searchPlacesNearby in googlePlaces.ts
  // for why plain Autocomplete wasn't good enough for bare category words.
  const runDestinationSearch = async (query: string) => {
    const mySeq = ++destinationSearchSeqRef.current;
    setIsSearchingDestination(true);
    try {
      const results = await searchPlacesNearby(query, pickupCoordsRef.current);
      if (mySeq !== destinationSearchSeqRef.current) return;
      setDestinationSearchResults(results);
    } catch (error) {
      console.error("Error searching destinations:", error);
      if (mySeq === destinationSearchSeqRef.current) setDestinationSearchResults([]);
    } finally {
      if (mySeq === destinationSearchSeqRef.current) setIsSearchingDestination(false);
    }
  };

  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDestination(value);
    setShowRecentDropdown(true);
    if (destinationSearchTimerRef.current) clearTimeout(destinationSearchTimerRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      destinationSearchSeqRef.current++;
      setIsSearchingDestination(false);
      setDestinationSearchResults([]);
      return;
    }
    destinationSearchTimerRef.current = setTimeout(() => runDestinationSearch(trimmed), 300);
  };

  useEffect(() => {
    return () => {
      if (destinationSearchTimerRef.current) clearTimeout(destinationSearchTimerRef.current);
    };
  }, []);

  const selectDestinationSearchResult = (place: PlaceSearchResult) => {
    applyDestination({ lat: place.lat, lng: place.lng }, place.name);
    setDestinationSearchResults([]);
    setShowRecentDropdown(false);
  };

  const applyDestination = (coords: google.maps.LatLngLiteral, name: string) => {
    setDestination(name);
    setDestinationCoords(coords);
    if (map.current) {
      destinationMarkerRef.current?.setMap(null);
      destinationMarkerRef.current = new google.maps.Marker({ position: coords, map: map.current, icon: createDestinationIcon() });
      getRoute(pickupCoordsRef.current, coords);
    }
  };

  // "Home"/"Office" reuse the rider's actual Saved Places (set from
  // UserProfile.tsx) when available, instead of always doing a fresh
  // landmark-name geocode search.
  const AI_SUGGESTION_TO_SAVED_NAME: Partial<Record<string, "Home" | "Work">> = { Home: "Home", Office: "Work" };

  const handleAiSuggestion = (label: string) => {
    setDestination(label);
    const savedName = AI_SUGGESTION_TO_SAVED_NAME[label];
    const saved = savedName ? savedPlacesList.find((p) => p.name === savedName) : undefined;
    if (saved) {
      applyDestination({ lat: Number(saved.lat), lng: Number(saved.lng) }, saved.address);
      return;
    }
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ address: `${label} near ${pickup}` }, (results, status) => {
      let coords: google.maps.LatLngLiteral;
      let name: string;
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const location = results[0].geometry.location;
        coords = { lat: location.lat(), lng: location.lng() };
        name = results[0].formatted_address || label;
      } else {
        // Graceful fallback: simulate a nearby landmark so the flow still works offline / without geocode quota.
        coords = { lat: pickupCoords.lat + 0.01, lng: pickupCoords.lng + 0.01 };
        name = label;
      }
      applyDestination(coords, name);
    });
  };

  // Wingman parses a booking request out of the chat/voice conversation and
  // hands back just the destination text — reuse the same geocode-and-route
  // path as the AI suggestion chips so the fare sheet opens the same way.
  const handleBookRideFromAi = (destination: string) => {
    setShowAiChat(false);
    if (mode !== "ride") setMode("ride");
    handleAiSuggestion(destination);
  };

  const handleRideTypeSelect = (rideType: (typeof visibleRideTypes)[number]) => {
    setSelectedRideType(rideType.id);
    if (rideType.path) navigate(rideType.path);
  };

  const parcelEstimate: ParcelEstimate = estimateParcelDelivery(
    parcelSize,
    Number(parcelWeight) || 0,
    destinationCoords ? routeInfo.distance || 3 : 3,
    parcelFragile,
    parcelInstant
  );

  const handleBookParcel = () => {
    if (!pickup || !destination || !destinationCoords || parcelSearching) return;
    setParcelSearching(true);
    setTimeout(() => {
      setParcelSearching(false);
      bookParcelMutation.mutate({
        pickup,
        destination,
        pickupCoords,
        destinationCoords,
        category: parcelSize,
        weightKg: Number(parcelWeight) || 0,
        fragile: parcelFragile,
        notes: parcelNotes,
        cost: parcelEstimate.cost,
        paidBy: parcelPaidBy,
      });
    }, 2200);
  };

  const handleStartNewParcel = () => {
    setParcelTrackingId(null);
    setParcelNotes("");
    setParcelWalletError("");
  };

  const handleShareParcelTrackingWhatsApp = () => {
    if (!myParcel) return;
    const link = `${window.location.origin}/track/${myParcel.trackingId}`;
    const text =
      `Track my Ridepay parcel delivery!\n` +
      `Tracking ID: ${myParcel.trackingId}\n` +
      `Delivery PIN (give this to the courier once your parcel arrives): ${myParcel.deliveryPin}\n` +
      `${link}`;
    const openWhatsAppFallback = () =>
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");

    // Prefer the device's native share sheet (lets the sender pick WhatsApp,
    // SMS, email, or anything else installed) — falls back to opening
    // wa.me directly when Web Share isn't available at all, or when it IS
    // present but fails for a reason other than the user just cancelling
    // (some wrapped WebViews expose navigator.share without the host app
    // actually implementing the share intent, which rejects immediately).
    if (navigator.share) {
      navigator.share({ title: "Ridepay Parcel Tracking", text }).catch((error) => {
        if (error?.name !== "AbortError") openWhatsAppFallback();
      });
    } else {
      openWhatsAppFallback();
    }
  };

  const handleShareTrip = () => {
    if (currentRideId === null) return;
    const link = `${window.location.origin}/trip/live/${currentRideId}`;
    const text = `Track my Ridepay trip live: ${link}`;
    const openWhatsAppFallback = () =>
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");

    if (navigator.share) {
      navigator.share({ title: "Track my Ridepay trip", text }).catch((error) => {
        if (error?.name !== "AbortError") openWhatsAppFallback();
      });
    } else {
      openWhatsAppFallback();
    }
  };

  const handleTrackParcel = () => {
    const code = trackCodeInput.trim().toUpperCase();
    if (!code) return;
    setTrackedCode(code);
    setPinInput("");
    setPinError("");
  };

  const handleConfirmParcelPin = () => {
    if (!trackedCode || !pinInput.trim()) return;
    confirmParcelDeliveryMutation.mutate(
      { trackingId: trackedCode, pin: pinInput.trim() },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setPinError(result.error);
            return;
          }
          setPinError("");
          trpcUtils.parcel.getByTrackingId.invalidate({ trackingId: trackedCode });
        },
      }
    );
  };

  const handleMyParcelPayment = (method: "cash" | "upi" | "wallet") => {
    if (!parcelTrackingId || !myParcel) return;
    const trackingId = parcelTrackingId;
    const cost = myParcel.cost;
    const finish = () => {
      setParcelWalletError("");
      submitParcelPaymentMutation.mutate({ trackingId, method });
      if (method === "upi") {
        window.location.href = `upi://pay?pa=ridepay@okhdfc&pn=Ridepay&am=${cost}&cu=INR&tn=ParcelDelivery`;
      }
    };
    if (method === "wallet") {
      debitWalletMutation.mutate(
        { walletType: "customer", ownerId: customerName, amount: cost, description: `Parcel delivery ${trackingId}` },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setParcelWalletError(t("home.insufficientWalletMethod"));
              return;
            }
            finish();
          },
        }
      );
      return;
    }
    finish();
  };

  const handleTrackedParcelPayment = (method: "cash" | "upi" | "wallet") => {
    if (!trackedCode || !trackedParcel) return;
    const trackingId = trackedCode;
    const cost = trackedParcel.cost;
    const finish = () => {
      setParcelWalletError("");
      submitParcelPaymentMutation.mutate({ trackingId, method });
      if (method === "upi") {
        window.location.href = `upi://pay?pa=ridepay@okhdfc&pn=Ridepay&am=${cost}&cu=INR&tn=ParcelDelivery`;
      }
    };
    if (method === "wallet") {
      debitWalletMutation.mutate(
        { walletType: "customer", ownerId: customerName, amount: cost, description: `Parcel delivery ${trackingId}` },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setParcelWalletError(t("home.insufficientWalletMethod"));
              return;
            }
            finish();
          },
        }
      );
      return;
    }
    finish();
  };

  // Shared by both the sender's own booking card and the Track-a-Parcel
  // receiver view — whichever side is assigned as payer sees the same picker.
  // Each button pays immediately on tap (no separate "select then confirm"
  // step) since there's nothing more to configure per method.
  const renderParcelPaymentPicker = (cost: number, onPay: (method: "cash" | "upi" | "wallet") => void, pendingMethod: "cash" | "upi" | "wallet" | null) => (
    <>
      <div className="grid grid-cols-3 gap-2">
        {(["cash", "upi", "wallet"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onPay(m)}
            disabled={pendingMethod !== null}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium bg-gray-100 dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-50 transition-colors"
          >
            {pendingMethod === m ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
            ) : m === "cash" ? (
              <IndianRupee className="w-3.5 h-3.5" />
            ) : m === "upi" ? (
              <Smartphone className="w-3.5 h-3.5" />
            ) : (
              <Wallet className="w-3.5 h-3.5" />
            )}
            {m === "cash" ? "Cash" : m === "upi" ? "UPI (Scan)" : "Wallet"}
          </button>
        ))}
      </div>
      {parcelWalletError && <p className="text-xs text-[#DC2626] text-center">{parcelWalletError}</p>}
      <p className="text-[10px] text-center text-[#9CA3AF]">Tap a method to pay ₹{cost}</p>
    </>
  );

  const handleSearchDestination = () => {
    if (!destination || !destinationCoords) return;
    if (!showFareSheet) getRoute(pickupCoords, destinationCoords);
  };

  // Reads the already server-computed quote for this option — the seat
  // scaling for Share, the ride-type multiplier, and the AI-boost are all
  // applied server-side inside fareQuoteFor()'s underlying query.
  const computeRidePrice = (option: (typeof RIDE_OPTIONS)[number]) => fareQuoteFor(option.id)?.total ?? 0;
  const computeNormalRidePrice = (option: (typeof RIDE_OPTIONS)[number]) => fareQuoteFor(option.id)?.normalTotal ?? 0;
  // Admin can switch a vehicle off from Fare Configuration — hide the ride
  // options that would dispatch it rather than letting someone book a
  // vehicle type that's currently disabled.
  const availableRideOptions = RIDE_OPTIONS.filter((o) =>
    o.id === "auto"
      ? isVehicleEnabled("auto-rickshaw", "auto")
      : isVehicleEnabled(womenOnly ? "e-riksha-woman" : "e-riksha", o.id === "share" ? "share" : "reserve")
  );

  useEffect(() => {
    if (availableRideOptions.length > 0 && !availableRideOptions.some((o) => o.id === selectedRideType)) {
      setSelectedRideType(availableRideOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableRideOptions.map((o) => o.id).join(","), selectedRideType]);

  // Confirms the selected ride type and kicks off the inline searching →
  // matched → in-ride sequence entirely within the home bottom sheet.
  const handleConfirmBooking = () => {
    if (!destinationCoords) return;
    const selectedOption = RIDE_OPTIONS.find((o) => o.id === selectedRideType) ?? RIDE_OPTIONS[0];
    const quote = fareQuoteFor(selectedOption.id);
    setConfirmedFare(computeRidePrice(selectedOption));
    setBookedVehicleType(deriveFareVehicleId(fareVehicleFor(selectedOption.id), selectedOption.id));
    setMatchedAtMs(null);
    rideStartedMutation.mutate();
    // Only actually consumes the coupon's usage count once a ride is really
    // booked — the fare-sheet preview above validates it on every keystroke
    // without ever redeeming it.
    if (appliedCouponCode && quote && quote.couponDiscount > 0) {
      // isFirstRide is resolved server-side from the real signed-in rider
      // (coupon-router.ts's redeem procedure) — not sent from here.
      redeemCouponMutation.mutate({
        code: appliedCouponCode,
        bookingAmount: quote.total + quote.couponDiscount,
        vehicleType: fareVehicleFor(selectedOption.id),
      });
    }
    // Real ride, real fare (same vehicleType/segment inputs the fare-sheet
    // quote above was computed from, so what's booked always matches what
    // was shown) — a real driver panel is what actually moves this out of
    // "searching", not a timer.
    bookRideMutation.mutate(
      {
        pickupLat: pickupCoords.lat.toString(),
        pickupLng: pickupCoords.lng.toString(),
        pickupAddress: pickup,
        dropLat: destinationCoords.lat.toString(),
        dropLng: destinationCoords.lng.toString(),
        dropAddress: destination,
        vehicleType: fareVehicleFor(selectedOption.id),
        segment: selectedOption.id,
        seats: selectedOption.id === "share" ? seats : 1,
        aiMultiplier,
        couponCode: appliedCouponCode ?? undefined,
        preferredPaymentMethod: selectedPaymentMethod,
      },
      {
        onSuccess: (ride) => {
          setCurrentRideId(ride.id);
          setRideFlowStage("searching");
          setSheetState("half");
          setShowPaymentPicker(false);
        },
        onError: () => showToast(t("home.couldntBookRide")),
      }
    );
  };

  const handleApplyCoupon = () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    setAppliedCouponCode(code);
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(null);
    setCouponCodeInput("");
  };

  const showToast = (message: string) => {
    setActionToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setActionToast(null), 2200);
  };

  // Pay button on the Trip Completed panel — only reachable for UPI/wallet
  // (cash never shows this button, see the auto-confirm effect above).
  const handlePayForCompletedRide = async () => {
    if (currentRideId === null || !currentRide) return;
    const total = Number(currentRide.totalFare);

    if (currentRide.paymentMethod === "wallet") {
      debitWalletMutation.mutate(
        { walletType: "customer", ownerId: customerName, amount: total, description: `Ride fare${currentRide.dropAddress ? ` to ${currentRide.dropAddress}` : ""}` },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setWalletError(t("home.insufficientWalletMethod"));
              return;
            }
            setWalletError("");
            confirmRidePaymentMutation.mutate({ rideId: currentRideId, method: "wallet" });
          },
        }
      );
      return;
    }

    // UPI/card — a real Razorpay order sized from the ride's actual fare,
    // paid through Razorpay's own checkout, then verified server-side before
    // it's ever recorded as paid.
    setRazorpayError("");
    try {
      const order = await createPaymentOrderMutation.mutateAsync({ rideId: currentRideId });
      setCheckoutOpen(true);
      await openRazorpayCheckout({
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Ridepay",
        description: "Ride fare",
        prefill: { name: customerName, contact: user?.phone ?? undefined, email: user?.email ?? undefined },
        onSuccess: async (result) => {
          try {
            const verified = await verifyRazorpayPaymentMutation.mutateAsync(result);
            confirmRidePaymentMutation.mutate({ rideId: currentRideId, method: "upi", razorpayPaymentId: verified.paymentId });
          } catch {
            setRazorpayError(t("wallet.verifyFailed"));
          } finally {
            setCheckoutOpen(false);
          }
        },
        onDismiss: () => setCheckoutOpen(false),
        onFailure: (message) => {
          setCheckoutOpen(false);
          setRazorpayError(message);
        },
      });
    } catch {
      setCheckoutOpen(false);
      setRazorpayError(t("wallet.startFailed"));
    }
  };

  const handleRateCaptain = (stars: number) => {
    setRating(stars);
  };

  const handleSubmitRating = () => {
    if (currentRideId === null || rating === 0) return;
    rateRideMutation.mutate({ id: currentRideId, rating, review: ratingReview.trim() || undefined });
    setShowRatePopup(false);
  };

  const handleSendTip = (amount: number) => {
    if (currentRideId === null || amount <= 0) return;
    tipDriverMutation.mutate({ rideId: currentRideId, amount });
  };

  // Real .pdf, generated client-side — jsPDF's default fonts don't carry a
  // ₹ glyph (renders as a box), so amounts use "Rs." the way most PDF
  // invoices from apps without a bundled Unicode font do.
  const handleDownloadInvoicePdf = () => {
    if (!currentRide || currentRideId === null) return;
    const total = Number(currentRide.totalFare);
    const discount = Number(currentRide.discount);
    const fareBeforeDiscount = total + discount;

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(255, 107, 0);
    doc.text("Ridepay", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text("Har Safar, Assaan Safar", 14, 26);
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 46);
    doc.text("INVOICE", 196, 20, { align: "right" });
    doc.setFontSize(10);
    doc.text(`RIDE-${currentRideId}`, 196, 26, { align: "right" });
    doc.text(new Date().toLocaleDateString("en-IN"), 196, 31, { align: "right" });
    doc.setDrawColor(255, 107, 0);
    doc.setLineWidth(0.8);
    doc.line(14, 36, 196, 36);

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text("BILLED TO", 14, 46);
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 46);
    doc.text(customerName || "Rider", 14, 52);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(currentRide.dropAddress ? `Trip to ${currentRide.dropAddress}` : "Ride invoice", 14, 57);

    let y = 72;
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 46);
    doc.text("Description", 14, y);
    doc.text("Amount", 196, y, { align: "right" });
    doc.setDrawColor(26, 26, 46);
    doc.line(14, y + 2, 196, y + 2);
    y += 10;
    doc.text("Ride fare", 14, y);
    doc.text(`Rs. ${fareBeforeDiscount.toFixed(2)}`, 196, y, { align: "right" });
    if (discount > 0) {
      y += 8;
      doc.text("Discount", 14, y);
      doc.text(`- Rs. ${discount.toFixed(2)}`, 196, y, { align: "right" });
    }
    y += 12;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total", 150, y);
    doc.text(`Rs. ${total.toFixed(2)}`, 196, y, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Distance: ${Number(currentRide.distance).toFixed(1)} km   Duration: ${currentRide.estimatedTime} min   Paid by: ${currentRide.paymentMethod ?? "-"}`,
      14,
      y
    );

    doc.save(`invoice-ride-${currentRideId}.pdf`);
  };

  // Resets the whole ride-flow back to a blank home screen — used by both
  // the Trip Completed panel's "Home" button and its 10s auto-close timer.
  const resetToIdleAfterTrip = () => {
    setRideFlowStage("idle");
    setCurrentRideId(null);
    setMatchedAtMs(null);
    setDestination("");
    setDestinationCoords(null);
    setShowFareSheet(false);
    setShowPaymentPicker(false);
    setShowRatePopup(false);
    setShowTipPopup(false);
    setRating(0);
    setRatingReview("");
    setTipAmount(null);
    setCustomTip("");
    setTipSentAmount(null);
    setSheetState("peek");
    destinationMarkerRef.current?.setMap(null);
    routePolylineRef.current?.setMap(null);
  };

  // Opens the reason picker for either the "searching" or "matched" stage —
  // the actual cancellation only completes once a reason is confirmed.
  const handleRequestCancel = () => {
    setSelectedCancelReason(null);
    setCustomCancelReason("");
    setShowCancelSheet(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedCancelReason) return;
    const reasonText = selectedCancelReason === OTHER_CANCEL_REASON ? customCancelReason.trim() : selectedCancelReason;
    if (!reasonText) return;

    const stage = rideFlowStage === "matched" ? "matched" : "searching";

    // A driver's only been assigned once the flow reaches "matched" — only then is there
    // someone on the other end to notify that the rider backed out, and only
    // then can a cancellation fee apply at all.
    if (stage === "matched") {
      pushSystemNotification({
        audience: "driver",
        title: "Ride Cancelled",
        message: `The rider has cancelled the ride. Reason: ${reasonText}`,
      });
    }

    recordCancellationMutation.mutate(
      {
        vehicleType: bookedVehicleType,
        stage,
        initiator: "rider",
        reason: reasonText,
        riderName: customerName,
        driverName: stage === "matched" ? currentRide?.driverName || undefined : undefined,
        fareAmount: confirmedFare,
        matchedAtMs,
      },
      {
        onSuccess: (record) => {
          showToast(
            record.feeCharged > 0
              ? `${t("home.rideCancelledFeeApplied")} ₹${record.feeCharged} ${t("home.cancellationFee")}`
              : t("home.rideCancelledNoFee")
          );
          if (record.feeCharged > 0) {
            pushSystemNotification({
              audience: "rider",
              title: "Cancellation fee charged",
              message: `₹${record.feeCharged} was deducted from your wallet for cancelling after your Captain was dispatched.`,
            });
          }
        },
        onError: () => showToast(t("home.rideCancelled")),
      }
    );

    rideEndedMutation.mutate();
    setShowCancelSheet(false);
    setSelectedCancelReason(null);
    setCustomCancelReason("");

    // Wait for the server to actually confirm the cancellation before
    // resetting local ride state — resetting immediately (fire-and-forget)
    // let getCurrent's refetch (triggered the instant rideFlowStage flips
    // back to "idle") race the cancel mutation's own request. If getCurrent
    // won that race, it would still see the ride as "searching" and the
    // idle-resync effect below would snap the UI right back into the
    // searching screen, making cancel look like it silently failed.
    const resetToIdle = () => {
      setRideFlowStage("idle");
      setMatchedAtMs(null);
      setCurrentRideId(null);
    };
    if (currentRideId !== null) {
      cancelRideMutation.mutate({ id: currentRideId }, { onSuccess: resetToIdle, onError: resetToIdle });
    } else {
      resetToIdle();
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast(t("home.geolocationNotSupported"));
      return;
    }
    // Browsers only allow the Geolocation API on HTTPS or http://localhost —
    // any other plain-HTTP origin (e.g. a LAN IP like http://192.168.x.x) is
    // silently blocked, which otherwise looks identical to "not working".
    if (!window.isSecureContext) {
      showToast(t("home.locationNeedsHttps"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setPickupCoords(coords);
        reverseGeocode(coords);
        updatePickupMarker(coords);
        showToast(t("home.locationUpdated"));
      },
      (error) => {
        console.warn("Error getting current location:", error.message);
        const message =
          error.code === error.PERMISSION_DENIED
            ? t("home.locationPermissionDenied")
            : t("home.locationAccessFailed");
        showToast(message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  };

  const startBannerTimer = () => {
    if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
    if (visiblePromoSlides.length < 2) return;
    bannerTimerRef.current = setInterval(() => {
      setBannerIndex((i) => (i + 1) % visiblePromoSlides.length);
    }, 4000);
  };

  useEffect(() => {
    startBannerTimer();
    return () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePromoSlides.length]);

  const goToBanner = (i: number) => {
    if (visiblePromoSlides.length === 0) return;
    setBannerIndex((i + visiblePromoSlides.length) % visiblePromoSlides.length);
    startBannerTimer();
  };

  const handleBannerPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    bannerDragRef.current = { startX: e.clientX, active: true };
  };
  const handleBannerPointerUp = (e: React.PointerEvent) => {
    if (!bannerDragRef.current.active) return;
    const delta = e.clientX - bannerDragRef.current.startX;
    bannerDragRef.current.active = false;
    if (delta < -40) goToBanner(bannerIndex + 1);
    else if (delta > 40) goToBanner(bannerIndex - 1);
  };
  const handlePromoSlideClick = (slide: PromoSlide) => {
    if (slide.destination === "#parcel") setMode("parcel");
    else if (slide.destination) navigate(slide.destination);
  };

  const SHEET_ORDER: Array<"min" | "peek" | "half" | "full"> = ["min", "peek", "half", "full"];
  const cycleSheet = (direction: 1 | -1) => {
    const idx = SHEET_ORDER.indexOf(sheetState);
    setSheetState(SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, Math.max(0, idx + direction))]);
  };
  const handleSheetPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    sheetDragRef.current = { startY: e.clientY, active: true };
  };
  const handleSheetPointerMove = (e: React.PointerEvent) => {
    if (!sheetDragRef.current.active) return;
    setSheetDragPx(e.clientY - sheetDragRef.current.startY);
  };
  const handleSheetPointerUp = (e: React.PointerEvent) => {
    if (!sheetDragRef.current.active) return;
    const delta = e.clientY - sheetDragRef.current.startY;
    sheetDragRef.current.active = false;
    setSheetDragPx(0);
    if (delta < -40) cycleSheet(1);
    else if (delta > 40) cycleSheet(-1);
  };

  const activePlan = plans.find((p) => p.active && p.id !== "free");
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const adSlide = activeCampaigns.length > 0 ? activeCampaigns[adSlideIndex % activeCampaigns.length] : null;

  const startAdBannerTimer = () => {
    if (adBannerTimerRef.current) clearInterval(adBannerTimerRef.current);
    if (activeCampaigns.length < 2) return;
    adBannerTimerRef.current = setInterval(() => {
      setAdSlideIndex((i) => (i + 1) % activeCampaigns.length);
    }, 5000);
  };

  useEffect(() => {
    startAdBannerTimer();
    return () => {
      if (adBannerTimerRef.current) clearInterval(adBannerTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaigns.length]);

  const goToAdBanner = (i: number) => {
    if (activeCampaigns.length === 0) return;
    setAdSlideIndex((i + activeCampaigns.length) % activeCampaigns.length);
    startAdBannerTimer();
  };
  const handleAdBannerPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    adBannerDragRef.current = { startX: e.clientX, active: true };
  };
  const handleAdBannerPointerUp = (e: React.PointerEvent) => {
    if (!adBannerDragRef.current.active) return;
    const delta = e.clientX - adBannerDragRef.current.startX;
    adBannerDragRef.current.active = false;
    if (delta < -40) goToAdBanner(adSlideIndex + 1);
    else if (delta > 40) goToAdBanner(adSlideIndex - 1);
  };

  const sheetMaxHeight =
    rideFlowStage === "in_ride"
      ? sheetState === "full" ? "70vh" : sheetState === "half" ? "48vh" : "92px"
    : rideFlowStage === "matched"
      ? sheetState === "full" ? "82vh" : sheetState === "half" ? "58vh" : "150px"
    // Trip Completed reclaims the bottom nav's space too (also hidden while
    // this panel is up), same as vehicle selection below.
    : rideFlowStage === "completed"
      ? sheetState === "full" ? "88vh" : sheetState === "half" ? "76vh" : "150px"
    : rideFlowStage === "searching" ? "42vh"
    // Vehicle selection reclaims the bottom nav's space (hidden while this
    // panel is up), so it gets the extra room the "76px" -> "16px" bottom
    // offset shift frees up.
    : mode === "ride" && showFareSheet
      ? sheetState === "full" ? "88vh" : sheetState === "half" ? "76vh" : "66px"
    : sheetState === "full" ? "82vh"
    : sheetState === "half" ? "62vh"
    : sheetState === "min" ? "66px"
    : mode === "parcel" ? "300px" : "290px";

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A] relative overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />
      {mapLoadError && <MapUnavailable />}

      {/* Action feedback toast (confirms Locate Me / Recenter taps registered) */}
      {actionToast && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 bg-[#1A1A2E]/90 dark:bg-white/90 text-white dark:text-[#1A1A2E] text-xs font-medium px-4 py-2 rounded-full shadow-lg whitespace-nowrap animate-slide-up"
          style={{ top: `${rideFlowStage === "in_ride" ? 16 : headerHeight + 24}px` }}
        >
          {actionToast}
        </div>
      )}

      {/* Floating utility buttons — SOS, locate-me, compass (reset map bearing
          to north), theme toggle — always visible so the map stays clear. */}
      <div
        className={`absolute right-4 z-20 flex flex-col items-end gap-2.5 transition-opacity duration-300 ${
          sheetState === "peek" || sheetState === "min" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ top: `${rideFlowStage === "in_ride" ? 16 : headerHeight + 24}px` }}
      >
        <button
          onClick={() => navigate("/user/safety")}
          aria-label="SOS"
          className="w-11 h-11 rounded-full bg-[#DC2626]/90 backdrop-blur-xl shadow-[0_4px_14px_rgba(220,38,38,0.4)] flex items-center justify-center active:scale-90 transition-transform duration-300"
        >
          <ShieldAlert className="w-6 h-6 text-white" strokeWidth={2} />
        </button>

        <button
          onClick={handleLocateMe}
          aria-label="Use current location"
          className="w-11 h-11 rounded-full bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg flex items-center justify-center active:scale-90 transition-all duration-300"
        >
          <Navigation className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" strokeWidth={2} />
        </button>

        {mapReady && (
          <button
            onClick={() => {
              map.current?.setHeading(0);
              map.current?.setTilt(0);
              showToast(t("home.mapResetToNorth"));
            }}
            aria-label="Reset map orientation to North"
            className="w-11 h-11 rounded-full bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg flex items-center justify-center active:scale-90 transition-all duration-300"
          >
            <Compass className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" strokeWidth={2} />
          </button>
        )}

        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="w-11 h-11 rounded-full bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg flex items-center justify-center active:scale-90 transition-all duration-300"
        >
          {theme === "dark" ? <Sun className="w-6 h-6 text-[#FFD700]" strokeWidth={2} /> : <Moon className="w-6 h-6 text-[#1A1A2E]" strokeWidth={2} />}
        </button>
      </div>

      {/* Top Header — hidden once a ride is under way so the map takes over the screen */}
      {rideFlowStage !== "in_ride" && (
      <div ref={headerRef} className="relative z-10 px-4 pt-4 space-y-3">
        {/* Broad fade behind the branding/toggle/pickup-pill stack so the map
            visibly darkens/lightens there instead of the header content just
            floating on raw map tiles — an absolutely-positioned decorative
            layer (not inline on the row) so it doesn't affect layout/spacing. */}
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-black/70 dark:via-black/35 dark:to-transparent pointer-events-none -z-10" />
        {!pushEnabled && !notifPromptDismissed && (
          <div className="bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.1)] border border-white/60 dark:border-white/10 px-3.5 py-2.5 flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
            <p className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB] flex-1">
              {t("home.enableNotifsRideUpdates")}
            </p>
            <button
              onClick={() => requestNotificationPermission("rider")}
              className="text-xs font-semibold text-[#FF6B00] flex-shrink-0"
            >
              {t("dashboard.enable")}
            </button>
            <button
              onClick={() => setNotifPromptDismissed(true)}
              className="p-0.5 text-[#9CA3AF] flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {/* Branding + weather + map switcher + notification — no card of
            their own, the broad gradient fade above provides the contrast. */}
        <div className="relative z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={theme === "dark" ? "/assets/logo-light.png" : "/assets/logo.png"} alt="Ridepay" className="w-7 h-7 object-contain" />
            <h1 className={`brand-font font-bold text-sm ${theme === "dark" ? "text-white" : "text-[#1A1A2E]"} drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]`}>Ridepay</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {weather.tempC !== null && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-[#0369A1] dark:text-[#7DD3FC] bg-white/90 dark:bg-[#0C2536]/90 backdrop-blur-xl px-2 py-1 rounded-full shadow-sm">
                {weather.emoji} {Math.round(weather.tempC)}°C
              </span>
            )}
            {mapReady && (
              <MapViewToggle
                mapView={mapView}
                onToggle={toggleMapView}
                className="p-2 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl rounded-full shadow-sm"
              />
            )}
            <button
              onClick={() => navigate("/user/notifications")}
              className="p-2 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl rounded-full shadow-sm relative"
            >
              <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF6B00] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Primary Service Switch — directly below the bare branding row */}
        <ServiceModeToggle mode={mode} onChange={setMode} />

      </div>
      )}

      {/* Current Location pill — rendered via a portal into the OverlayView
          div above, so it floats directly on the map at the real pickup
          pin's screen position and tracks it through every pan/zoom,
          instead of sitting fixed near the top of the screen. Tapping it
          (or the pin itself — see its "click" listener) lets you edit it;
          dragging the pin still works too. */}
      {rideFlowStage !== "in_ride" && pickupPillContainer && createPortal(
        // The pill lives inside the map's own DOM (an OverlayView pane), so
        // without stopping propagation every tap on it also reaches Google's
        // "click" listener on the map underneath — which, while editing
        // pickup, treats ANY map click as "move the pin here" and would yank
        // the pin (and pill) to wherever was tapped.
        <div
          className="relative"
          style={{ transform: "translate(-50%, calc(-100% - 10px))" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Rotating glow ring — a conic-gradient clipped down to just a 2px
              rim via a padding+mask-exclude trick, animated by spinning the
              GRADIENT's own angle (--pill-glow-angle, see index.css) rather
              than transform:rotate() on this element — the pill is a wide,
              short rounded rectangle, so rotating the whole div swept its
              ends through a huge visible arc instead of the glow staying
              tight on the edge. */}
          <div
            className="absolute -inset-[2px] rounded-full animate-pill-glow"
            style={{
              background: "conic-gradient(from var(--pill-glow-angle, 0deg), transparent 0%, #FF6B00 15%, transparent 35%)",
              padding: 2,
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          <div
            className="relative z-10 flex items-center gap-2.5 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.2)] px-4 py-2.5"
            style={{ width: "min(80vw, 20rem)" }}
          >
            <div className="relative w-4 h-4 flex-shrink-0 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#138808]/25 animate-pulse" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#138808] border-2 border-white dark:border-[#1E293B]" />
            </div>
            <input
              ref={pickupInputRef}
              type="text"
              value={pickup}
              onChange={handlePickupChange}
              onFocus={() => setIsEditingPickup(true)}
              placeholder={mode === "parcel" ? t("home.pickupLocationPlaceholder") : t("ride.currentLocation")}
              className="flex-1 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] outline-none w-full bg-transparent truncate"
            />
            <button
              onClick={() => {
                setIsEditingPickup(true);
                pickupInputRef.current?.focus();
                pickupInputRef.current?.select();
              }}
              aria-label="Edit pickup location"
              className="p-1.5 rounded-full bg-gray-100 dark:bg-white/10 flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
            </button>
          </div>
          {/* Callout tail — a rotated square whose tip lands exactly on the
              pin (the OverlayView div's own origin, i.e. this group's
              untransformed bottom-center). */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-3 h-3 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl rotate-45 rounded-[2px]" />
        </div>,
        pickupPillContainer
      )}

      {/* Draggable Bottom Sheet — the heart of the app */}
      <div
        className="fixed inset-x-0 z-40 mx-auto max-w-lg px-3"
        style={{
          bottom:
            (mode === "ride" && showFareSheet && rideFlowStage === "idle") || rideFlowStage === "completed"
              ? "16px"
              : "76px",
        }}
      >
        <div
          ref={sheetRef}
          className="bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl rounded-[28px] shadow-[0_-10px_40px_rgba(0,0,0,0.18)] border border-white/60 dark:border-white/10 flex flex-col overflow-hidden"
          style={{
            maxHeight: sheetMaxHeight,
            transform: sheetDragRef.current.active ? `translateY(${Math.max(0, sheetDragPx)}px)` : undefined,
            transition: sheetDragRef.current.active ? "none" : "max-height 0.45s cubic-bezier(0.34,1.56,0.64,1), transform 0.3s",
          }}
        >
          {/* Handle + mode-aware title (drag zone) */}
          <div
            className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            {(mode === "ride" && rideFlowStage === "idle" && !showFareSheet) || (mode === "parcel" && !parcelTrackingId) ? (
              // The destination search now lives here, in the sheet, instead
              // of the header — always visible even at peek/min so the map
              // stays the dominant element by default. Parcel mode reuses
              // the same slot (it only ever needs the one hero destination
              // field here; pickup stays in the header pill for both modes).
              <div className="px-4 pb-2 relative" onPointerDown={(e) => e.stopPropagation()}>
                <div className="relative">
                  {/* Same spinning conic-gradient glow as the pickup pill
                      (index.css .animate-pill-glow), in the pill's green so
                      the two search affordances read as one visual language. */}
                  <div
                    className="absolute -inset-[2px] rounded-full animate-pill-glow"
                    style={{
                      background: "conic-gradient(from var(--pill-glow-angle, 0deg), transparent 0%, #138808 15%, transparent 35%)",
                      padding: 2,
                      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                      WebkitMaskComposite: "xor",
                      maskComposite: "exclude",
                    }}
                  />
                  <div className="relative flex items-center gap-2.5 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-full pl-4 pr-1.5 py-1.5">
                    <Search className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    <input
                      ref={destinationInputRef}
                      type="text"
                      value={destination}
                      onChange={handleDestinationChange}
                      onFocus={() => {
                        if (sheetState === "min" || sheetState === "peek") setSheetState("half");
                        setShowRecentDropdown(true);
                      }}
                      onBlur={() => setShowRecentDropdown(false)}
                      onKeyDown={(e) => e.key === "Enter" && mode === "ride" && handleSearchDestination()}
                      placeholder={mode === "parcel" ? t("home.whereDeliverPlaceholder") : t("ride.whereGoing")}
                      className="flex-1 text-sm font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#6B7280] dark:placeholder:text-[#9CA3AF] w-full bg-transparent"
                    />
                    {isVoiceBookingSupported && mode === "ride" && (
                      <button
                        onClick={handleVoiceSearch}
                        disabled={isListening}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 ${
                          isListening ? "bg-[#DC2626] text-white animate-pulse" : "bg-[#FF6B00] text-white"
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" /> {t("home.speak")}
                      </button>
                    )}
                  </div>
                </div>
                {(isListening || voiceError) && (
                  <div className="flex items-center gap-1.5 pl-4 pt-1">
                    {isListening && <span className="text-[10px] text-[#DC2626] font-medium">{t("home.listening")}</span>}
                    {voiceError && <span className="text-[10px] text-[#DC2626]">{voiceError}</span>}
                  </div>
                )}
                {showRecentDropdown && destination.trim().length === 0 && recentPlaces.length > 0 && (
                  <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 py-1.5 z-30 overflow-hidden">
                    {recentPlaces.map((place) => (
                      <button
                        key={place.key}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { applyDestination(place.coords, place.address); setShowRecentDropdown(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                      >
                        <place.icon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium">{place.label}</span>
                          <span className="text-[#9CA3AF]"> · {place.address}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Ranked by actual distance from pickup (searchPlacesNearby /
                    rankPreference "DISTANCE"), not Google's default relevance
                    ranking — so a bare category word like "college" surfaces
                    the nearest real college first instead of a same-named
                    place in a distant city. */}
                {showRecentDropdown && destination.trim().length >= 2 && (
                  <div className="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 py-1.5 z-30 overflow-hidden max-h-72 overflow-y-auto">
                    {isSearchingDestination ? (
                      <div className="px-4 py-3 text-xs text-[#9CA3AF]">{t("ride.searchingNearby")}</div>
                    ) : destinationSearchResults.length > 0 ? (
                      destinationSearchResults.map((place) => (
                        <button
                          key={place.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectDestinationSearchResult(place)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="w-4 text-center flex-shrink-0">{poiEmoji(place.category)}</span>
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{place.name}</span>
                            {place.address && <span className="text-[#9CA3AF]"> · {place.address}</span>}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-[#9CA3AF]">{t("ride.noPlacesFound")}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
            <div className="px-4 pb-2 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
                  {mode === "ride"
                    ? rideFlowStage === "searching" ? t("home.findingYourCaptain")
                    : rideFlowStage === "matched" ? t("ride.captainOnWay")
                    : rideFlowStage === "in_ride" ? t("ride.tripInProgress")
                    : rideFlowStage === "completed" ? t("ride.tripCompleted")
                    : t("home.estimatedFare")
                    : t("home.sendAParcel")}
                </p>
                {mode === "ride" && rideFlowStage === "in_ride" ? (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[#138808] font-semibold">₹{confirmedFare} total fare</span>
                    <span className="text-[#9CA3AF]">·</span>
                    <span className="text-[#9CA3AF]">{driverEtaMin} {t("home.minToReach")}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9CA3AF]">
                    {mode === "ride"
                      ? rideFlowStage === "searching" ? t("home.pleaseWaitMoment")
                      : rideFlowStage === "matched" ? t("home.getReadyWithOtp")
                      : rideFlowStage === "completed" ? t("home.thanksForRiding")
                      : t("home.dragUpForMore")
                      : t("home.fastTrackedDelivery")}
                  </p>
                )}
              </div>
              {mode === "ride" && showFareSheet && rideFlowStage === "idle" ? (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setShowFareSheet(false);
                    setDestination("");
                    setDestinationCoords(null);
                    setShowPaymentPicker(false);
                    destinationMarkerRef.current?.setMap(null);
                    routePolylineRef.current?.setMap(null);
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full flex-shrink-0"
                >
                  <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                </button>
              ) : mode === "ride" && rideFlowStage === "searching" ? null : (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => cycleSheet(sheetState === "full" ? -1 : 1)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full flex-shrink-0"
                >
                  <ChevronRight className={`w-4 h-4 text-[#9CA3AF] transition-transform ${sheetState === "full" ? "-rotate-90" : "rotate-90"}`} />
                </button>
              )}
            </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
            {/* Sliding promo banner — always visible, first thing in the sheet */}
            {!(mode === "ride" && (showFareSheet || rideFlowStage !== "idle")) && visiblePromoSlides.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden relative select-none touch-pan-y"
                onPointerDown={handleBannerPointerDown}
                onPointerUp={handleBannerPointerUp}
              >
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${(bannerIndex % visiblePromoSlides.length) * 100}%)` }}
                >
                  {visiblePromoSlides.map((slide) => {
                    const SlideIcon = PROMO_ICON_MAP[slide.icon];
                    return (
                      <button
                        key={slide.id}
                        onClick={() => handlePromoSlideClick(slide)}
                        className="w-full flex-shrink-0 flex items-center gap-3 p-3.5 text-left"
                        style={{ background: `linear-gradient(135deg, ${slide.colorFrom}, ${slide.colorTo})` }}
                      >
                        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                          <SlideIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{slide.title}</p>
                          <p className="text-[10px] text-white/75 truncate">{slide.subtitle}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-white bg-white/20 px-2 py-1 rounded-full flex-shrink-0">
                          {slide.cta}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {visiblePromoSlides.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 py-2 bg-black/10">
                    {visiblePromoSlides.map((slide, i) => (
                      <button
                        key={slide.id}
                        onClick={() => goToBanner(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all ${i === bannerIndex % visiblePromoSlides.length ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Services — visible at rest (peek/min) as icon+title+subtitle
                cards, matching the reference layout; the admin-configured "More
                for you" tile grid further down (sheetState === "full") stays
                for expanded browsing. */}
            {mode === "ride" && !showFareSheet && rideFlowStage === "idle" && (sheetState === "peek" || sheetState === "min") && (
              <div>
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-2">{t("ride.quickServices")}</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {visibleRideTypes.map((rt) => (
                    <button
                      key={rt.id}
                      onClick={() => handleRideTypeSelect(rt)}
                      className="flex-shrink-0 w-24 flex flex-col items-start gap-1.5 p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]"
                    >
                      <rt.icon className="w-5 h-5 text-[#FF6B00]" />
                      <span className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-left leading-tight">{rt.label}</span>
                      <span className="text-[10px] text-[#9CA3AF] text-left leading-tight">{rt.subtitle}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setMode("parcel")}
                    className="flex-shrink-0 w-24 flex flex-col items-start gap-1.5 p-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]"
                  >
                    <Package className="w-5 h-5 text-[#FF6B00]" />
                    <span className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-left leading-tight">{t("services.parcel")}</span>
                    <span className="text-[10px] text-[#9CA3AF] text-left leading-tight">{t("home.sendAnything")}</span>
                  </button>
                </div>
              </div>
            )}

            {/* RIDE MODE — fare summary or ride-type chips (always visible, peek-safe) */}
            {mode === "ride" && showFareSheet && rideFlowStage === "idle" && (
              <div className="space-y-3">
                {/* Current Location / Destination — read-only summary once a
                    destination is picked; "Change" re-opens the search field
                    via the same reset the header's X button uses. */}
                <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#0F172A] space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#138808] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
                      {pickup || t("ride.currentLocation")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0" />
                    <span className="flex-1 min-w-0 text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
                      {destination}
                    </span>
                    <button
                      onClick={() => {
                        setShowFareSheet(false);
                        setDestination("");
                        setDestinationCoords(null);
                        destinationMarkerRef.current?.setMap(null);
                        routePolylineRef.current?.setMap(null);
                      }}
                      className="text-xs font-semibold text-[#FF6B00] flex-shrink-0"
                    >
                      {t("home.change")}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{routeInfo.duration} {t("min")}</span>
                  </div>
                  <div className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{routeInfo.distance} {t("km")}</div>
                </div>

                {/* Selectable ride options — pick one before confirming */}
                <div className="space-y-2">
                  {availableRideOptions.map((option) => {
                    const price = computeRidePrice(option);
                    const isSelected = selectedRideType === option.id;
                    const isAiBoosted = !!(farePrediction && farePrediction.multiplier > 1);
                    const normalPrice = isAiBoosted ? computeNormalRidePrice(option) : 0;
                    const pickupEtaMin = pseudoPickupEtaMin(option.id + pickup);
                    return (
                      <div
                        key={option.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRideType(option.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedRideType(option.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] shadow-md"
                            : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${isSelected ? "scale-105" : ""}`}
                          style={{
                            background: isSelected
                              ? "linear-gradient(145deg, #FF8A3D, #E65A00)"
                              : theme === "dark"
                              ? "linear-gradient(145deg, #334155, #1E293B)"
                              : "linear-gradient(145deg, #ffffff, #e5e7eb)",
                            boxShadow: isSelected
                              ? "0 6px 14px rgba(255,107,0,0.35), inset 0 1px 1px rgba(255,255,255,0.4)"
                              : "0 3px 8px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.15)",
                          }}
                        >
                          <Vehicle3DPreview
                            vehicleType={option.id === "auto" ? "auto-rickshaw" : "e-riksha"}
                            spin={false}
                            className="w-10 h-10"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate min-w-0">{t(option.labelKey)}</p>
                            <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{pickupEtaMin} {t("home.minAway")}</span>
                          </div>
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{t(option.subtitleKey)}</p>
                        </div>
                        {option.id === "share" && isSelected ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSeats((s) => Math.max(1, s - 1))}
                              className="w-7 h-7 rounded-full bg-white dark:bg-[#1E293B] shadow-sm flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
                            </button>
                            <span className="font-semibold w-4 text-center text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{seats}</span>
                            <button
                              onClick={() => setSeats((s) => Math.min(4, s + 1))}
                              className="w-7 h-7 rounded-full bg-white dark:bg-[#1E293B] shadow-sm flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
                            </button>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                              {isAiBoosted && <Sparkles className="w-3 h-3 text-[#FF6B00]" />}
                              <span className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB] leading-none">₹{price}</span>
                            </div>
                            {isAiBoosted && (
                              <span className="text-[9px] text-[#9CA3AF] line-through leading-none mt-0.5">₹{normalPrice}</span>
                            )}
                          </div>
                          <span
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? "border-[#FF6B00]" : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Apply Coupon — validated + discounted server-side via
                    fare.calculateFare's couponCode input, same numbers shown above. */}
                {!appliedCouponCode ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Tag className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                        placeholder={t("home.haveCouponCode")}
                        className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl pl-8 pr-3 py-2 text-xs outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
                      />
                    </div>
                    <button
                      onClick={handleApplyCoupon}
                      disabled={!couponCodeInput.trim()}
                      className="px-4 py-2 rounded-xl bg-[#1A1A2E] dark:bg-[#334155] text-white text-xs font-medium disabled:opacity-40"
                    >
                      {t("apply")}
                    </button>
                  </div>
                ) : (
                  (() => {
                    const activeQuote = fareQuoteFor((RIDE_OPTIONS.find((o) => o.id === selectedRideType) ?? RIDE_OPTIONS[0]).id);
                    const couponOk = activeQuote && activeQuote.couponDiscount > 0;
                    return (
                      <div
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs ${
                          couponOk ? "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]" : "bg-red-50 dark:bg-[#3A1A1A] text-[#DC2626]"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-medium truncate">
                          <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                          {couponOk
                            ? `"${appliedCouponCode}" ${t("home.appliedDiscountOff")} ₹${activeQuote!.couponDiscount} ${t("home.off")}`
                            : activeQuote?.couponError ?? `${t("home.checking")} "${appliedCouponCode}"...`}
                        </span>
                        <button onClick={handleRemoveCoupon} className="flex-shrink-0 underline font-medium">
                          {t("remove")}
                        </button>
                      </div>
                    );
                  })()
                )}

                {/* Safety Options — compact tap-to-toggle chips, kept to one line so the Book button stays visible */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => womenOnlyVehicleAvailable && setWomenOnly(!womenOnly)}
                    disabled={!womenOnlyVehicleAvailable}
                    title={womenOnlyVehicleAvailable ? undefined : t("home.currentlyUnavailable")}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-colors disabled:opacity-40 ${
                      womenOnly ? "border-[#7C3AED] bg-[#F3E8FF] dark:bg-[#2D1B4E]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${womenOnly ? "text-[#7C3AED]" : "text-[#9CA3AF]"}`} />
                    <span className={`text-xs font-medium truncate ${womenOnly ? "text-[#7C3AED]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}>
                      {t("home.womenDriverOnly")}
                    </span>
                  </button>
                  <button
                    onClick={() => setNightSafeMode(!nightSafeMode)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${
                      nightSafeMode ? "border-[#1E3A5F] bg-[#E8EEF5] dark:bg-[#1A2A3A]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                    }`}
                  >
                    <Moon className={`w-4 h-4 flex-shrink-0 ${nightSafeMode ? "text-[#1E3A5F] dark:text-[#93C5FD]" : "text-[#9CA3AF]"}`} />
                    <span className={`text-xs font-medium truncate ${nightSafeMode ? "text-[#1E3A5F] dark:text-[#93C5FD]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}>
                      {t("home.nightSafeMode")}
                    </span>
                  </button>
                </div>

                {/* Fixed payment method + estimate + Confirm Ride bar — sticks to
                    the bottom of the sheet's scroll area regardless of how far
                    the vehicle list above has scrolled. */}
                <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 -mb-4 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowPaymentPicker((v) => !v)}
                      className="flex items-center gap-1 pl-2.5 pr-2 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0F172A] text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]"
                    >
                      {selectedPaymentMethod === "cash" ? (
                        <IndianRupee className="w-3.5 h-3.5 text-[#138808]" />
                      ) : selectedPaymentMethod === "upi" ? (
                        <Smartphone className="w-3.5 h-3.5 text-[#FF6B00]" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#93C5FD]" />
                      )}
                      <span className="capitalize">{selectedPaymentMethod === "upi" ? "UPI" : t(selectedPaymentMethod === "cash" ? "home.paymentCash" : "home.paymentWallet")}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${showPaymentPicker ? "rotate-180" : ""}`} />
                    </button>
                    {showPaymentPicker && (
                      <div className="absolute bottom-full mb-2 left-0 w-36 bg-white dark:bg-[#1E293B] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                        {(["cash", "upi", "wallet"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => { setSelectedPaymentMethod(m); setShowPaymentPicker(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left ${
                              selectedPaymentMethod === m ? "text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"
                            }`}
                          >
                            {m === "cash" ? (
                              <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : m === "upi" ? (
                              <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                            ) : (
                              <Wallet className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            <span className="capitalize">{m === "upi" ? "UPI" : t(m === "cash" ? "home.paymentCash" : "home.paymentWallet")}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">
                    {t("home.estimate")}:{" "}
                    <span className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">
                      ₹{computeRidePrice(availableRideOptions.find((o) => o.id === selectedRideType) ?? RIDE_OPTIONS[0])}
                    </span>
                  </div>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={!destinationCoords || !availableRideOptions.some((o) => o.id === selectedRideType)}
                    className="flex-shrink-0 bg-[#FF6B00] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#E65A00] transition-colors disabled:opacity-50"
                  >
                    {t("ride.confirmBooking")}
                  </button>
                </div>
              </div>
            )}

            {/* RIDE MODE — searching for a captain */}
            {mode === "ride" && rideFlowStage === "searching" && (
              <div className="flex flex-col items-center py-6">
                <div className="relative w-24 h-24 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-[#138808] animate-ripple" />
                  <div className="absolute inset-0 rounded-full border-2 border-[#138808] animate-ripple" style={{ animationDelay: "0.6s" }} />
                  <div className="absolute inset-0 rounded-full border-2 border-[#138808] animate-ripple" style={{ animationDelay: "1.2s" }} />
                  <Vehicle3DPreview
                    vehicleType={womenOnly ? "e-riksha-woman" : selectedRideType === "auto" ? "auto-rickshaw" : "e-riksha"}
                    className="w-16 h-16 z-10"
                  />
                </div>
                <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.findingNearestCaptain")}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">{t("home.hangTight")}</p>
                {(womenOnly || nightSafeMode) && (
                  <div className="flex items-center gap-2 mt-3">
                    {womenOnly && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-[#7C3AED] bg-[#F3E8FF] dark:bg-[#2D1B4E] px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> {t("home.womenDriver")}
                      </span>
                    )}
                    {nightSafeMode && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-[#1E3A5F] dark:text-[#93C5FD] bg-[#E8EEF5] dark:bg-[#1A2A3A] px-2.5 py-1 rounded-full">
                        <Moon className="w-3 h-3" /> {t("home.nightSafeMode")}
                      </span>
                    )}
                  </div>
                )}
                <button onClick={handleRequestCancel} className="mt-4 text-xs font-medium text-[#DC2626] hover:underline">
                  {t("home.cancelSearch")}
                </button>
              </div>
            )}

            {/* RIDE MODE — captain matched: collapsed compact row (min/peek) vs full card + OTP/timeline (half/full) */}
            {mode === "ride" && rideFlowStage === "matched" && (sheetState === "min" || sheetState === "peek") && (
              <div className="flex items-center gap-3">
                <img
                  src={currentRide?.driverAvatar || "/assets/driver-avatar.png"}
                  alt={currentRide?.driverName || t("home.yourCaptain")}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#FF6B00] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{currentRide?.driverName || t("home.yourCaptain")}</h3>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#FF6B00] flex-shrink-0">
                      {currentRide?.driverRating ? Number(currentRide.driverRating).toFixed(1) : "5.0"} <Star className="w-2.5 h-2.5 fill-[#FF6B00]" />
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] truncate">{currentRide?.vehicleNumber || "—"} · {currentRide?.vehicleModel || "—"} · {driverEtaMin} {t("home.minAway")}</p>
                </div>
                <a href={`tel:${currentRide?.driverPhone || ""}`} className="w-9 h-9 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-white" />
                </a>
              </div>
            )}
            {mode === "ride" && rideFlowStage === "matched" && (sheetState === "half" || sheetState === "full") && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                  <img
                    src={currentRide?.driverAvatar || "/assets/driver-avatar.png"}
                    alt={currentRide?.driverName || t("home.yourCaptain")}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#FF6B00] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{currentRide?.driverName || t("home.yourCaptain")}</h3>
                      <span className="flex items-center gap-0.5 text-xs font-bold text-[#FF6B00] flex-shrink-0">
                        <Star className="w-3 h-3 fill-[#FF6B00]" /> {currentRide?.driverRating ? Number(currentRide.driverRating).toFixed(1) : "5.0"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      <span className="truncate">{currentRide?.vehicleNumber || "—"}</span>
                      <span>·</span>
                      <span className="truncate">{currentRide?.vehicleModel || "—"}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOtpQr(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E293B] border border-gray-100 dark:border-gray-700 flex-shrink-0"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-[#9CA3AF] leading-none">OTP</span>
                      <span className="text-sm font-bold text-[#FF6B00] tracking-wide leading-tight">{rideOtp}</span>
                    </div>
                    <QrCode className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a href={`tel:${currentRide?.driverPhone || ""}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#138808] text-white text-xs font-medium">
                    <Phone className="w-3.5 h-3.5" /> {t("call")}
                  </a>
                  <a href={`sms:${currentRide?.driverPhone || ""}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#E0F2FE] dark:bg-[#0C2536] text-[#0EA5E9] text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" /> {t("message")}
                  </a>
                  <button
                    onClick={handleShareTrip}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-medium"
                  >
                    <Share2 className="w-3.5 h-3.5" /> {t("share")}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#138808] font-medium">{t("home.arrivingIn")} {driverEtaMin} {t("min")}</span>
                  <span className="text-[#9CA3AF]">{driverDistanceKm} {t("km")} {t("home.away")}</span>
                </div>

                <RouteRestrictionBanner
                  notice={currentRide?.routeRestrictionNotice === "no_alternative" ? "no_alternative" : transientRestrictionNotice}
                  role="rider"
                  onContactSupport={() => navigate("/user/support")}
                />

                {/* Trip timeline — Confirmed once matched, On the way immediately after,
                    Arrived once the driver hits "pickup" (this block only renders while
                    rideFlowStage === "matched", so it never reaches Trip Started/Completed —
                    the in_ride block below has its own always-3 version). */}
                <div className="flex items-center justify-between px-1">
                  {TRIP_TIMELINE_STEPS.map((step, i) => {
                    const currentIndex = currentRide?.status === "pickup" ? 2 : 1;
                    const reached = i <= currentIndex;
                    return (
                      <div key={step} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${reached ? "bg-[#FF6B00]" : "bg-gray-200 dark:bg-gray-700"}`} />}
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${reached ? "bg-[#FF6B00]" : "bg-gray-200 dark:bg-gray-700"}`}>
                          {reached && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-[8px] mt-1 text-center ${reached ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>{t(TRIP_TIMELINE_STEP_KEYS[step])}</span>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => navigate("/user/refer")}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)" }}
                >
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{t("refer.title")}</p>
                    <p className="text-[10px] text-white/75">{t("home.inviteFriendsRideCredit")}</p>
                  </div>
                </button>

                <button onClick={handleRequestCancel} className="w-full text-xs font-medium text-[#DC2626] hover:underline py-1">
                  {t("ride.cancelRide")}
                </button>
              </div>
            )}

            {/* RIDE MODE — trip in progress: expanded (half/full) gets real content;
                min/peek stays the compact 92px title bar (fare + ETA) set above. */}
            {mode === "ride" && rideFlowStage === "in_ride" && (sheetState === "half" || sheetState === "full") && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                  <img
                    src={currentRide?.driverAvatar || "/assets/driver-avatar.png"}
                    alt={currentRide?.driverName || t("home.yourCaptain")}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#FF6B00] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{currentRide?.driverName || t("home.yourCaptain")}</h3>
                    <div className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      <span className="truncate">{currentRide?.vehicleModel || "—"}</span>
                      <span>·</span>
                      <span>{currentRide?.vehicleNumber || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-[#FFF5EB] dark:bg-[#3D2914] px-2 py-1 rounded-lg flex-shrink-0">
                    <span className="text-xs font-bold text-[#FF6B00]">{currentRide?.driverRating ? Number(currentRide.driverRating).toFixed(1) : "5.0"}</span>
                    <Star className="w-3 h-3 text-[#FF6B00] fill-[#FF6B00]" />
                  </div>
                </div>

                <RouteRestrictionBanner
                  notice={currentRide?.routeRestrictionNotice === "no_alternative" ? "no_alternative" : transientRestrictionNotice}
                  role="rider"
                  onContactSupport={() => navigate("/user/support")}
                />

                <div className="flex items-center gap-2">
                  <a href={`tel:${currentRide?.driverPhone || ""}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#138808] text-white text-xs font-medium">
                    <Phone className="w-3.5 h-3.5" /> {t("call")}
                  </a>
                  <a href={`sms:${currentRide?.driverPhone || ""}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#E0F2FE] dark:bg-[#0C2536] text-[#0EA5E9] text-xs font-medium">
                    <MessageCircle className="w-3.5 h-3.5" /> {t("message")}
                  </a>
                  <button
                    onClick={handleShareTrip}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-[#1A1A2E] dark:text-[#E5E7EB] text-xs font-medium"
                  >
                    <Share2 className="w-3.5 h-3.5" /> {t("share")}
                  </button>
                </div>

                {/* Wait & Return: driver has arrived and is holding at the
                    destination — the rider decides when to head back. */}
                {currentRide?.status === "waiting" && (
                  <div className="bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
                      <p className="text-xs font-medium text-[#7A4A1A] dark:text-[#FFC98A]">
                        {t("home.driverArrivedWaiting")}
                      </p>
                    </div>
                    <button
                      onClick={() => currentRideId && startReturnMutation.mutate({ rideId: currentRideId })}
                      disabled={startReturnMutation.isPending}
                      className="w-full bg-[#FF6B00] text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50"
                    >
                      {startReturnMutation.isPending ? t("home.starting") : t("home.startReturnTrip")}
                    </button>
                  </div>
                )}
                {currentRide?.status === "ongoing" && currentRide?.returnStartedAt && (
                  <div className="flex items-center gap-2 bg-[#E0F2FE] dark:bg-[#0C2536] rounded-xl p-3">
                    <Navigation className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                    <p className="text-xs font-medium text-[#0369A1] dark:text-[#7DD3FC]">
                      {t("home.headingBackTo")} {currentRide.pickupAddress}
                    </p>
                  </div>
                )}

                {/* Hourly Rental: no fixed destination, so the normal
                    Requested/Arriving/Picked Up/Drop-off timeline doesn't
                    apply — a live elapsed/remaining timer + End Rental
                    replaces it instead. */}
                {currentRide?.isHourlyRental ? (
                  (() => {
                    const startedAt = currentRide.rentalStartedAt ? new Date(currentRide.rentalStartedAt).getTime() : null;
                    const packageMs = (currentRide.rentalHours ?? 0) * 60 * 60 * 1000;
                    const elapsedMs = startedAt ? rentalNow - startedAt : 0;
                    const remainingMs = packageMs - elapsedMs;
                    const isOvertime = remainingMs < 0;
                    const fmt = (ms: number) => {
                      const s = Math.floor(Math.abs(ms) / 1000);
                      return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
                    };
                    return (
                      <div className={`rounded-xl p-3.5 space-y-2.5 ${isOvertime ? "bg-[#FEE2E2] dark:bg-[#3D1414]" : "bg-[#F3E8FF] dark:bg-[#2D1B4E]"}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${isOvertime ? "text-[#DC2626]" : "text-[#7C3AED]"}`}>
                            {isOvertime ? t("home.overtime") : t("home.timeRemaining")} · {currentRide.rentalHours}h {t("home.package")}
                          </span>
                          <span className={`text-lg font-bold tabular-nums ${isOvertime ? "text-[#DC2626]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>
                            {fmt(remainingMs)}
                          </span>
                        </div>
                        <button
                          onClick={() => currentRideId && completeHourlyRentalMutation.mutate({ rideId: currentRideId })}
                          disabled={completeHourlyRentalMutation.isPending}
                          className="w-full bg-[#7C3AED] text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50"
                        >
                          {completeHourlyRentalMutation.isPending ? t("home.ending") : t("home.endRental")}
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1">
                      {TRIP_TIMELINE_STEPS.map((step, i) => {
                        const reached = i <= 3;
                        return (
                          <div key={step} className="flex-1 flex flex-col items-center relative">
                            {i > 0 && <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${reached ? "bg-[#FF6B00]" : "bg-gray-200 dark:bg-gray-700"}`} />}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${reached ? "bg-[#FF6B00]" : "bg-gray-200 dark:bg-gray-700"}`}>
                              {reached && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-[8px] mt-1 text-center ${reached ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>{t(TRIP_TIMELINE_STEP_KEYS[step])}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF]">{t("home.runningFare")}</span>
                      <span className="font-bold text-[#FF6B00]">₹{confirmedFare}</span>
                    </div>
                  </>
                )}

                <button onClick={() => navigate("/user/support")} className="w-full text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] hover:underline py-1">
                  {t("home.needHelpContactSupport")}
                </button>
              </div>
            )}

            {/* RIDE MODE — trip completed: fare summary, rate/tip/invoice/support,
                and a payment-method-aware footer (cash auto-pends, UPI/wallet get
                an explicit Pay button, settled rides get a Home button). */}
            {mode === "ride" && rideFlowStage === "completed" && (sheetState === "half" || sheetState === "full") && (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A2E] to-[#0F172A] dark:from-[#1E293B] dark:to-[#0F172A] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-[#9CA3AF] mb-1">{t("home.totalFare")} 🎉</p>
                      <p className="text-3xl font-bold text-white">₹{Number(currentRide?.totalFare ?? 0).toFixed(0)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
                    <div>
                      <p className="text-[10px] text-[#9CA3AF]">{t("ride.distance")}</p>
                      <p className="text-sm font-semibold text-white">{Number(currentRide?.distance ?? 0).toFixed(1)} {t("km")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9CA3AF]">{t("ride.duration")}</p>
                      <p className="text-sm font-semibold text-white">{currentRide?.estimatedTime ?? 0} {t("min")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#9CA3AF]">{t("ride.paidBy")}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white capitalize">{currentRide?.paymentMethod === "upi" ? "UPI" : currentRide?.paymentMethod ? t(currentRide.paymentMethod === "cash" ? "home.paymentCash" : "home.paymentWallet") : "—"}</span>
                        {currentRide?.paymentMethod === "cash" &&
                          (currentRidePayment?.status === "completed" ? (
                            <Check className="w-3.5 h-3.5 text-[#138808]" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border-2 border-[#FF6B00] border-t-transparent animate-spin" />
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
                {currentRide?.paymentMethod === "cash" && currentRidePayment?.status !== "completed" && (
                  <p className="text-[11px] text-center text-[#9CA3AF]">{t("home.waitingConfirmCash")}</p>
                )}

                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setShowRatePopup(true)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]"
                  >
                    <Star className={`w-5 h-5 ${rating > 0 ? "text-[#FF6B00] fill-[#FF6B00]" : "text-[#FF6B00]"}`} />
                    <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("ride.rateCaptain")}</span>
                  </button>
                  <button
                    onClick={() => setShowTipPopup(true)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]"
                  >
                    <Heart className={`w-5 h-5 ${tipSentAmount ? "text-[#DC2626] fill-[#DC2626]" : "text-[#DC2626]"}`} />
                    <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("ride.tipCaptain")}</span>
                  </button>
                  <button onClick={handleDownloadInvoicePdf} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]">
                    <FileText className="w-5 h-5 text-[#0EA5E9]" />
                    <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.invoice")}</span>
                  </button>
                  <button onClick={() => navigate("/user/support")} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-[#F8F9FA] dark:bg-[#0F172A]">
                    <Headset className="w-5 h-5 text-[#7C3AED]" />
                    <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("support.title")}</span>
                  </button>
                </div>

                {currentRidePayment?.status === "completed" ? (
                  <button
                    onClick={resetToIdleAfterTrip}
                    className="w-full flex items-center justify-center gap-1.5 bg-[#FF6B00] text-white font-semibold py-3 rounded-xl hover:bg-[#E65A00] transition-colors"
                  >
                    <Home className="w-4 h-4" /> {t("user.home")}
                  </button>
                ) : currentRide?.paymentMethod !== "cash" ? (
                  <>
                    {walletError && <p className="text-xs text-[#DC2626] text-center">{walletError}</p>}
                    {razorpayError && <p className="text-xs text-[#DC2626] text-center">{razorpayError}</p>}
                    {currentRide?.paymentMethod === "wallet" && (
                      <p className="text-[11px] text-center text-[#9CA3AF]">{t("home.walletBalance")}: ₹{customerWallet?.availableBalance ?? 0}</p>
                    )}
                    <button
                      onClick={handlePayForCompletedRide}
                      disabled={confirmRidePaymentMutation.isPending || debitWalletMutation.isPending || createPaymentOrderMutation.isPending || checkoutOpen}
                      className="w-full bg-[#FF6B00] text-white font-semibold py-3 rounded-xl hover:bg-[#E65A00] transition-colors disabled:opacity-50"
                    >
                      {checkoutOpen || createPaymentOrderMutation.isPending ? t("wallet.openingRazorpay") : `${t("home.pay")} ₹${Number(currentRide?.totalFare ?? 0).toFixed(0)}`}
                    </button>
                  </>
                ) : null}
              </div>
            )}

            {mode === "ride" && !showFareSheet && rideFlowStage === "idle" && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {visibleRideTypes.map((rt) => (
                  <button
                    key={rt.id}
                    onClick={() => handleRideTypeSelect(rt)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-colors flex-shrink-0 ${
                      selectedRideType === rt.id ? "bg-[#FF6B00] text-white" : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] hover:bg-gray-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <rt.icon className="w-3.5 h-3.5" /> {rt.label}
                  </button>
                ))}
              </div>
            )}

            {/* RIDE MODE — half/full: AI destination suggestions */}
            {mode === "ride" && !showFareSheet && rideFlowStage === "idle" && (sheetState === "half" || sheetState === "full") && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />
                {AI_DESTINATION_SUGGESTIONS.map((label) => (
                  <button
                    key={label}
                    onClick={() => handleAiSuggestion(label)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex-shrink-0"
                  >
                    {t(AI_DESTINATION_SUGGESTION_KEYS[label])}
                  </button>
                ))}
              </div>
            )}

            {/* RIDE MODE — half/full: real Recent Places (saved Home/Work + actual ride history) */}
            {mode === "ride" && !showFareSheet && rideFlowStage === "idle" && (sheetState === "half" || sheetState === "full") && recentPlaces.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{t("ride.recentPlaces")}</p>
                  <button onClick={() => navigate("/user/history")} className="text-[11px] text-[#FF6B00] font-medium">{t("seeAll")}</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {recentPlaces.map((place) => (
                    <button
                      key={place.key}
                      onClick={() => applyDestination(place.coords, place.address)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0F172A] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                        <place.icon className="w-4 h-4 text-[#FF6B00]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{place.label}</p>
                        <p className="text-[10px] text-[#9CA3AF] truncate">{place.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* RIDE MODE — half/full: Popular Nearby (admin-configured shortcuts, styled as larger gradient cards) */}
            {mode === "ride" && !showFareSheet && rideFlowStage === "idle" && (sheetState === "half" || sheetState === "full") && visibleNearbyServices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-2">{t("ride.popularNearby")}</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {visibleNearbyServices.map((s) => {
                    const ServiceIcon = NEARBY_ICON_MAP[s.icon];
                    return (
                      <button
                        key={s.id}
                        className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-gradient-to-br from-[#FFF5EB] to-[#FFE4CC] dark:from-[#3D2914] dark:to-[#2A1B0E]"
                      >
                        <ServiceIcon className="w-5 h-5 text-[#FF6B00]" />
                        <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-center leading-tight">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PARCEL MODE — booking form until sent, then a live status card driven by the real booking */}
            {mode === "parcel" && (
              <div className="space-y-3">
                {!parcelTrackingId ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {PACKAGE_SIZES.map((size) => (
                        <button
                          key={size.id}
                          onClick={() => { setParcelSize(size.id); setParcelWeight(size.weightKg); }}
                          className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                            parcelSize === size.id ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] hover:bg-gray-200 dark:hover:bg-white/5"
                          }`}
                        >
                          <Package className="w-4 h-4" />
                          <span>{t(size.labelKey)}</span>
                          <span className={`text-[10px] ${parcelSize === size.id ? "text-white/80" : "text-[#9CA3AF]"}`}>{t(size.subtitleKey)}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">{t("home.approxWeightKg")}</p>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={parcelWeight}
                          onChange={(e) => setParcelWeight(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-[#0F172A] rounded-xl px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                        />
                      </div>
                      <button
                        onClick={() => setParcelFragile(!parcelFragile)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors mt-4 ${
                          parcelFragile ? "bg-[#DC2626] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" /> {t("home.fragile")}
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">{t("home.notesForDriverOptional")}</p>
                      <textarea
                        value={parcelNotes}
                        onChange={(e) => setParcelNotes(e.target.value)}
                        placeholder={t("home.notesForDriverPlaceholder")}
                        rows={2}
                        className="w-full bg-gray-50 dark:bg-[#0F172A] rounded-xl px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setParcelPaidBy("sender")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                          parcelPaidBy === "sender" ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                        }`}
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> {t("home.illPay")}
                      </button>
                      <button
                        onClick={() => setParcelPaidBy("receiver")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                          parcelPaidBy === "receiver" ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" /> {t("home.receiverPays")}
                      </button>
                    </div>

                    {!isVehicleEnabled("e-riksha-parcel") && (
                      <p className="text-xs text-center text-[#DC2626]">{t("home.parcelCouriersUnavailable")}</p>
                    )}
                    <button
                      onClick={handleBookParcel}
                      disabled={
                        !pickup || !destination || !destinationCoords || parcelSearching ||
                        bookParcelMutation.isPending || !isVehicleEnabled("e-riksha-parcel")
                      }
                      className="w-full flex items-center justify-center gap-2 btn-saffron py-3 disabled:opacity-50"
                    >
                      {parcelSearching || bookParcelMutation.isPending ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                      {parcelSearching || bookParcelMutation.isPending ? t("home.findingACourier") : t("ride.sendParcel")}
                    </button>

                    {(sheetState === "half" || sheetState === "full") && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setParcelInstant(true)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                            parcelInstant ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" /> {t("home.instantDelivery")}
                        </button>
                        <button
                          onClick={() => setParcelInstant(false)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                            !parcelInstant ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                          }`}
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> {t("home.scheduled")}
                        </button>
                      </div>
                    )}
                  </>
                ) : !myParcel ? (
                  <div className="flex flex-col items-center py-6">
                    <div className="relative w-20 h-20 flex items-center justify-center mb-3">
                      <div className="absolute inset-0 rounded-full border-2 border-[#0EA5E9] animate-ripple" />
                      <div className="absolute inset-0 rounded-full border-2 border-[#0EA5E9] animate-ripple" style={{ animationDelay: "0.6s" }} />
                      <Vehicle3DPreview vehicleType="e-riksha-parcel" className="w-14 h-14 z-10" />
                    </div>
                    <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.assigningCourier")}</p>
                  </div>
                ) : myParcel.paidBy === "sender" && myParcel.paymentStatus !== "confirmed" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("home.trackingId")}</p>
                        <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] tracking-wide">{myParcel.trackingId}</p>
                      </div>
                      <button
                        onClick={handleShareParcelTrackingWhatsApp}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22] px-3 py-1.5 rounded-full"
                      >
                        <Share2 className="w-3.5 h-3.5" /> {t("share")}
                      </button>
                    </div>
                    <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 text-center">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.pay")} ₹{myParcel.cost} {t("home.toDispatchCourier")}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                        {myParcel.driverName} {t("home.willHeadToPickup")}
                      </p>
                    </div>
                    {renderParcelPaymentPicker(
                      myParcel.cost,
                      handleMyParcelPayment,
                      submitParcelPaymentMutation.isPending ? submitParcelPaymentMutation.variables?.method ?? null : null
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("home.trackingId")}</p>
                        <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] tracking-wide">{myParcel.trackingId}</p>
                      </div>
                      <button
                        onClick={handleShareParcelTrackingWhatsApp}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22] px-3 py-1.5 rounded-full"
                      >
                        <Share2 className="w-3.5 h-3.5" /> {t("share")}
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      {PARCEL_STAGE_FLOW.map((step, i) => {
                        const currentIndex = PARCEL_STAGE_FLOW.findIndex((s) => s.id === myParcel.stage);
                        const reached = i <= currentIndex;
                        return (
                          <div key={step.id} className="flex-1 flex flex-col items-center relative">
                            {i > 0 && (
                              <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`} />
                            )}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`}>
                              {reached && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-[9px] mt-1 text-center ${reached ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>
                              {t(step.labelKey)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0F172A] rounded-xl p-3">
                      <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#FF6B00]">{myParcel.driverName.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{myParcel.driverName}</p>
                        <p className="text-xs text-[#9CA3AF] truncate">{myParcel.vehicle}</p>
                      </div>
                      <a href={`tel:${myParcel.driverPhone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-[#138808]" />
                      </a>
                    </div>

                    {myParcel.stage === "assigned" && (
                      <p className="text-xs text-center text-[#9CA3AF]">{myParcel.driverName} {t("home.onWayToPickupParcel")}</p>
                    )}
                    {myParcel.stage === "picked_up" && (
                      <p className="text-xs text-center text-[#9CA3AF]">{t("home.parcelOnWayTo")} {myParcel.destination}</p>
                    )}

                    {myParcel.stage !== "delivered" && (
                      <div className="flex items-center justify-between bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3">
                        <div>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("home.deliveryPinShareOnly")}</p>
                          <p className="text-lg font-bold text-[#FF6B00] tracking-widest">{myParcel.deliveryPin}</p>
                        </div>
                        <ShieldAlert className="w-6 h-6 text-[#FF6B00]" />
                      </div>
                    )}

                    {myParcel.stage === "arrived" && (
                      <p className="text-xs text-center text-[#9CA3AF]">{t("home.waitingReceiverConfirmPin")}</p>
                    )}

                    {myParcel.stage === "delivered" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-[#138808]">
                          <PackageCheck className="w-5 h-5" /> <span className="text-sm font-semibold">{t("home.deliveredExclaim")}</span>
                        </div>
                        {/* paidBy === "sender" is always already confirmed by this
                            point — that payment is collected upfront, before dispatch. */}
                        {myParcel.paymentStatus === "confirmed" ? (
                          <>
                            <p className="text-xs text-center text-[#9CA3AF]">
                              ₹{myParcel.cost} {t("home.paidVia")} {myParcel.paymentMethod}{myParcel.paidBy === "receiver" ? ` ${t("home.byTheReceiver")}` : ""}.
                            </p>
                            <button onClick={handleStartNewParcel} className="w-full btn-saffron py-2.5 text-sm">
                              {t("home.sendAnotherParcel")}
                            </button>
                          </>
                        ) : (
                          <p className="text-xs text-center text-[#9CA3AF]">{t("home.waitingReceiverPayment")}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {sheetState === "full" && (
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                      <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.trackAParcel")}</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={trackCodeInput}
                        onChange={(e) => setTrackCodeInput(e.target.value.toUpperCase())}
                        placeholder={t("home.trackingCodePlaceholder")}
                        className="min-w-0 flex-1 bg-gray-50 dark:bg-[#0F172A] rounded-xl px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] tracking-wide"
                      />
                      <button
                        onClick={handleTrackParcel}
                        disabled={!trackCodeInput.trim()}
                        className="flex-shrink-0 whitespace-nowrap px-4 rounded-xl bg-[#0EA5E9] text-white text-sm font-medium disabled:opacity-50"
                      >
                        {t("home.track")}
                      </button>
                    </div>

                    {trackedCode && (
                      trackedParcelFetching && !trackedParcel ? (
                        <p className="text-xs text-center text-[#9CA3AF] py-2">{t("home.lookingUp")} {trackedCode}...</p>
                      ) : !trackedParcel ? (
                        <p className="text-xs text-center text-[#DC2626] py-2">{t("home.noParcelFoundFor")} "{trackedCode}"</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{trackedParcel.trackingId}</p>
                              <p className="text-[10px] text-[#9CA3AF]">{t("home.from")} {trackedParcel.pickup}</p>
                            </div>
                            <span className="text-xs font-medium text-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536] px-2.5 py-1 rounded-full capitalize">
                              {trackedParcel.stage.replace("_", " ")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between px-1">
                            {PARCEL_STAGE_FLOW.map((step, i) => {
                              const currentIndex = PARCEL_STAGE_FLOW.findIndex((s) => s.id === trackedParcel.stage);
                              const reached = i <= currentIndex;
                              return (
                                <div key={step.id} className="flex-1 flex flex-col items-center relative">
                                  {i > 0 && (
                                    <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`} />
                                  )}
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${reached ? "bg-[#0EA5E9]" : "bg-gray-200 dark:bg-gray-700"}`}>
                                    {reached && <CheckCircle2 className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className={`text-[9px] mt-1 text-center ${reached ? "text-[#1A1A2E] dark:text-[#E5E7EB] font-medium" : "text-[#9CA3AF]"}`}>
                                    {t(step.labelKey)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0F172A] rounded-xl p-3">
                            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-[#FF6B00]">{trackedParcel.driverName.charAt(0)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{trackedParcel.driverName}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">{trackedParcel.vehicle}</p>
                            </div>
                            <a href={`tel:${trackedParcel.driverPhone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center flex-shrink-0">
                              <Phone className="w-4 h-4 text-[#138808]" />
                            </a>
                          </div>

                          {trackedParcel.stage === "arrived" && (
                            <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-1.5">
                                <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                                <p className="text-xs font-medium text-[#FF6B00]">{t("home.courierArrivedEnterPin")}</p>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={pinInput}
                                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                  placeholder={t("home.fourDigitPin")}
                                  inputMode="numeric"
                                  className="flex-1 bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] tracking-widest text-center"
                                />
                                <button
                                  onClick={handleConfirmParcelPin}
                                  disabled={pinInput.length !== 4 || confirmParcelDeliveryMutation.isPending}
                                  className="px-4 rounded-lg bg-[#FF6B00] text-white text-sm font-medium disabled:opacity-50"
                                >
                                  {t("home.confirm")}
                                </button>
                              </div>
                              {pinError && <p className="text-xs text-[#DC2626]">{pinError}</p>}
                            </div>
                          )}

                          {trackedParcel.stage === "delivered" && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2 text-[#138808]">
                                <PackageCheck className="w-5 h-5" /> <span className="text-sm font-semibold">{t("status.completed")}</span>
                              </div>
                              {trackedParcel.paymentStatus === "confirmed" ? (
                                <p className="text-xs text-center text-[#9CA3AF]">₹{trackedParcel.cost} {t("home.paidVia")} {trackedParcel.paymentMethod}.</p>
                              ) : trackedParcel.paidBy === "receiver" ? (
                                <>
                                  <p className="text-xs text-center text-[#6B7280] dark:text-[#9CA3AF]">{t("home.pay")} ₹{trackedParcel.cost} {t("home.toCompleteDelivery")}</p>
                                  {renderParcelPaymentPicker(
                                    trackedParcel.cost,
                                    handleTrackedParcelPayment,
                                    submitParcelPaymentMutation.isPending ? submitParcelPaymentMutation.variables?.method ?? null : null
                                  )}
                                </>
                              ) : (
                                <p className="text-xs text-center text-[#9CA3AF]">{t("home.waitingSenderPayment")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FULL STATE — Advertising, Wallet, Offers, Subscription, Nearby, Recent, Safety, Weather */}
            {sheetState === "full" && (
              <div className="space-y-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                {/* Large sponsored client-ad banner — bigger, dedicated advertising slot */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{t("home.sponsored")}</p>
                    {adSlide && <span className="text-[10px] text-[#9CA3AF]">{adSlide.adType}</span>}
                  </div>
                  <div
                    className="rounded-2xl overflow-hidden relative select-none touch-pan-y"
                    onPointerDown={handleAdBannerPointerDown}
                    onPointerUp={handleAdBannerPointerUp}
                  >
                    {adSlide ? (
                      <>
                        <div
                          className="flex transition-transform duration-500 ease-out"
                          style={{ transform: `translateX(-${(adSlideIndex % activeCampaigns.length) * 100}%)` }}
                        >
                          {activeCampaigns.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedAdCampaign(c)}
                              className="w-full flex-shrink-0 flex items-center gap-4 p-5 min-h-[120px] text-left"
                              style={{ background: `linear-gradient(135deg, ${c.creativeColor}, ${c.creativeColor}CC)` }}
                            >
                              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <Megaphone className="w-7 h-7 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">{c.advertiserName}</p>
                                <p className="text-base font-bold text-white truncate">{c.name}</p>
                                <p className="text-[11px] text-white/75 truncate">{c.targetArea}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                        {activeCampaigns.length > 1 && (
                          <div className="flex items-center justify-center gap-1.5 py-2" style={{ backgroundColor: `${adSlide.creativeColor}20` }}>
                            {activeCampaigns.map((c, i) => (
                              <button
                                key={c.id}
                                onClick={() => goToAdBanner(i)}
                                aria-label={`Go to ad ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === adSlideIndex % activeCampaigns.length ? "w-4" : "w-1.5 opacity-50"
                                }`}
                                style={{ backgroundColor: adSlide.creativeColor }}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-4 p-5 min-h-[120px] bg-gray-100 dark:bg-[#0F172A] border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-7 h-7 text-[#9CA3AF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{t("home.adSpaceAvailable")}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{t("home.reachThousandsRiders")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate("/user/wallet")} className="bg-white dark:bg-[#0F172A] border border-gray-100 dark:border-gray-700 rounded-2xl p-3 text-left">
                    <Wallet className="w-5 h-5 text-[#FF6B00] mb-1.5" />
                    <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("driver.wallet")}</p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">₹342 {t("home.balance")}</p>
                  </button>
                  <button onClick={() => navigate("/user/subscription")} className="bg-gradient-to-br from-[#1A1A2E] to-[#2D2D4A] rounded-2xl p-3 text-left">
                    <Crown className="w-5 h-5 text-[#FFD700] mb-1.5" />
                    <p className="text-xs font-semibold text-white">{t("home.flyingPlus")}</p>
                    <p className="text-[10px] text-white/60">{activePlan ? `${activePlan.name} ${t("status.active")}` : t("home.upgradeAndSave")}</p>
                  </button>
                </div>

                {visibleQuickTiles.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-2">{t("home.moreForYou")}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {visibleQuickTiles.map((tile) => {
                        const meta = QUICK_TILE_META[tile.id];
                        return (
                          <button key={tile.id} onClick={meta.action} className="flex flex-col items-center gap-1 py-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
                              <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                            </div>
                            <span className="text-[9px] text-[#6B7280] dark:text-[#9CA3AF] text-center">{tile.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {visibleOfferTeasers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{t("home.offersForYou")}</p>
                      <button onClick={() => navigate("/user/offers")} className="text-[11px] text-[#FF6B00] font-medium">{t("seeAll")}</button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {visibleOfferTeasers.map((o) => (
                        <div key={o.id} className="flex-shrink-0 w-40 rounded-xl p-3" style={{ backgroundColor: o.bg }}>
                          <p className="text-xs font-bold" style={{ color: o.color }}>{o.title}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: o.color }}>{o.subtitle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate("/user/history")} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-left">
                    <History className="w-4 h-4 text-[#0EA5E9] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.recentTrips")}</span>
                  </button>
                  <button onClick={() => navigate("/user/safety")} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-left">
                    <ShieldAlert className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("safety.title")}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-[#E0F2FE] dark:bg-[#0C2536] rounded-xl p-3">
                  <Cloud className="w-5 h-5 text-[#0EA5E9] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0369A1] dark:text-[#7DD3FC]">
                      {weather.tempC !== null ? `${Math.round(weather.tempC)}°C · ${weather.description}` : t("home.loadingWeather")}
                    </p>
                    <p className="text-[10px] text-[#0369A1]/70 dark:text-[#7DD3FC]/70">{t("home.atCurrentLocation")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advertiser Details Sheet — opened by tapping the sponsored ad banner */}
      {selectedAdCampaign && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedAdCampaign(null)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full sm:max-w-sm sm:mx-4 sm:my-8 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[85vh] flex flex-col">
            <div
              className="p-5 flex-shrink-0 relative"
              style={{ background: `linear-gradient(135deg, ${selectedAdCampaign.creativeColor}, ${selectedAdCampaign.creativeColor}CC)` }}
            >
              <button
                onClick={() => setSelectedAdCampaign(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
                <Megaphone className="w-7 h-7 text-white" />
              </div>
              <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">{t("home.sponsored")}</p>
              <p className="text-lg font-bold text-white">{selectedAdCampaign.advertiserName}</p>
              <p className="text-sm text-white/85">{selectedAdCampaign.name}</p>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <MapPin className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#9CA3AF]">{t("home.targetArea")}</p>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{selectedAdCampaign.targetArea}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <Megaphone className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#9CA3AF]">{t("home.adType")}</p>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{selectedAdCampaign.adType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <CalendarClock className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#9CA3AF]">{t("home.running")}</p>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                    {new Date(selectedAdCampaign.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                    {new Date(selectedAdCampaign.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              {selectedAdCampaign.impressions > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <Eye className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  <div>
                    <p className="text-xs text-[#9CA3AF]">{t("home.seenBy")}</p>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{selectedAdCampaign.impressions.toLocaleString("en-IN")}+ {t("home.riders")}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedAdCampaign(null)}
                className="w-full font-semibold py-3 rounded-xl text-white mt-2"
                style={{ backgroundColor: selectedAdCampaign.creativeColor }}
              >
                {t("home.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Ride / Cancel Search — reason picker */}
      {showCancelSheet && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end" onClick={() => setShowCancelSheet(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">
              {rideFlowStage === "matched" ? t("home.cancelRideQuestion") : t("home.cancelSearchQuestion")}
            </h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">{t("home.tellUsWhy")}</p>

            {cancelPreviewQuery.data && (
              <div
                className={`rounded-xl p-3 mb-4 text-sm font-medium ${
                  cancelPreviewQuery.data.fee > 0
                    ? "bg-red-50 dark:bg-[#3A1A1A] text-[#DC2626]"
                    : "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
                }`}
              >
                {cancelPreviewQuery.data.fee > 0
                  ? `${t("home.cancellingMayCost")} ₹${cancelPreviewQuery.data.fee} ${t("home.cancellationFee")}.`
                  : cancelPreviewQuery.data.waiveReason ?? t("home.freeToCancelNow")}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {[...CANCEL_REASONS, OTHER_CANCEL_REASON].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setSelectedCancelReason(reason)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                    selectedCancelReason === reason
                      ? "border-[#DC2626] bg-red-50 dark:bg-[#3A1A1A]"
                      : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      selectedCancelReason === reason ? "border-[#DC2626]" : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {selectedCancelReason === reason && <div className="w-2 h-2 rounded-full bg-[#DC2626]" />}
                  </div>
                  <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t(CANCEL_REASON_KEYS[reason])}</span>
                </button>
              ))}
            </div>

            {selectedCancelReason === OTHER_CANCEL_REASON && (
              <textarea
                value={customCancelReason}
                onChange={(e) => setCustomCancelReason(e.target.value)}
                placeholder={t("home.tellUsReasonPlaceholder")}
                rows={3}
                autoFocus
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#DC2626] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] resize-none mb-4"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelSheet(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3.5 rounded-xl"
              >
                {t("home.goBack")}
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!selectedCancelReason || (selectedCancelReason === OTHER_CANCEL_REASON && !customCancelReason.trim())}
                className="flex-1 bg-[#DC2626] text-white font-semibold py-3.5 rounded-xl hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {t("home.confirmCancellation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup OTP QR — lets the Captain scan instead of typing the 4 digits */}
      {showOtpQr && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowOtpQr(false)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl w-full max-w-[280px] p-6 flex flex-col items-center text-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowOtpQr(false)}
              className="self-end -mt-2 -mr-2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            </button>
            {otpQrDataUrl ? (
              <img src={otpQrDataUrl} alt="Pickup OTP QR code" className="w-48 h-48 rounded-xl" />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-[#F8F9FA] dark:bg-[#0F172A] animate-pulse" />
            )}
            <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.showThisToCaptain")}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {t("home.scanToVerifyOrReadCode")} <span className="font-semibold text-[#138808]">{rideOtp}</span>
            </p>
          </div>
        </div>
      )}

      {/* Rate Captain — a real popup (not an inline expand), stars + an
          optional comment; submitting also recomputes the driver's aggregate
          rating server-side (ride-router.ts's rate mutation). */}
      {showRatePopup && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowRatePopup(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.rateYourRide")}</h2>
              <button onClick={() => setShowRatePopup(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              </button>
            </div>
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => handleRateCaptain(star)} className="transition-transform hover:scale-110">
                  <svg className={`w-9 h-9 ${star <= rating ? "text-[#FF6B00] fill-[#FF6B00]" : "text-gray-300 dark:text-gray-600"}`} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                {rating === 1 && t("home.ratingTerrible")}
                {rating === 2 && t("home.ratingBad")}
                {rating === 3 && t("home.ratingOkay")}
                {rating === 4 && t("home.ratingGood")}
                {rating === 5 && t("home.ratingAwesome")}
              </p>
            )}
            <textarea
              value={ratingReview}
              onChange={(e) => setRatingReview(e.target.value)}
              placeholder={t("home.addCommentOptional")}
              rows={3}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] resize-none mb-4 mt-2"
            />
            <button
              onClick={handleSubmitRating}
              disabled={rating === 0 || rateRideMutation.isPending}
              className="w-full bg-[#FF6B00] text-white font-semibold py-3 rounded-xl hover:bg-[#E65A00] transition-colors disabled:opacity-50"
            >
              {rateRideMutation.isPending ? t("home.submitting") : t("home.submitRating")}
            </button>
          </div>
        </div>
      )}

      {/* Tip Captain — a real wallet-to-wallet transfer on top of the fare,
          credited straight to the driver's wallet. */}
      {showTipPopup && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowTipPopup(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("home.tipYourCaptain")}</h2>
              <button onClick={() => setShowTipPopup(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close">
                <X className="w-4 h-4 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              </button>
            </div>
            {tipSentAmount ? (
              <p className="text-sm text-center text-[#138808] font-medium py-4">₹{tipSentAmount} {t("home.tipSentThankYou")}</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {TIP_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setTipAmount(amt); setCustomTip(""); }}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        tipAmount === amt ? "bg-[#FF6B00] text-white" : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                  <input
                    value={customTip}
                    onChange={(e) => { setCustomTip(e.target.value.replace(/[^0-9]/g, "")); setTipAmount(null); }}
                    placeholder={t("home.custom")}
                    className="w-20 flex-shrink-0 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-2 py-2 text-sm text-center outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                {tipError && <p className="text-xs text-[#DC2626] mb-2">{tipError}</p>}
                <button
                  onClick={() => handleSendTip(tipAmount ?? (Number(customTip) || 0))}
                  disabled={tipDriverMutation.isPending || (!tipAmount && !customTip)}
                  className="w-full bg-[#FF6B00] text-white font-semibold py-3 rounded-xl hover:bg-[#E65A00] transition-colors disabled:opacity-50 mt-2"
                >
                  {tipDriverMutation.isPending ? t("home.sending") : `${t("home.send")} ${tipAmount || customTip ? `₹${tipAmount ?? customTip}` : ""} ${t("home.tip")}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <FloatingAiChat open={showAiChat} onClose={() => setShowAiChat(false)} onBookRide={handleBookRideFromAi} />

      {/* Hidden once vehicle selection takes over the sheet — that panel
          needs the space the nav bar would otherwise occupy. */}
      {!((mode === "ride" && showFareSheet && rideFlowStage === "idle") || rideFlowStage === "completed") && (
        <BottomNav role="user" />
      )}
    </div>
  );
}
