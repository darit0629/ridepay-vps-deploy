import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import LocationPickerModal from "@/components/LocationPickerModal";
import {
  EMPTY_ONBOARDING_DATA, TOTAL_STEPS, STEP_TITLES, type SchoolOnboardingData,
  isStudentStepValid, isGuardianStepValid, isLogisticsStepValid, isPlanStepValid, isConsentStepValid,
} from "./onboardingTypes";
import StepWelcome from "./StepWelcome";
import StepStudent from "./StepStudent";
import StepGuardian from "./StepGuardian";
import StepLogistics from "./StepLogistics";
import StepMedical from "./StepMedical";
import StepPlan from "./StepPlan";
import StepConsent from "./StepConsent";
import StepPayment from "./StepPayment";
import StepSubmitted from "./StepSubmitted";

export default function SchoolOnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<SchoolOnboardingData>(EMPTY_ONBOARDING_DATA);
  const [error, setError] = useState("");
  const [mapPickerFor, setMapPickerFor] = useState<"home" | "school" | null>(null);

  const update = <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const goTo = (step: number) => {
    setError("");
    setCurrentStep(step);
    window.scrollTo({ top: 0 });
  };

  const handleBack = () => {
    if (currentStep <= 1) return;
    goTo(currentStep - 1);
  };

  const handleNext = () => {
    setError("");
    if (currentStep === 2 && !isStudentStepValid(data)) return setError("Please fill in the student's name and school details.");
    if (currentStep === 3 && !isGuardianStepValid(data)) return setError("Please add an emergency contact.");
    if (currentStep === 4 && !isLogisticsStepValid(data)) return setError("Please add a home address.");
    if (currentStep === 6 && !isPlanStepValid(data)) return setError("Please choose a plan.");
    if (currentStep === 7 && !isConsentStepValid(data)) return setError("Please accept the consent to continue.");
    goTo(currentStep + 1);
  };

  // Steps 2-7 are plain forms sharing this header/footer chrome. Step 1
  // (Welcome) and Step 8 (Payment, its own async chain) manage their own
  // navigation; Step 9 (Submitted) is a terminal screen.
  const showChrome = currentStep >= 2 && currentStep <= 7;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A]">
      {showChrome && (
        <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/5 px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              aria-label="Back"
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-[#9CA3AF]">Step {currentStep} of {TOTAL_STEPS}</p>
              <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{STEP_TITLES[currentStep - 1]}</p>
            </div>
            <span className="text-xs font-semibold text-[#FF6B00] flex-shrink-0">{Math.round((currentStep / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div key={currentStep} className="animate-onboarding-step px-5 py-6 pb-32 max-w-md mx-auto">
        {currentStep === 1 && <StepWelcome onStart={() => goTo(2)} />}
        {currentStep === 2 && <StepStudent data={data} update={update} onPickOnMap={() => setMapPickerFor("school")} />}
        {currentStep === 3 && <StepGuardian data={data} update={update} />}
        {currentStep === 4 && <StepLogistics data={data} update={update} onPickOnMap={() => setMapPickerFor("home")} />}
        {currentStep === 5 && <StepMedical data={data} update={update} />}
        {currentStep === 6 && <StepPlan data={data} update={update} />}
        {currentStep === 7 && <StepConsent data={data} update={update} />}
        {currentStep === 8 && <StepPayment data={data} update={update} onDone={() => goTo(9)} />}
        {currentStep === 9 && <StepSubmitted onGoToDashboard={() => navigate("/user/school-subscribe", { replace: true })} />}
      </div>

      {showChrome && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl border-t border-gray-100 dark:border-white/5 px-5 py-4">
          <div className="max-w-md mx-auto">
            {error && <p className="text-xs text-[#DC2626] text-center mb-2">{error}</p>}
            <button
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
            >
              {currentStep === 7 ? "Continue to Payment" : "Continue"}
            </button>
          </div>
        </div>
      )}

      <LocationPickerModal
        open={mapPickerFor !== null}
        title={mapPickerFor === "home" ? "Pick Home Location" : "Pick School Location"}
        initialCoords={mapPickerFor === "home" ? data.pickupCoords : data.dropCoords}
        onClose={() => setMapPickerFor(null)}
        onConfirm={({ address, lat, lng }) => {
          if (mapPickerFor === "home") {
            update("homeAddress", address);
            update("pickupCoords", { lat, lng });
          } else if (mapPickerFor === "school") {
            update("schoolAddress", address);
            update("dropCoords", { lat, lng });
          }
          setMapPickerFor(null);
        }}
      />
    </div>
  );
}
