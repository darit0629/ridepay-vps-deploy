import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ShieldCheck, Moon, UserPlus, Phone, Trash2, ShieldAlert } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export default function UserSafety() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [womenOnlyDefault, setWomenOnlyDefault] = useState(false);
  const [nightSafeDefault, setNightSafeDefault] = useState(false);
  const [autoShareTrips, setAutoShareTrips] = useState(true);
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: "c1", name: "Mother", phone: "+91 98765 12345", relation: "Family" },
    { id: "c2", name: "Rohit Sharma", phone: "+91 91234 56789", relation: "Friend" },
  ]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");

  const handleAddContact = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setContacts((prev) => [
      ...prev,
      { id: `c${Date.now()}`, name: newName.trim(), phone: newPhone.trim(), relation: newRelation.trim() || "Contact" },
    ]);
    setNewName("");
    setNewPhone("");
    setNewRelation("");
    setShowAddContact(false);
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const raiseSosMutation = trpc.sos.raise.useMutation();
  const [sosSent, setSosSent] = useState(false);
  const handleSOS = () => {
    const fire = (lat?: number, lng?: number) => {
      raiseSosMutation.mutate({ role: "user", lat, lng, note: "SOS raised from Safety Center" });
      setSosSent(true);
      setTimeout(() => setSosSent(false), 3000);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fire(position.coords.latitude, position.coords.longitude),
        () => fire(),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      fire();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#DC2626] to-[#B91C1C] px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/user/profile")}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">{t("safety.title")}</h1>
          <div className="w-6" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white font-bold text-xl">{t("safety.heroTitle")}</h2>
          <p className="text-white/80 text-sm mt-1">{t("safety.heroSubtitle")}</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Default Ride Preferences */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("safety.defaultPrefs")}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F3E8FF] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("safety.preferWomenDrivers")}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("safety.preselectEveryBooking")}</p>
                </div>
              </div>
              <button
                onClick={() => setWomenOnlyDefault(!womenOnlyDefault)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${womenOnlyDefault ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${womenOnlyDefault ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E8EEF5] flex items-center justify-center flex-shrink-0">
                  <Moon className="w-4 h-4 text-[#1E3A5F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("safety.autoNightSafe")}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("safety.autoEnableAfter9pm")}</p>
                </div>
              </div>
              <button
                onClick={() => setNightSafeDefault(!nightSafeDefault)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${nightSafeDefault ? "bg-[#1E3A5F]" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${nightSafeDefault ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#E8F5E8] flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-4 h-4 text-[#138808]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("safety.autoShareTrip")}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("safety.autoShareDesc")}</p>
                </div>
              </div>
              <button
                onClick={() => setAutoShareTrips(!autoShareTrips)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${autoShareTrips ? "bg-[#138808]" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${autoShareTrips ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("safety.emergencyContacts")}</h3>
            <button
              onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1 text-xs font-medium text-[#FF6B00]"
            >
              <UserPlus className="w-3.5 h-3.5" /> {t("add")}
            </button>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] dark:text-[#64748B] text-center py-4">{t("safety.noContactsYet")}</p>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-[#138808]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{contact.name}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{contact.phone} · {contact.relation}</p>
                  </div>
                  <button onClick={() => handleRemoveContact(contact.id)}>
                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSOS}
          disabled={raiseSosMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#DC2626] text-white font-semibold py-4 rounded-2xl shadow-sm disabled:opacity-60"
        >
          <ShieldAlert className="w-5 h-5" /> {sosSent ? t("safety.alertSent") : t("safety.sosAlertNow")}
        </button>

        <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#138808] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#138808]">
            {t("safety.sosDisclaimer")}
          </p>
        </div>
      </div>

      {/* Add Contact Sheet */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowAddContact(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">{t("safety.addEmergencyContact")}</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("safety.namePlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#DC2626] outline-none text-sm bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t("safety.phonePlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#DC2626] outline-none text-sm bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                type="text"
                value={newRelation}
                onChange={(e) => setNewRelation(e.target.value)}
                placeholder={t("safety.relationPlaceholder")}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#DC2626] outline-none text-sm bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
            <button
              onClick={handleAddContact}
              disabled={!newName.trim() || !newPhone.trim()}
              className="w-full bg-[#DC2626] text-white font-semibold py-3.5 rounded-xl mt-4 disabled:opacity-50 hover:bg-[#B91C1C] transition-colors"
            >
              {t("safety.addContact")}
            </button>
          </div>
        </div>
      )}

      <BottomNav role="user" />
    </div>
  );
}
