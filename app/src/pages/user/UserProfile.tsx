import { useRef, useState } from "react";
import {
  ChevronRight, LogOut, Clock, Gift, HelpCircle, Settings, Crown, Car,
  GraduationCap, ShieldAlert, Pencil, Check, Camera, ShieldCheck, Calendar, Users,
  Home, Briefcase, Heart, Star, Bell, MapPin, Ticket, Sparkles, X,
} from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useLanguage } from "@/contexts/LanguageContext";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };

const menuItems = [
  { icon: Clock, labelKey: "profile.menu.rideHistory", subtitleKey: "profile.menu.rideHistorySub", path: "/user/history" },
  { icon: Gift, labelKey: "profile.menu.offers", subtitleKey: "profile.menu.offersSub", path: "/user/offers" },
  { icon: GraduationCap, labelKey: "profile.menu.studentPass", subtitleKey: "profile.menu.studentPassSub", path: "/user/student-pass" },
  { icon: ShieldAlert, labelKey: "profile.menu.safety", subtitleKey: "profile.menu.safetySub", path: "/user/safety" },
  { icon: Star, labelKey: "user.refer", subtitleKey: "profile.menu.referSub", path: "/user/refer" },
  { icon: HelpCircle, labelKey: "profile.menu.support", subtitleKey: "profile.menu.supportSub", path: "/user/support" },
  { icon: Settings, labelKey: "settings", subtitleKey: "profile.menu.settingsSub", path: "/user/settings" },
];

// Backed by the real trpc.user.getSavedPlaces/savePlace/deletePlace
// procedures (a real `savedPlaces` MySQL table keyed by userId) — matched
// against each saved row's free-text `name` field, not a fixed slot enum.
// `label` stays the literal English identifier the backend row is keyed on
// (savedPlacesList.find(p => p.name === place.label)) — only `labelKey`/
// `hintKey` are ever shown to the rider, so translating the display text
// never risks breaking that lookup.
const SAVED_PLACE_META = [
  { icon: Home, label: "Home", labelKey: "places.home", hintKey: "places.addHome" },
  { icon: Briefcase, label: "Work", labelKey: "places.work", hintKey: "places.addWork" },
  { icon: Heart, label: "Favorites", labelKey: "places.favorites", hintKey: "places.addPlace" },
] as const;
type SavedPlaceLabel = (typeof SAVED_PLACE_META)[number]["label"];

const genders = ["Female", "Male", "Other", "Prefer not to say"];
const DEFAULT_AVATAR = "/assets/user-avatar.png";

interface ProfileDetails {
  name: string;
  email: string;
  gender: string;
  dob: string;
  avatar: string;
}

// Downscales + compresses the picked photo client-side before it goes into
// the users.avatar TEXT column (64KB limit, no separate file-storage backend
// exists in this prototype) — a full-resolution phone photo would blow past
// that easily.
function resizeImageToDataUrl(file: File, maxDim = 256, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}

