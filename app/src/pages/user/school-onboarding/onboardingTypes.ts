export const DEFAULT_COORDS = { lat: 22.69, lng: 88.37 }; // Ranaghat, same fallback UserHome.tsx uses

export interface SchoolOnboardingData {
  // Student
  studentName: string;
  studentPhotoUrl: string;
  studentIdPhotoUrl: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  className: string;
  section: string;
  rollNumber: string;
  dropCoords: { lat: number; lng: number };
  // Guardian
  guardianPhotoUrl: string;
  guardianEmail: string;
  emergencyContact: string;
  authorizedPickupPersons: string; // comma-separated, split on submit
  // Logistics
  homeAddress: string;
  pickupCoords: { lat: number; lng: number };
  morningPickupTime: string;
  schoolReportingTime: string;
  schoolEndTime: string;
  returnPickupTime: string;
  // Medical
  medicalNotes: string;
  allergies: string;
  specialInstructions: string;
  // Plan
  planId: string;
  // Consent
  consentAccepted: boolean;
  // Set once createSubscription succeeds at the Payment step — everything
  // above is local until then (no server partial-save-per-step, unlike the
  // driver onboarding wizard: the only slow/interruptible step here is
  // payment, which gets its own durable server state once this exists).
  subscriptionId: string;
}

export const EMPTY_ONBOARDING_DATA: SchoolOnboardingData = {
  studentName: "", studentPhotoUrl: "", studentIdPhotoUrl: "", schoolName: "", schoolAddress: "", schoolPhone: "",
  className: "", section: "", rollNumber: "", dropCoords: DEFAULT_COORDS,
  guardianPhotoUrl: "", guardianEmail: "", emergencyContact: "", authorizedPickupPersons: "",
  homeAddress: "", pickupCoords: DEFAULT_COORDS,
  morningPickupTime: "07:30", schoolReportingTime: "08:00", schoolEndTime: "14:30", returnPickupTime: "14:45",
  medicalNotes: "", allergies: "", specialInstructions: "",
  planId: "", consentAccepted: false, subscriptionId: "",
};

export const TOTAL_STEPS = 9;
export const STEP_TITLES = [
  "Welcome", "Student Details", "Guardian Details", "Pickup & Timings",
  "Medical & Instructions", "Choose a Plan", "Consent", "Payment", "Submitted",
];

export function isStudentStepValid(d: SchoolOnboardingData): boolean {
  return !!(d.studentName.trim() && d.schoolName.trim() && d.schoolAddress.trim());
}
export function isGuardianStepValid(d: SchoolOnboardingData): boolean {
  return !!d.emergencyContact.trim();
}
export function isLogisticsStepValid(d: SchoolOnboardingData): boolean {
  return !!d.homeAddress.trim();
}
export function isPlanStepValid(d: SchoolOnboardingData): boolean {
  return !!d.planId;
}
export function isConsentStepValid(d: SchoolOnboardingData): boolean {
  return d.consentAccepted;
}
