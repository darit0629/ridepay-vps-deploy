import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Star, Wrench, Pencil, Check, Camera, ShieldCheck, Mail, Calendar,
  Users, Car, Landmark, Eye, EyeOff, FileText, CheckCircle2, AlertTriangle, UploadCloud,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useDriverDocuments } from "@/contexts/DriverDocumentsContext";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { resizeImageToDataUrl } from "@/lib/imageCompression";
import { useLanguage } from "@/contexts/LanguageContext";

const genders = ["Male", "Female", "Other", "Prefer not to say"];
const GENDER_KEYS: Record<string, string> = {
  Male: "dprofile.male",
  Female: "dprofile.female",
  Other: "dprofile.other",
  "Prefer not to say": "dprofile.preferNotToSay",
};
const DEFAULT_AVATAR = "/assets/driver-avatar.png";

interface DraftFields {
  name: string;
  email: string;
  gender: string;
  dob: string;
  avatar: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleNumber: string;
  seatCapacity: string;
}

type DocStatus = "valid" | "expiring" | "pending";

const DOC_STATUS_STYLE: Record<DocStatus, { labelKey: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  valid: { labelKey: "dprofile.valid", color: "#138808", bg: "#E8F5E8", icon: CheckCircle2 },
  expiring: { labelKey: "dprofile.expiringSoon", color: "#FF6B00", bg: "#FFF5EB", icon: AlertTriangle },
  pending: { labelKey: "dprofile.pendingReview", color: "#7C3AED", bg: "#F3E8FF", icon: UploadCloud },
};

