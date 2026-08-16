import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  EMPTY_ONBOARDING_DATA, TOTAL_STEPS, STEP_TITLES, type OnboardingData,
  isPersonalStepValid, isAddressStepValid, isVehicleTypeStepValid, isVehicleDetailsStepValid,
  isDocumentsStepValid, isBankStepValid, isPreferencesStepValid, isAgreementStepValid,
} from "./onboardingTypes";
import StepWelcome from "./StepWelcome";
import StepMobileConfirm from "./StepMobileConfirm";
import StepPersonal from "./StepPersonal";
import StepAddress from "./StepAddress";
import StepVehicleType from "./StepVehicleType";
import StepVehicleDetails from "./StepVehicleDetails";
import StepDocuments from "./StepDocuments";
import StepBank from "./StepBank";
import StepPreferences from "./StepPreferences";
import StepTerms from "./StepTerms";
import StepReview from "./StepReview";
import StepSubmitted from "./StepSubmitted";

// Server-computed floor on where a driver can resume — mirrors
// ONBOARDING_STEP_NUMBER in api/driver-router.ts. Resuming always lands one
// step past whatever was last actually saved.
function resumeStepFor(onboardingStep: number, submitted: boolean): number {
  if (submitted) return 12;
  if (onboardingStep <= 0) return 1;
  return Math.min(11, onboardingStep + 1);
}

