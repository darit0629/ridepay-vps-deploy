import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, IndianRupee, Car, Bike, CircleDot, Zap, CalendarDays } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };
const FULL_DAY_HOURS = 10;

type VehicleType = "e-riksha" | "auto-rickshaw" | "car" | "bike";

const VEHICLE_OPTIONS: { id: VehicleType; label: string; icon: typeof Car }[] = [
  { id: "e-riksha", label: "E-Riksha", icon: Zap },
  { id: "auto-rickshaw", label: "Auto", icon: CircleDot },
  { id: "car", label: "Car", icon: Car },
  { id: "bike", label: "Bike", icon: Bike },
];

interface Point {
  address: string;
  lat: number;
  lng: number;
}

export default function UserFullDayRental() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<Point | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("e-riksha");
  const [error, setError] = useState<string | null>(null);

  // Full Day Rental is just Hourly Rental's mechanism (same rides.isHourlyRental
  // flag, same package table, same driver/rider screens) fixed at a single
  // long duration — reuses rental.listPackages rather than a parallel table.
  const { data: packages } = trpc.rental.listPackages.useQuery();
  const selectedPackage = (packages ?? []).find((p) => p.vehicleType === vehicleType && p.hours === FULL_DAY_HOURS);

  const bookMutation = trpc.ride.book.useMutation();
  const canSubmit = !!pickup && !!selectedPackage;

  const handleBook = async () => {
    if (!pickup || !selectedPackage) return;
    setError(null);
    try {
      await bookMutation.mutateAsync({
        pickupLat: String(pickup.lat), pickupLng: String(pickup.lng), pickupAddress: pickup.address,
        vehicleType, segment: "reserve", aiMultiplier: 1,
        isHourlyRental: true, rentalHours: FULL_DAY_HOURS,
      });
      navigate("/user/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book the rental. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/services")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Full Day Rental</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-start gap-3 bg-[#E8F5E8] dark:bg-[#1A2D1A] rounded-2xl p-4">
          <CalendarDays className="w-5 h-5 text-[#138808] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0D5C05] dark:text-[#4ADE80]">
            Keep a vehicle for a full {FULL_DAY_HOURS}-hour workday — one driver, one flat price, go wherever you need.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Pickup Location</h2>
          <button onClick={() => setPickerOpen(true)} className="w-full flex items-center gap-3 text-left">
            <div className="w-3 h-3 rounded-full bg-[#138808] flex-shrink-0" />
            <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${pickup ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
              {pickup?.address || "Where should the driver pick you up?"}
            </span>
          </button>

          <div className="mt-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Vehicle</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleType(v.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    vehicleType === v.id ? "bg-[#138808] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                  }`}
                >
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedPackage && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{FULL_DAY_HOURS}-hour package price</span>
              <span className="flex items-center font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">
                <IndianRupee className="w-4 h-4" />{selectedPackage.basePrice}
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">
              Up to {selectedPackage.includedKm} km included · ₹{selectedPackage.extraHourRate}/extra hour beyond {FULL_DAY_HOURS}h
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

        <button
          onClick={handleBook}
          disabled={!canSubmit || bookMutation.isPending}
          className="w-full bg-[#138808] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {bookMutation.isPending ? "Booking..." : selectedPackage ? `Book for ₹${selectedPackage.basePrice}` : "Book Full Day Rental"}
        </button>
      </div>

      {pickerOpen && (
        <LocationPickerModal
          open
          title="Set Pickup Location"
          initialCoords={RANAGHAT_COORDS}
          onConfirm={({ address, lat, lng }) => {
            setPickup({ address, lat, lng });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <BottomNav role="user" />
    </div>
  );
}