interface SavedBankDetails {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

const EMPTY_BANK_DETAILS: SavedBankDetails = { accountHolder: "", accountNumber: "", ifsc: "", bankName: "" };


export default function DriverProfile() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const { user, refresh: refreshAuth } = useAuth();
  const utils = trpc.useUtils();
  const { data: driverProfile } = trpc.driver.getProfile.useQuery();
  const updateUserMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => refreshAuth(),
  });
  const updateDriverMutation = trpc.driver.updateProfile.useMutation({
    onSuccess: () => utils.driver.getProfile.invalidate(),
  });

  const phone = user?.phone ? `+91 ${user.phone}` : "";
  const rating = driverProfile ? Number(driverProfile.rating) : 5.0;

  const fieldsFromServer = (): DraftFields => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    gender: user?.gender ?? "",
    dob: user?.dob ?? "",
    avatar: user?.avatar || DEFAULT_AVATAR,
    vehicleType: driverProfile?.vehicleType ?? "",
    vehicleModel: driverProfile?.vehicleModel ?? "",
    vehicleNumber: driverProfile?.vehicleNumber ?? "",
    seatCapacity: driverProfile ? String(driverProfile.seatCapacity) : "",
  });

  const [profile, setProfile] = useState<DraftFields>(fieldsFromServer);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(profile);
  const [justSaved, setJustSaved] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Re-sync once the real profile data arrives (queries resolve after
  // first render) — but never while the driver is mid-edit, so we don't
  // clobber unsaved changes. Adjusts state directly during render (React's
  // documented pattern for this) instead of in an effect, since this only
  // needs to run when the underlying query data itself changes identity.
  const [lastSynced, setLastSynced] = useState({ user, driverProfile });
  if (user !== lastSynced.user || driverProfile !== lastSynced.driverProfile) {
    setLastSynced({ user, driverProfile });
    if (!isEditing) setProfile(fieldsFromServer());
  }

  // Bank/payout details have no backend model in this prototype (unlike
  // name, vehicle, and wallet data, which are all real) — persisted
  // per-device, keyed to this driver's real account so it doesn't leak
  // between different logged-in drivers on the same browser.
  const [bankDetails, setBankDetails] = useState<SavedBankDetails>(EMPTY_BANK_DETAILS);
  const [lastSyncedUserId, setLastSyncedUserId] = useState(user?.id);
  if (user?.id !== lastSyncedUserId) {
    setLastSyncedUserId(user?.id);
    if (user?.id) {
      const saved = localStorage.getItem(`ridepay_bank_details_${user.id}`);
      if (saved) {
        try {
          setBankDetails(JSON.parse(saved) as SavedBankDetails);
        } catch {
          setBankDetails(EMPTY_BANK_DETAILS);
        }
      }
    }
  }
  const [draftBank, setDraftBank] = useState<SavedBankDetails>(bankDetails);

  const { documents, setDocumentStatus } = useDriverDocuments();
  const [updatingDoc, setUpdatingDoc] = useState<string | null>(null);

  const startEditing = () => {
    setDraft(profile);
    setDraftBank(bankDetails);
    setPhotoError("");
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfile(draft);
    setBankDetails(draftBank);
    if (user?.id) localStorage.setItem(`ridepay_bank_details_${user.id}`, JSON.stringify(draftBank));
    setIsEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);

    updateUserMutation.mutate({
      name: draft.name,
      email: draft.email,
      gender: draft.gender,
      dob: draft.dob,
      avatar: draft.avatar,
    });
    updateDriverMutation.mutate({
      vehicleType: draft.vehicleType,
      vehicleModel: draft.vehicleModel,
      vehicleNumber: draft.vehicleNumber,
      seatCapacity: Number(draft.seatCapacity) || undefined,
    });
  };

  const handleCancel = () => {
    setDraft(profile);
    setDraftBank(bankDetails);
    setIsEditing(false);
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setDraft((prev) => ({ ...prev, avatar: dataUrl }));
    } catch {
      setPhotoError(t("dprofile.photoProcessError"));
    }
  };

  const handleDocUpdateClick = (label: string) => {
    setUpdatingDoc(label);
    docFileInputRef.current?.click();
  };

  const handleDocFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !updatingDoc) return;
    setDocumentStatus(updatingDoc, "pending");
    setUpdatingDoc(null);
  };

  const displayed = isEditing ? draft : profile;
  const displayedBank = isEditing ? draftBank : bankDetails;
  const maskedAccount = displayedBank.accountNumber ? `**** **** ${displayedBank.accountNumber.slice(-4)}` : "";

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dprofile.title")}</h1>
          <p className="text-[11px] text-[#9CA3AF]">{t("dprofile.subtitle")}</p>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleCancel} className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] px-2 py-1.5">
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-[#138808] text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#1AA814] transition-colors"
            >
              <Check className="w-4 h-4" /> {t("save")}
            </button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 text-sm font-medium text-[#FF6B00] px-2 py-1.5 hover:bg-[#FFF5EB] dark:hover:bg-[#3D2914] rounded-lg flex-shrink-0"
          >
            <Pencil className="w-4 h-4" /> {t("edit")}
          </button>
        )}
      </div>

      {justSaved && (
        <div className="mx-4 mt-3 flex items-center gap-2 bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] dark:text-[#4ADE80] text-sm font-medium px-4 py-2.5 rounded-xl">
          <Check className="w-4 h-4" /> {t("profile.updated")}
        </div>
      )}

      {/* Identity Card */}
      <div className="bg-white dark:bg-[#1E293B] px-6 py-6 mt-3 sm:mt-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <img
              src={displayed.avatar || DEFAULT_AVATAR}
              alt={displayed.name || "Driver"}
              className="w-16 h-16 rounded-full object-cover border-3 border-[#FF6B00]"
            />
            {isEditing ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF6B00] flex items-center justify-center border-2 border-white dark:border-[#1E293B]"
                aria-label="Change photo"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            ) : (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#138808] flex items-center justify-center border-2 border-white dark:border-[#1E293B]">
                <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("dprofile.yourName")}
                className="w-full font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b-2 border-[#FF6B00] outline-none pb-0.5"
              />
            ) : (
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{profile.name || t("dprofile.addYourName")}</h2>
            )}
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{phone}</p>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
              <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
        {photoError && <p className="text-xs text-[#DC2626] mt-2">{photoError}</p>}

        {/* Personal Details */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 py-2 border-t border-gray-50 dark:border-gray-700">
            <Mail className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
            {isEditing ? (
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder={t("dprofile.emailAddress")}
                className="flex-1 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
              />
            ) : (
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.email || t("dprofile.addEmailAddress")}</span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2 border-t border-gray-50 dark:border-gray-700">
            <Calendar className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
            {isEditing ? (
              <input
                type="date"
                value={draft.dob}
                onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className="flex-1 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
              />
            ) : (
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
                {profile.dob
                  ? new Date(profile.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                  : t("dprofile.addDob")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 py-2 border-t border-gray-50 dark:border-gray-700">
            <Users className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
            {isEditing ? (
              <select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                className="flex-1 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1 bg-transparent"
              >
                <option value="">{t("dprofile.selectGender")}</option>
                {genders.map((g) => (
                  <option key={g} value={g}>{t(GENDER_KEYS[g])}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.gender ? t(GENDER_KEYS[profile.gender] ?? "") || profile.gender : t("dprofile.addGender")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="px-4 pt-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#FF6B00]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dprofile.vehicleDetails")}</h3>
            </div>
            {!isEditing && (
              <button onClick={startEditing} aria-label="Edit vehicle details" className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
                <Pencil className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.type")}</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draft.vehicleType}
                  onChange={(e) => setDraft({ ...draft, vehicleType: e.target.value })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.vehicleType || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.model")}</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draft.vehicleModel}
                  onChange={(e) => setDraft({ ...draft, vehicleModel: e.target.value })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.vehicleModel || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.registration")}</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draft.vehicleNumber}
                  onChange={(e) => setDraft({ ...draft, vehicleNumber: e.target.value.toUpperCase() })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.vehicleNumber || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.seatingCapacity")}</p>
              {isEditing ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.seatCapacity}
                  onChange={(e) => setDraft({ ...draft, seatCapacity: e.target.value.replace(/\D/g, "") })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{profile.seatCapacity || "—"}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate("/driver/vehicle-health")}
            className="w-full flex items-center justify-center gap-2 mt-3 text-xs font-medium text-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536] py-2 rounded-lg"
          >
            <Wrench className="w-3.5 h-3.5" /> {t("dprofile.viewVehicleHealth")}
          </button>
        </div>
      </div>

      {/* Bank Details */}
      <div className="px-4 pt-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dprofile.bankDetails")}</h3>
            </div>
            {!isEditing && (
              <button onClick={startEditing} aria-label="Edit bank details" className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
                <Pencil className="w-3.5 h-3.5 text-[#FF6B00]" />
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.accountHolderName")}</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draftBank.accountHolder}
                  onChange={(e) => setDraftBank({ ...draftBank, accountHolder: e.target.value })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{bankDetails.accountHolder || t("dwallet.notAdded")}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.bankName")}</p>
              {isEditing ? (
                <input
                  type="text"
                  value={draftBank.bankName}
                  onChange={(e) => setDraftBank({ ...draftBank, bankName: e.target.value })}
                  className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                />
              ) : (
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{bankDetails.bankName || t("dwallet.notAdded")}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.accountNumber")}</p>
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draftBank.accountNumber}
                    onChange={(e) => setDraftBank({ ...draftBank, accountNumber: e.target.value.replace(/\D/g, "") })}
                    className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {displayedBank.accountNumber ? (showAccountNumber ? bankDetails.accountNumber : maskedAccount) : t("dwallet.notAdded")}
                    </p>
                    {bankDetails.accountNumber && (
                      <button onClick={() => setShowAccountNumber((v) => !v)} aria-label="Toggle account number visibility">
                        {showAccountNumber ? <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <Eye className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF] mb-0.5">{t("dprofile.ifscCode")}</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={draftBank.ifsc}
                    onChange={(e) => setDraftBank({ ...draftBank, ifsc: e.target.value.toUpperCase() })}
                    className="w-full text-sm text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent border-b border-gray-200 dark:border-gray-700 outline-none focus:border-[#FF6B00] pb-1"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{bankDetails.ifsc || t("dwallet.notAdded")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents & Verification */}
      <div className="px-4 pt-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("dprofile.documentsVerification")}</h3>
          <div className="space-y-1">
            {documents.map((doc) => {
              const style = DOC_STATUS_STYLE[doc.status];
              return (
                <div key={doc.label} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="w-9 h-9 rounded-full bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#1E3A5F] dark:text-[#93C5FD]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{doc.label}</p>
                    <p className="text-xs text-[#9CA3AF]">{t("dprofile.expires")} {doc.expiry}</p>
                  </div>
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: style.color, backgroundColor: style.bg }}
                  >
                    <style.icon className="w-3 h-3" /> {t(style.labelKey)}
                  </span>
                  <button
                    onClick={() => handleDocUpdateClick(doc.label)}
                    aria-label={`Update ${doc.label}`}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg flex-shrink-0"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  </button>
                </div>
              );
            })}
          </div>
          <input ref={docFileInputRef} type="file" accept="image/*,.pdf" onChange={handleDocFilePicked} className="hidden" />
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