export default function DriverOnboarding() {
  const navigate = useNavigate();
  const { user, refresh: refreshAuth } = useAuth();
  const utils = trpc.useUtils();
  const { data: profile, isLoading: profileLoading } = trpc.driver.getProfile.useQuery();

  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(EMPTY_ONBOARDING_DATA);
  const [error, setError] = useState("");
  const seededRef = useRef(false);

  // Seeds local wizard state from whatever's already saved — once. Doing
  // this more than once would clobber in-progress edits every time an
  // unrelated query (e.g. the ad-hoc IFSC lookup) happens to refetch this one.
  useEffect(() => {
    if (seededRef.current || profileLoading) return;
    seededRef.current = true;
    setCurrentStep(resumeStepFor(profile?.onboardingStep ?? 0, !!profile?.onboardingSubmittedAt));
    setData({
      name: user?.name ?? "",
      dob: user?.dob ?? "",
      gender: user?.gender ?? "",
      email: user?.email ?? "",
      emergencyContact: profile?.emergencyContact ?? "",
      address: profile?.address ?? "",
      landmark: profile?.landmark ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      pincode: profile?.pincode ?? "",
      vehicleType: (profile?.vehicleType as OnboardingData["vehicleType"]) ?? "",
      vehicleNumber: profile?.vehicleNumber ?? "",
      vehicleBrand: profile?.vehicleBrand ?? "",
      vehicleModel: profile?.vehicleModel ?? "",
      manufacturingYear: profile?.manufacturingYear ?? "",
      vehicleColor: profile?.vehicleColor ?? "",
      documents: profile?.documents ?? {},
      bankAccountHolderName: profile?.bankAccountHolderName ?? "",
      bankName: profile?.bankName ?? "",
      bankAccountNumber: profile?.bankAccountNumber ?? "",
      bankIfscCode: profile?.bankIfscCode ?? "",
      bankBranchName: profile?.bankBranchName ?? "",
      bankVerified: profile?.bankVerified ?? false,
      upiId: profile?.upiId ?? "",
      serviceType: (profile?.serviceType as OnboardingData["serviceType"]) ?? "",
      availability: (profile?.availability as OnboardingData["availability"]) ?? "",
      operatingAreas: profile?.operatingAreas ?? [],
      acceptedTerms: !!profile?.acceptedTermsAt,
      acceptedPrivacy: !!profile?.acceptedTermsAt,
      acceptedGuidelines: !!profile?.acceptedTermsAt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const saveStepMutation = trpc.driver.saveOnboardingStep.useMutation();
  const submitMutation = trpc.driver.submitOnboarding.useMutation();

  const goTo = (step: number) => {
    setError("");
    setCurrentStep(step);
    window.scrollTo({ top: 0 });
  };

  const handleBack = () => {
    if (currentStep <= 1) return;
    goTo(currentStep - 1);
  };

  const handleNext = async () => {
    setError("");
    try {
      if (currentStep === 1 || currentStep === 2) {
        goTo(currentStep + 1);
        return;
      }
      if (currentStep === 3) {
        if (!isPersonalStepValid(data)) return setError("Please fill in every field above.");
        await saveStepMutation.mutateAsync({
          step: "personal", name: data.name.trim(), dob: data.dob, gender: data.gender,
          email: data.email.trim() || undefined, emergencyContact: data.emergencyContact.trim(),
        });
        refreshAuth();
        goTo(4);
        return;
      }
      if (currentStep === 4) {
        if (!isAddressStepValid(data)) return setError("Please fill in every field above.");
        await saveStepMutation.mutateAsync({
          step: "address", address: data.address.trim(), landmark: data.landmark.trim() || undefined,
          city: data.city.trim(), state: data.state.trim(), pincode: data.pincode.trim(),
        });
        goTo(5);
        return;
      }
      if (currentStep === 5) {
        if (!isVehicleTypeStepValid(data)) return setError("Please choose a vehicle type.");
        await saveStepMutation.mutateAsync({ step: "vehicleType", vehicleType: data.vehicleType as Exclude<OnboardingData["vehicleType"], "">  });
        goTo(6);
        return;
      }
      if (currentStep === 6) {
        if (!isVehicleDetailsStepValid(data)) return setError("Please fill in every field above.");
        await saveStepMutation.mutateAsync({
          step: "vehicleDetails", vehicleNumber: data.vehicleNumber.trim().toUpperCase(), vehicleBrand: data.vehicleBrand.trim(),
          vehicleModel: data.vehicleModel.trim(), manufacturingYear: data.manufacturingYear.trim(), vehicleColor: data.vehicleColor.trim(),
        });
        goTo(7);
        return;
      }
      if (currentStep === 7) {
        if (!isDocumentsStepValid(data)) return setError("Please upload every required document.");
        await saveStepMutation.mutateAsync({ step: "documents" });
        goTo(8);
        return;
      }
      if (currentStep === 8) {
        if (!isBankStepValid(data)) return setError("Please fill in every field above with a valid IFSC code.");
        await saveStepMutation.mutateAsync({
          step: "bank", bankAccountHolderName: data.bankAccountHolderName.trim(), bankName: data.bankName.trim(),
          bankAccountNumber: data.bankAccountNumber.trim(), bankIfscCode: data.bankIfscCode.trim().toUpperCase(),
          upiId: data.upiId.trim() || undefined,
        });
        goTo(9);
        return;
      }
      if (currentStep === 9) {
        if (!isPreferencesStepValid(data)) return setError("Please complete your ride preferences.");
        await saveStepMutation.mutateAsync({
          step: "preferences", serviceType: data.serviceType as Exclude<OnboardingData["serviceType"], "">,
          availability: data.availability as Exclude<OnboardingData["availability"], "">, operatingAreas: data.operatingAreas,
        });
        goTo(10);
        return;
      }
      if (currentStep === 10) {
        if (!isAgreementStepValid(data)) return setError("Please accept all three agreements to continue.");
        await saveStepMutation.mutateAsync({
          step: "agreement", acceptedTerms: data.acceptedTerms, acceptedPrivacy: data.acceptedPrivacy, acceptedGuidelines: data.acceptedGuidelines,
        });
        goTo(11);
        return;
      }
      if (currentStep === 11) {
        await submitMutation.mutateAsync();
        utils.driver.getProfile.invalidate();
        goTo(12);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  };

  const saving = saveStepMutation.isPending || submitMutation.isPending;
  const showChrome = currentStep >= 2 && currentStep <= 11;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B0F1A] via-[#12172A] to-[#0B0F1A] text-white">
      {showChrome && (
        <div className="sticky top-0 z-20 bg-[#0B0F1A]/80 backdrop-blur-xl border-b border-white/5 px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleBack}
              aria-label="Back"
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/50">Step {currentStep} of {TOTAL_STEPS}</p>
              <p className="text-sm font-bold truncate">{STEP_TITLES[currentStep - 1]}</p>
            </div>
            <span className="text-xs font-semibold text-[#FF6B00] flex-shrink-0">{Math.round((currentStep / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div key={currentStep} className="animate-onboarding-step px-5 py-6 pb-32 max-w-md mx-auto">
        {currentStep === 1 && <StepWelcome onStart={() => goTo(2)} />}
        {currentStep === 2 && <StepMobileConfirm phone={user?.phone ?? ""} />}
        {currentStep === 3 && <StepPersonal data={data} update={update} />}
        {currentStep === 4 && <StepAddress data={data} update={update} />}
        {currentStep === 5 && <StepVehicleType data={data} update={update} />}
        {currentStep === 6 && <StepVehicleDetails data={data} update={update} />}
        {currentStep === 7 && <StepDocuments data={data} update={update} />}
        {currentStep === 8 && <StepBank data={data} update={update} />}
        {currentStep === 9 && <StepPreferences data={data} update={update} />}
        {currentStep === 10 && <StepTerms data={data} update={update} />}
        {currentStep === 11 && <StepReview data={data} onEditStep={goTo} />}
        {currentStep === 12 && <StepSubmitted onGoToDashboard={() => navigate("/driver/dashboard", { replace: true })} />}
      </div>

      {showChrome && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-[#0B0F1A]/90 backdrop-blur-xl border-t border-white/5 px-5 py-4">
          <div className="max-w-md mx-auto">
            {error && <p className="text-xs text-[#FF6B6B] text-center mb-2">{error}</p>}
            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-[0_8px_24px_rgba(255,107,0,0.35)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {saving ? "Saving…" : currentStep === 11 ? "Submit for Review" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