export default function UserProfile() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoutMutation = trpc.auth.logout.useMutation();
  const { user, refresh: refreshAuth } = useAuth();
  const { unreadCountFor } = useNotifications();
  const unread = unreadCountFor("rider");
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => refreshAuth(),
  });

  const utils = trpc.useUtils();
  const { data: savedPlacesList = [] } = trpc.user.getSavedPlaces.useQuery();
  const savePlaceMutation = trpc.user.savePlace.useMutation({
    onSuccess: () => utils.user.getSavedPlaces.invalidate(),
  });
  const deletePlaceMutation = trpc.user.deletePlace.useMutation({
    onSuccess: () => utils.user.getSavedPlaces.invalidate(),
  });

  const phone = user?.phone ? `+91 ${user.phone}` : "";

  const fieldsFromServer = (): ProfileDetails => ({
    name: user?.name ?? "",
    email: user?.email ?? "",
    gender: user?.gender ?? "",
    dob: user?.dob ?? "",
    avatar: user?.avatar || DEFAULT_AVATAR,
  });

  const [profile, setProfile] = useState<ProfileDetails>(fieldsFromServer);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDetails>(profile);
  const [justSaved, setJustSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Re-sync once the real profile data arrives (the auth query resolves
  // after first render) — but never while the rider is mid-edit, so we
  // don't clobber unsaved changes. Adjusts state directly during render
  // (React's documented pattern for this) instead of in an effect, since
  // this only needs to run when `user` itself changes identity.
  const [lastSyncedUser, setLastSyncedUser] = useState(user);
  if (user !== lastSyncedUser) {
    setLastSyncedUser(user);
    if (!isEditing) setProfile(fieldsFromServer());
  }

  const [pickerLabel, setPickerLabel] = useState<SavedPlaceLabel | null>(null);
  const pickerMeta = SAVED_PLACE_META.find((p) => p.label === pickerLabel);
  const pickerExisting = pickerLabel ? savedPlacesList.find((p) => p.name === pickerLabel) : undefined;

  const startEditing = () => {
    setDraft(profile);
    setPhotoError("");
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfile(draft);
    setIsEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
    updateProfileMutation.mutate({
      name: draft.name,
      email: draft.email,
      gender: draft.gender,
      dob: draft.dob,
      avatar: draft.avatar,
    });
  };

  const handleCancel = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setDraft((prev) => ({ ...prev, avatar: dataUrl }));
    } catch {
      setPhotoError(t("profile.photoError"));
    }
  };

  const displayed = isEditing ? draft : profile;
  const homePlace = savedPlacesList.find((p) => p.name === "Home");

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-bold text-2xl text-[#1A1A2E] dark:text-white">{t("profile.myProfile")}</h1>
          <p className="text-sm text-[#1A1A2E] dark:text-white mt-0.5">
            {t("profile.hi")}, <span className="text-[#FF6B00] font-semibold">{profile.name || t("profile.rider")}</span> 👋
          </p>
          <p className="text-xs text-[#6B7280] dark:text-white/50 mt-0.5">{t("profile.manageAccount")}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5" aria-label="Cancel">
                <X className="w-5 h-5 text-[#6B7280] dark:text-white/60" />
              </button>
              <button onClick={handleSave} className="p-2 rounded-full bg-[#138808]" aria-label="Save">
                <Check className="w-5 h-5 text-white" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate("/user/settings")} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                <Settings className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
              </button>
              <button onClick={() => navigate("/user/notifications")} className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />}
              </button>
            </>
          )}
        </div>
      </div>

      {justSaved && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] dark:text-[#4ADE80] text-sm font-medium px-4 py-2.5 rounded-xl">
          <Check className="w-4 h-4" /> {t("profile.updated")}
        </div>
      )}

      <div className="px-4 space-y-4">
        {/* Profile Card — deliberately stays light/cream even in dark mode, as
            the page's one "hero" surface (matches the reference design). */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF8F0] to-[#FFE8D1] p-5 animate-fade-slide">
          <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-[#FF6B00]/10 blur-xl pointer-events-none" />
          <Car className="absolute right-3 bottom-3 w-20 h-20 text-[#FF6B00]/10 rotate-[-8deg] pointer-events-none" strokeWidth={1.5} />

          <div className="relative z-10 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <img
                src={displayed.avatar || DEFAULT_AVATAR}
                alt={displayed.name || "Rider"}
                className="w-16 h-16 rounded-full object-cover border-[3px] border-[#FF6B00]"
              />
              {isEditing ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF6B00] flex items-center justify-center border-2 border-white"
                  aria-label="Change photo"
                >
                  <Camera className="w-3 h-3 text-white" />
                </button>
              ) : (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#138808] flex items-center justify-center border-2 border-white">
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
                  placeholder={t("profile.yourName")}
                  className="w-full font-bold text-lg text-[#1A1A2E] bg-transparent border-b-2 border-[#FF6B00] outline-none pb-0.5"
                />
              ) : (
                <h2 className="font-bold text-lg text-[#1A1A2E] truncate flex items-center gap-1.5">
                  {profile.name || t("profile.addYourName")} <ShieldCheck className="w-4 h-4 text-[#138808] flex-shrink-0" />
                </h2>
              )}
              <p className="text-sm text-[#6B7280]">{phone}</p>
              {isEditing ? (
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder={t("profile.emailAddress")}
                  className="w-full text-xs text-[#6B7280] bg-transparent border-b border-[#FF6B00]/30 outline-none focus:border-[#FF6B00] mt-1"
                />
              ) : (
                <p className="text-xs text-[#6B7280] truncate">{profile.email || t("profile.addEmail")}</p>
              )}
            </div>
          </div>
          {photoError && <p className="text-xs text-[#DC2626] mt-2 relative z-10">{photoError}</p>}

          {!isEditing && (
            <button
              onClick={startEditing}
              className="relative z-10 mt-4 flex items-center gap-1.5 bg-white text-[#FF6B00] font-semibold px-4 py-2 rounded-xl text-sm shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" /> {t("editProfile")}
            </button>
          )}
        </div>

        {/* Date of Birth / Gender / Location */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/[0.06]">
          <div className="flex flex-col items-center gap-1 py-3 px-1 text-center">
            <Calendar className="w-4 h-4 text-[#FF6B00]" />
            {isEditing ? (
              <input
                type="date"
                value={draft.dob}
                onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className="w-full text-[11px] text-center text-[#1A1A2E] dark:text-white bg-transparent outline-none"
              />
            ) : (
              <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white">
                {profile.dob ? new Date(profile.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : t("add")}
              </span>
            )}
            <span className="text-[9px] text-[#9CA3AF]">{t("profile.dateOfBirth")}</span>
          </div>
          <div className="flex flex-col items-center gap-1 py-3 px-1 text-center">
            <Users className="w-4 h-4 text-[#FF6B00]" />
            {isEditing ? (
              <select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                className="w-full text-[11px] text-center text-[#1A1A2E] dark:text-white bg-transparent outline-none"
              >
                <option value="">{t("profile.select")}</option>
                {genders.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white">{profile.gender || t("add")}</span>
            )}
            <span className="text-[9px] text-[#9CA3AF]">{t("profile.gender")}</span>
          </div>
          <button onClick={() => setPickerLabel("Home")} className="flex flex-col items-center gap-1 py-3 px-1 text-center">
            <MapPin className="w-4 h-4 text-[#FF6B00]" />
            <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white truncate max-w-full">
              {homePlace ? homePlace.address.split(",")[0] : t("add")}
            </span>
            <span className="text-[9px] text-[#9CA3AF]">{t("profile.location")}</span>
          </button>
        </div>

        {/* Saved Places */}
        <Reveal>
        <div>
          <h3 className="font-semibold text-[#1A1A2E] dark:text-white mb-2 px-0.5">{t("profile.savedPlaces")}</h3>
          <div className="grid grid-cols-3 gap-3">
            {SAVED_PLACE_META.map((place) => {
              const saved = savedPlacesList.find((p) => p.name === place.label);
              return (
                <button
                  key={place.label}
                  onClick={() => setPickerLabel(place.label)}
                  className="flex flex-col items-center gap-1 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-3"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center">
                    <place.icon className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                  <span className="text-xs font-medium text-[#1A1A2E] dark:text-white mt-1">{t(place.labelKey)}</span>
                  <span className="text-[10px] text-[#9CA3AF] truncate max-w-full">{saved ? saved.address : t(place.hintKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        </Reveal>

        {/* Quick Access stat row */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] grid grid-cols-4 divide-x divide-gray-100 dark:divide-white/[0.06]">
          <button onClick={() => navigate("/user/history")} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Car className="w-5 h-5 text-[#138808]" />
            <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-white text-center leading-tight">{t("profile.myRides")}</span>
            <span className="text-[9px] text-[#138808] flex items-center">{t("profile.details")} <ChevronRight className="w-2.5 h-2.5" /></span>
          </button>
          <button onClick={() => navigate("/user/offers")} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Ticket className="w-5 h-5 text-[#A855F7]" />
            <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.coupons")}</span>
            <span className="text-[9px] text-[#A855F7] flex items-center">3 {t("profile.available")}</span>
          </button>
          <button onClick={() => navigate("/user/refer")} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Users className="w-5 h-5 text-[#0EA5E9]" />
            <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.referral")}</span>
            <span className="text-[9px] text-[#0EA5E9] flex items-center">{t("profile.inviteEarn")}</span>
          </button>
          <button onClick={() => navigate("/user/subscription")} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Crown className="w-5 h-5 text-[#EAB308]" />
            <span className="text-[10px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.corporate")}</span>
            <span className="text-[9px] text-[#EAB308] flex items-center">{t("profile.viewPlan")}</span>
          </button>
        </div>

        {/* Upgrade to Flying Plus */}
        <button
          onClick={() => navigate("/user/subscription")}
          className="w-full relative overflow-hidden flex items-center gap-3 bg-gradient-to-r from-[#138808] to-[#0D5C05] rounded-2xl p-4 text-left"
        >
          <Sparkles className="absolute right-4 top-3 w-4 h-4 text-white/30" />
          <Gift className="absolute right-3 bottom-2 w-14 h-14 text-white/10 rotate-[10deg] pointer-events-none" strokeWidth={1.5} />
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-[#FFD700]" />
          </div>
          <div className="flex-1 min-w-0 relative z-10">
            <p className="font-bold text-sm text-white">{t("profile.upgradeToPrefix")} <span className="text-[#FFD700]">Flying Plus</span></p>
            <p className="text-[11px] text-white/80 leading-snug">{t("profile.flyingPlusDesc")}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-[#138808] bg-white px-3 py-2 rounded-full flex-shrink-0 relative z-10">
            {t("profile.explore")} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Quick Access */}
        <div>
          <h3 className="font-semibold text-[#1A1A2E] dark:text-white mb-2 px-0.5">{t("profile.quickAccess")}</h3>
          <div className="grid grid-cols-2 gap-3">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-3.5 text-left"
              >
                <div className="w-9 h-9 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-[#FF6B00]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[#1A1A2E] dark:text-white text-xs truncate">{t(item.labelKey)}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{t(item.subtitleKey)}</p>
                </div>
              </button>
            ))}

            {/* Logout */}
            <button
              onClick={() => {
                // Must clear the real session cookie server-side first — clearing
                // only localStorage left the session valid, so /app's own check
                // immediately bounced back to the dashboard instead of logging out.
                logoutMutation.mutate(undefined, {
                  onSettled: () => {
                    localStorage.removeItem("userRole");
                    localStorage.removeItem("userPhone");
                    // Straight back to this role's own login screen, not the
                    // generic role picker.
                    navigate("/login", { state: { role: "user" }, replace: true });
                  },
                });
              }}
              className="flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-3.5 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-[#3D1414] flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 text-[#DC2626]" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-[#DC2626] text-xs">{t("logOut")}</p>
                <p className="text-[10px] text-[#9CA3AF] truncate">{t("profile.signOutDesc")}</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {pickerLabel && pickerMeta && (
        <LocationPickerModal
          open
          title={`${t("profile.setLocationPrefix")} ${t(pickerMeta.labelKey)}`}
          initialCoords={pickerExisting ? { lat: Number(pickerExisting.lat), lng: Number(pickerExisting.lng) } : RANAGHAT_COORDS}
          onConfirm={({ address, lat, lng }) => {
            // No update mutation exists — replace by deleting the old row
            // (if any) for this label, then inserting the new one.
            const persist = () => savePlaceMutation.mutate({ name: pickerLabel, address, lat: String(lat), lng: String(lng) });
            if (pickerExisting) {
              deletePlaceMutation.mutate({ id: pickerExisting.id }, { onSuccess: persist });
            } else {
              persist();
            }
            setPickerLabel(null);
          }}
          onClose={() => setPickerLabel(null)}
        />
      )}

      <BottomNav role="user" />
    </div>
  );
}
