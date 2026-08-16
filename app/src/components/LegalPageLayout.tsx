import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  backTo?: string;
  children: ReactNode;
}

// Shared shell for every legal/compliance document — same header/back-nav
// pattern, typography, and contact footer everywhere so these read as one
// consistent set rather than N one-off pages.
export default function LegalPageLayout({ title, lastUpdated, backTo, children }: LegalPageLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-12">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{title}</h1>
          <p className="text-[11px] text-[#9CA3AF]">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">
        {children}

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Questions about this document?</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <a href={SUPPORT_EMAIL_MAILTO} className="text-sm text-[#FF6B00] hover:underline">{SUPPORT_EMAIL}</a>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <a href={SUPPORT_PHONE_TEL} className="text-sm text-[#FF6B00] hover:underline">{SUPPORT_PHONE_DISPLAY}</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
      <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{title}</h2>
      <div className="space-y-3 text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="inline text-[#DC2626] bg-[#FEE2E2] dark:bg-[#3A1A1A] px-1.5 py-0.5 rounded font-medium">
      {children}
    </span>
  );
}
