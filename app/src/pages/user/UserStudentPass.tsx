import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, GraduationCap, Upload, Clock, CheckCircle2, XCircle, Loader2, Bell, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { resizeImageToDataUrl, readFileAsDataUrl } from "@/lib/imageCompression";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
type PassPlan = "monthly" | "semester";
type IdMimeType = "" | "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const ACCEPTED_ID_MIME_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_ID_FILE_BYTES = 8 * 1024 * 1024; // 8MB raw — generous for a phone photo; also bounds PDFs, which have no client-side compression step

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };

export default function UserStudentPass() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const customerName = user?.name ?? "";
  // Must match how BottomNav.tsx and SchoolSubscribe.tsx key their
  // listMySubscriptions lookups — the real rider's own phone number, so School
  // Mode subscriptions are scoped to the guardian who actually created them.
  const guardianPhone = user?.phone ?? "";
  const [status, setStatus] = useState<VerificationStatus>("unverified");
  const [institution, setInstitution] = useState("");
  const [studentId, setStudentId] = useState("");
  const [activePlan, setActivePlan] = useState<PassPlan>("monthly");
  const [guardianNotifications, setGuardianNotifications] = useState(true);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [passActivated, setPassActivated] = useState(false);

  const idFileInputRef = useRef<HTMLInputElement>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idFileDataUrl, setIdFileDataUrl] = useState("");
  const [idFileMimeType, setIdFileMimeType] = useState<IdMimeType>("");
  const [idFileError, setIdFileError] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const idUploaded = idFileDataUrl.length > 0 && !readingFile;

  const handlePickIdFile = async (file: File | undefined) => {
    if (!file) return;
    setIdFileError("");
    if (!ACCEPTED_ID_MIME_TYPES.includes(file.type)) {
      setIdFileError("Please upload a JPG, PNG, WEBP photo or a PDF of your student ID.");
      return;
    }
    if (file.size > MAX_ID_FILE_BYTES) {
      setIdFileError("File is too large (max 8MB). Try a smaller photo or scan.");
      return;
    }
    setReadingFile(true);
    try {
      if (file.type === "application/pdf") {
        setIdFileDataUrl(await readFileAsDataUrl(file));
        setIdFileMimeType("application/pdf");
      } else {
        // maxDim/quality bumped above the 1024/0.75 default — ID card print
        // is small; the default avatar-photo settings could compress it
        // past legibility for the extraction step below.
        setIdFileDataUrl(await resizeImageToDataUrl(file, 1400, 0.85));
        setIdFileMimeType("image/jpeg");
      }
      setIdFile(file);
    } catch {
      setIdFileError("Could not read that file — please try again.");
    } finally {
      setReadingFile(false);
    }
  };

  const utils = trpc.useUtils();
  const verifyMutation = trpc.school.verifySubscription.useMutation({
    onSuccess: () => {
      utils.school.listMySubscriptions.invalidate({ guardianPhone });
      setPassActivated(true);
    },
  });
  const createSubscriptionMutation = trpc.school.createSubscription.useMutation({
    onSuccess: (sub) => {
      if (sub) verifyMutation.mutate({ id: sub.id, action: "approve" });
    },
  });

  // This page collects far less than the full School Mode onboarding form
  // (SchoolSubscribe.tsx) does — a student discount pass isn't the same
  // product as a guardian's verified daily school-transport subscription.
  // Activating a pass here still creates (and self-approves, since there's
  // no separate admin review step for this flow) a minimal real subscription
  // so BottomNav's Schedule→School swap reflects it, filling the fields this
  // page doesn't ask about with reasonable defaults.
  const handleActivatePass = () => {
    if (!guardianPhone) return;
    createSubscriptionMutation.mutate({
      guardianPhone,
      guardianName: customerName,
      guardianEmail: "",
      emergencyContact: notifyPhone || guardianPhone,
      studentName: customerName,
      schoolName: institution,
      schoolAddress: institution,
      className: "N/A",
      section: "",
      rollNumber: studentId,
      homeAddress: institution,
      pickupCoords: RANAGHAT_COORDS,
      dropCoords: RANAGHAT_COORDS,
      morningPickupTime: "08:00",
      schoolReportingTime: "08:30",
      schoolEndTime: "14:30",
      returnPickupTime: "14:45",
      medicalNotes: "",
      allergies: "",
      specialInstructions: "",
      authorizedPickupPersons: [],
      planId: activePlan,
      consentAccepted: true,
    });
  };

  const canSubmit = institution.trim().length > 2 && studentId.trim().length > 2 && idUploaded;

  const verifyStudentIdMutation = trpc.ai.verifyStudentId.useMutation({
    onSuccess: (result) => {
      if (result.outcome === "verified") {
        setStatus("verified");
      } else if (result.outcome === "mismatch") {
        setRejectionReason(`The ID number on your document (${result.extractedId}) doesn't match what you entered (${studentId}). Double-check and try again.`);
        setStatus("rejected");
      } else if (result.outcome === "extraction_failed") {
        setRejectionReason("We couldn't find a clear ID number on that document. Try a clearer photo or a different file.");
        setStatus("rejected");
      } else {
        setRejectionReason(result.reason);
        setStatus("rejected");
      }
    },
    onError: () => {
      setRejectionReason("Something went wrong verifying your ID. Please try again.");
      setStatus("rejected");
    },
  });

  const handleSubmit = () => {
    if (!idFileDataUrl || !idFileMimeType) return;
    setStatus("pending");
    verifyStudentIdMutation.mutate({ studentId, institution, mimeType: idFileMimeType, fileDataUrl: idFileDataUrl });
  };

  const plans = [
    { id: "monthly" as PassPlan, label: "Monthly Pass", price: "₹149", detail: "15% off every ride, valid 30 days" },
    { id: "semester" as PassPlan, label: "Semester Pass", price: "₹699", detail: "15% off every ride, valid 6 months - save ₹195" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0EA5E9] to-[#0284C7] px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/user/profile")}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">Student Pass</h1>
          <div className="w-6" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">Ride cheaper as a student</h2>
          <p className="text-white/80 text-sm mt-1">Verify your student ID to unlock discounted passes</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {status === "unverified" && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Verify Your Student ID</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">School / College Name</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Ranaghat College"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#0EA5E9] outline-none text-sm bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Student ID Number</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. RC2024118"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#0EA5E9] outline-none text-sm bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <input
                ref={idFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  void handlePickIdFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => idFileInputRef.current?.click()}
                disabled={readingFile}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors disabled:opacity-60 ${
                  idUploaded ? "border-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]" : "border-[#E5E7EB] dark:border-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {readingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Reading file...
                  </>
                ) : idUploaded ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> {idFile?.type === "application/pdf" ? "ID PDF Uploaded" : "ID Photo Uploaded"}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Upload Student ID (Photo or PDF)
                  </>
                )}
              </button>
              {idFileError && <p className="text-xs text-[#DC2626]">{idFileError}</p>}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full btn-saffron py-3.5 mt-4 disabled:opacity-50"
            >
              Submit for Verification
            </button>
          </div>
        )}

        {status === "pending" && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-[#FF6B00] animate-pulse" />
            </div>
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Verification in Progress</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              We're reading your {institution} ID. This only takes a few seconds.
            </p>
          </div>
        )}

        {status === "rejected" && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-7 h-7 text-[#DC2626]" />
            </div>
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Verification Failed</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">{rejectionReason}</p>
            <button onClick={() => setStatus("unverified")} className="w-full btn-saffron py-3 mt-4">
              Try Again
            </button>
          </div>
        )}

        {status === "verified" && (
          <>
            <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#138808] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#138808]">Student ID Verified</p>
                <p className="text-xs text-[#138808]/80">{institution} · ID {studentId}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Choose Your Pass</h3>
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setActivePlan(plan.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-colors ${
                      activePlan === plan.id ? "border-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536]" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E293B]"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.label}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{plan.detail}</p>
                    </div>
                    <p className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.price}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={handleActivatePass}
                disabled={createSubscriptionMutation.isPending || verifyMutation.isPending || passActivated}
                className="w-full btn-green py-3.5 mt-4 disabled:opacity-60"
              >
                {passActivated
                  ? "Pass Activated ✓"
                  : createSubscriptionMutation.isPending || verifyMutation.isPending
                  ? "Activating..."
                  : `Activate ${activePlan === "monthly" ? "Monthly" : "Semester"} Pass`}
              </button>
              {passActivated && (
                <p className="text-xs text-[#138808] text-center mt-2">
                  School Mode is now active — find it on your bottom navigation.
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center">
                    <Bell className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Guardian Notifications</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Notify a guardian for every ride</p>
                  </div>
                </div>
                <button
                  onClick={() => setGuardianNotifications(!guardianNotifications)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    guardianNotifications ? "bg-[#138808]" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${
                      guardianNotifications ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {guardianNotifications && (
                <input
                  type="tel"
                  value={notifyPhone}
                  onChange={(e) => setNotifyPhone(e.target.value)}
                  placeholder="Guardian's phone number"
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#0EA5E9] outline-none text-sm mt-3 bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              )}
            </div>

            <button
              onClick={() => navigate("/user/history")}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm"
            >
              <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">View Ride History</span>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
            </button>
          </>
        )}
      </div>

      <BottomNav role="user" />
    </div>
  );
}
