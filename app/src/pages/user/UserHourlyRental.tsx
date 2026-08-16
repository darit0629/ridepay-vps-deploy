import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, IndianRupee, Car, Bike, CircleDot, Zap, Clock3, Check } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };

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

export default function UserHourlyRental() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<Point | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("e-riksha");
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: packages } = trpc.rental.listPackages.useQuery();
  const packagesForVehicle = (packages ?? []).filter((p) => p.vehicleType === vehicleType);
  const selectedPackage = packagesForVehicle.find((p) => p.hours === selectedHours);

  const bookMutation = trpc.ride.book.useMutation();
  const canSubmit = !!pickup && !!selectedPackage;

  const handleBook = async () => {
    if (!pickup || !selectedPackage) return;
    setError(null);
    try {
      await bookMutation.mutateAsync({
        pickupLat: String(pickup.lat), pickupLng: String(pickup.lng), pickupAddress: pickup.address,
        vehicleType, segment: "reserve", aiMultiplier: 1,
        isHourlyRental: true, rentalHours: selectedPackage.hours,
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
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Hourly Rental</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-start gap-3 bg-[#F3E8FF] dark:bg-[#2D1B4E] rounded-2xl p-4">
          <Clock3 className="w-5 h-5 text-[#7C3AED] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#5B21B6] dark:text-[#D8B4FE]">
            Book a driver by the hour — go wherever you need, the meter's already set. No fixed destination required.
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
                  onClick={() => { setVehicleType(v.id); setSelectedHours(null); }}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    vehicleType === v.id ? "bg-[#7C3AED] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                  }`}
                >
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Choose a Package</h2>
          <div className="space-y-2">
            {packagesForVehicle.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedHours(pkg.hours)}
                className={`w-full flex items-center justify-between rounded-xl p-3.5 border-2 transition-colors ${
                  selectedHours === pkg.hours ? "border-[#7C3AED] bg-[#F3E8FF] dark:bg-[#2D1B4E]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{pkg.hours} Hour{pkg.hours > 1 ? "s" : ""}</p>
                  <p className="text-[11px] text-[#9CA3AF]">Up to {pkg.includedKm} km included · ₹{pkg.extraHourRate}/extra hour</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">
                    <IndianRupee className="w-3.5 h-3.5" />{pkg.basePrice}
                  </span>
                  {selectedHours === pkg.hours && (
                    <div className="w-5 h-5 rounded-full bg-[#7C3AED] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

        <button
          onClick={handleBook}
          disabled={!canSubmit || bookMutation.isPending}
          className="w-full bg-[#7C3AED] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {bookMutation.isPending ? "Booking..." : selectedPackage ? `Book for ₹${selectedPackage.basePrice}` : "Book Hourly Rental"}
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
