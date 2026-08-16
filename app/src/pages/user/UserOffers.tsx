import { useState } from "react";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import { useOffers } from "@/contexts/OffersContext";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

export default function UserOffers() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { coupons } = useOffers();
  const activeOffers = coupons.filter((c) => c.status === "Active");
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState("");
  const [invalidReason, setInvalidReason] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const utils = trpc.useUtils();

  // Real validation against the server (existence, active, date range, usage
  // limit) — bookingAmount is a generous placeholder since this browse page
  // has no actual fare context yet; the real minimum-booking check happens
  // for real at checkout in the Home screen's fare sheet.
  const handleApply = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const result = await utils.coupon.validate.fetch({ code, bookingAmount: 999_999 });
    if (result.ok) {
      setApplied(code);
      setInvalidReason("");
    } else {
      setInvalidReason(result.error);
      setApplied("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/home")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("offers.title")}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Coupon Input */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setInvalidReason(""); }}
            placeholder={t("offers.enterCouponCode")}
            className="flex-1 min-w-0 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
          />
          <button
            onClick={handleApply}
            className="flex-shrink-0 whitespace-nowrap bg-[#FF6B00] text-white font-semibold px-5 rounded-xl text-sm hover:bg-[#FF8533] transition-colors"
          >
            {t("apply")}
          </button>
        </div>

        {applied && (
          <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-xl p-3 text-center">
            <p className="text-sm text-[#138808] font-medium">{t("offers.couponAppliedPrefix")} "{applied}" {t("offers.couponAppliedSuffix")}</p>
          </div>
        )}
        {invalidReason && (
          <div className="bg-red-50 dark:bg-[#3A1A1A] rounded-xl p-3 text-center">
            <p className="text-sm text-[#DC2626] font-medium">{invalidReason}</p>
          </div>
        )}

        {/* Available Offers */}
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("offers.availableOffers")}</h2>

        <div className="space-y-3">
          {activeOffers.length === 0 ? (
            <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
              <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">{t("offers.noActiveOffers")}</p>
            </div>
          ) : (
            activeOffers.map((offer) => (
              <div
                key={offer.code}
                className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm overflow-hidden relative"
              >
                {/* Coupon notch effect */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-r-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-l-full" />

                <div className="p-4 border-l-4 border-[#FF6B00]">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-[#FF6B00] text-lg">{offer.code}</h3>
                        <button
                          onClick={() => handleCopyCode(offer.code)}
                          className="p-1 rounded-md hover:bg-[#FFF5EB] dark:hover:bg-white/10 transition-colors flex-shrink-0"
                          aria-label={`Copy coupon code ${offer.code}`}
                        >
                          {copiedCode === offer.code ? (
                            <Check className="w-3.5 h-3.5 text-[#138808]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{offer.description}</p>
                    </div>
                    <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] px-3 py-1 rounded-lg flex-shrink-0">
                      <span className="font-bold text-[#138808]">
                        {offer.discountType === "percentage" ? `${offer.discountValue}%` : `₹${offer.discountValue}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#9CA3AF] dark:text-[#64748B]">
                    <span>{t("offers.minBooking")} ₹{offer.minBookingAmount}</span>
                    <span>{t("offers.validTill")} {offer.validTill}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav role="user" />
    </div>
  );
}
