import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Phone, FileText, ChevronRight } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

const LEGAL_LINKS = [
  { label: "Privacy Policy", path: "/legal/privacy-policy" },
  { label: "Terms & Conditions", path: "/legal/terms" },
  { label: "Cancellation Policy", path: "/legal/cancellation-policy" },
  { label: "Refund Policy", path: "/legal/refund-policy" },
  { label: "Community Guidelines", path: "/legal/community-guidelines" },
  { label: "Safety Policy", path: "/legal/safety-policy" },
  { label: "Driver Agreement", path: "/legal/driver-agreement" },
  { label: "Data Deletion Policy", path: "/legal/data-deletion" },
  { label: "Cookie Policy", path: "/legal/cookie-policy" },
];

// Open-source packages this app is built on top of, worth crediting —
// not an exhaustive dependency dump, just the major ones a licenses
// screen conventionally lists.
const LICENSES = [
  { name: "React", license: "MIT" },
  { name: "Vite", license: "MIT" },
  { name: "tRPC", license: "MIT" },
  { name: "Drizzle ORM", license: "Apache-2.0" },
  { name: "Tailwind CSS", license: "MIT" },
  { name: "Lucide Icons", license: "ISC" },
  { name: "Recharts", license: "MIT" },
];

export default function AboutRidepay() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-12">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">About Ridepay</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 flex flex-col items-center text-center">
          <img src="/assets/logo.png" alt="Ridepay" className="w-20 h-auto mb-3" />
          <h2 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">Ridepay</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Version 1.0.0</p>
          <p className="text-xs text-[#9CA3AF] mt-3 max-w-xs">
            India's e-rickshaw ride, parcel &amp; school transport app.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden">
          <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] px-5 pt-4 pb-2">Legal &amp; Policies</h3>
          {LEGAL_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="w-full flex items-center gap-3 px-5 py-3 border-t border-gray-50 dark:border-gray-700 text-left"
            >
              <FileText className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <span className="flex-1 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">Open-source licenses</h3>
          <div className="space-y-1.5">
            {LICENSES.map((lib) => (
              <div key={lib.name} className="flex items-center justify-between text-sm">
                <span className="text-[#4B5563] dark:text-[#9CA3AF]">{lib.name}</span>
                <span className="text-xs text-[#9CA3AF]">{lib.license}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">Contact us</h3>
          <a href={SUPPORT_EMAIL_MAILTO} className="flex items-center gap-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
            <Mail className="w-4 h-4 text-[#FF6B00]" /> {SUPPORT_EMAIL}
          </a>
          <a href={SUPPORT_PHONE_TEL} className="flex items-center gap-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
            <Phone className="w-4 h-4 text-[#FF6B00]" /> {SUPPORT_PHONE_DISPLAY}
          </a>
          <a href="tel:100" className="flex items-center gap-3 text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">
            <Phone className="w-4 h-4 text-[#DC2626]" /> 24×7 Emergency Helpline: 100
          </a>
        </div>
      </div>
    </div>
  );
}
