// Shared shape for the whole 12-step wizard's in-progress form state — kept
// as one flat object so navigating back and forth between steps never loses
// what's already been typed, and so DriverOnboarding.tsx can seed it in one
// shot from the driver's saved profile on resume.
export interface OnboardingData {
  // Step 3 — Personal (name/dob/gender/email live on `users`, not driver_profiles)
  name: string;
  dob: string;
  gender: string;
  email: string;
  emergencyContact: string;
  // Step 4 — Address
  address: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  // Step 5 — Vehicle Type
  vehicleType: VehicleTypeId | "";
  // Step 6 — Vehicle Details
  vehicleNumber: string;
  vehicleBrand: string;
  vehicleModel: string;
  manufacturingYear: string;
  vehicleColor: string;
  // Step 7 — Documents (data: URIs — no object storage in this prototype)
  documents: Partial<Record<DocumentKey, string>>;
  // Step 8 — Bank
  bankAccountHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankBranchName: string;
  bankVerified: boolean;
  upiId: string;
  // Step 9 — Preferences
  serviceType: "ride" | "parcel" | "both" | "";
  availability: "fulltime" | "parttime" | "";
  operatingAreas: string[];
  // Step 10 — Agreement
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedGuidelines: boolean;
}

export const EMPTY_ONBOARDING_DATA: OnboardingData = {
  name: "",
  dob: "",
  gender: "",
  email: "",
  emergencyContact: "",
  address: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  vehicleType: "",
  vehicleNumber: "",
  vehicleBrand: "",
  vehicleModel: "",
  manufacturingYear: "",
  vehicleColor: "",
  documents: {},
  bankAccountHolderName: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfscCode: "",
  bankBranchName: "",
  bankVerified: false,
  upiId: "",
  serviceType: "",
  availability: "",
  operatingAreas: [],
  acceptedTerms: false,
  acceptedPrivacy: false,
  acceptedGuidelines: false,
};

export type VehicleTypeId = "Toto" | "Auto Rickshaw" | "Bike" | "Car";
export const VEHICLE_TYPES: VehicleTypeId[] = ["Toto", "Auto Rickshaw", "Bike", "Car"];

export type DocumentKey = "license" | "aadhaar" | "pan" | "rc" | "insurance" | "pollution" | "profilePhoto" | "selfie" | "vehiclePhoto";

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  license: "Driving Licence",
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  rc: "Vehicle RC",
  insurance: "Insurance",
  pollution: "Pollution Certificate",
  profilePhoto: "Profile Photo",
  selfie: "Selfie Verification",
  vehiclePhoto: "Vehicle Photo",
};

// Toto (e-rickshaw) is electric — no PUC requirement in practice, so it's the
// one vehicle type that skips the pollution certificate. Everything else
// needed to actually verify a driver is the same across vehicle types.
export function requiredDocumentsFor(vehicleType: VehicleTypeId | ""): DocumentKey[] {
  const base: DocumentKey[] = ["license", "aadhaar", "pan", "rc", "insurance", "profilePhoto", "selfie"];
  if (vehicleType && vehicleType !== "Toto") base.splice(5, 0, "pollution");
  return base;
}

export const OPTIONAL_DOCUMENTS: DocumentKey[] = ["vehiclePhoto"];

export const OPERATING_AREAS = [
  "Ranaghat", "Krishnanagar", "Kalyani", "Chakdaha", "Shantipur",
  "Nabadwip", "Taherpur", "Birnagar", "Payradanga", "Duttapukur",
];

export const TOTAL_STEPS = 12;

export const STEP_TITLES = [
  "Welcome",
  "Mobile Verified",
  "Personal Details",
  "Address",
  "Vehicle Type",
  "Vehicle Details",
  "Documents",
  "Bank Details",
  "Ride Preferences",
  "Terms & Agreement",
  "Review",
  "Submitted",
];

export function isPersonalStepValid(d: OnboardingData): boolean {
  return d.name.trim().length > 1 && d.dob.length > 0 && d.gender.length > 0 && d.emergencyContact.trim().length >= 10;
}
export function isAddressStepValid(d: OnboardingData): boolean {
  return d.address.trim().length > 0 && d.city.trim().length > 0 && d.state.trim().length > 0 && d.pincode.trim().length >= 4;
}
export function isVehicleTypeStepValid(d: OnboardingData): boolean {
  return d.vehicleType !== "";
}
export function isVehicleDetailsStepValid(d: OnboardingData): boolean {
  return (
    d.vehicleNumber.trim().length > 0 &&
    d.vehicleBrand.trim().length > 0 &&
    d.vehicleModel.trim().length > 0 &&
    d.manufacturingYear.trim().length === 4 &&
    d.vehicleColor.trim().length > 0
  );
}
export function isDocumentsStepValid(d: OnboardingData): boolean {
  return requiredDocumentsFor(d.vehicleType).every((key) => !!d.documents[key]);
}
export function isBankStepValid(d: OnboardingData): boolean {
  return (
    d.bankAccountHolderName.trim().length > 0 &&
    d.bankName.trim().length > 0 &&
    d.bankAccountNumber.trim().length >= 4 &&
    /^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bankIfscCode.trim().toUpperCase())
  );
}
export function isPreferencesStepValid(d: OnboardingData): boolean {
  return d.serviceType !== "" && d.availability !== "" && d.operatingAreas.length > 0;
}
export function isAgreementStepValid(d: OnboardingData): boolean {
  return d.acceptedTerms && d.acceptedPrivacy && d.acceptedGuidelines;
}
