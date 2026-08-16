import { useState } from "react";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Eye, EyeOff,
  Crown, GraduationCap, Package, Users, Sparkles, Megaphone, Gift, Car,
  Cross, Shield, ParkingCircle, BatteryCharging, MapPin, Star,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useHomeContent } from "@/contexts/HomeContentContext";
import {
  DESTINATION_OPTIONS, PROMO_ICON_OPTIONS, NEARBY_ICON_OPTIONS,
  type PromoSlide, type PromoSlideIcon, type OfferTeaser, type NearbyServiceItem, type NearbyServiceIcon,
} from "@/lib/mockHomeContent";

const PROMO_ICON_MAP: Record<PromoSlideIcon, typeof Crown> = {
  Crown, GraduationCap, Package, Users, Sparkles, Megaphone, Gift, Car,
};
const NEARBY_ICON_MAP: Record<NearbyServiceIcon, typeof Cross> = {
  Cross, Shield, ParkingCircle, BatteryCharging, MapPin, Star,
};

interface SlideForm {
  id?: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: PromoSlideIcon;
  colorFrom: string;
  colorTo: string;
  destination: string;
}
const emptySlideForm: SlideForm = { title: "", subtitle: "", cta: "", icon: "Sparkles", colorFrom: "#FF6B00", colorTo: "#E65A00", destination: "" };

interface OfferForm {
  id?: string;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
}
const emptyOfferForm: OfferForm = { title: "", subtitle: "", color: "#FF6B00", bg: "#FFF5EB" };

interface NearbyForm {
  id?: string;
  label: string;
  icon: NearbyServiceIcon;
}
const emptyNearbyForm: NearbyForm = { label: "", icon: "MapPin" };

export default function AdminHomePanel() {
  const {
    promoSlides, addPromoSlide, updatePromoSlide, removePromoSlide, movePromoSlide,
    offerTeasers, addOfferTeaser, updateOfferTeaser, removeOfferTeaser, moveOfferTeaser,
    nearbyServices, addNearbyService, updateNearbyService, removeNearbyService, moveNearbyService,
    quickTiles, updateQuickTile,
    rideTypes, updateRideType,
  } = useHomeContent();

  const [slideForm, setSlideForm] = useState<SlideForm | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm | null>(null);
  const [nearbyForm, setNearbyForm] = useState<NearbyForm | null>(null);

  const openAddSlide = () => setSlideForm(emptySlideForm);
  const openEditSlide = (s: PromoSlide) => setSlideForm({ ...s });
  const saveSlide = () => {
    if (!slideForm || !slideForm.title.trim()) return;
    const { id, ...rest } = slideForm;
    if (id) updatePromoSlide(id, rest);
    else addPromoSlide({ ...rest, enabled: true });
    setSlideForm(null);
  };

  const openAddOffer = () => setOfferForm(emptyOfferForm);
  const openEditOffer = (o: OfferTeaser) => setOfferForm({ ...o });
  const saveOffer = () => {
    if (!offerForm || !offerForm.title.trim()) return;
    const { id, ...rest } = offerForm;
    if (id) updateOfferTeaser(id, rest);
    else addOfferTeaser({ ...rest, enabled: true });
    setOfferForm(null);
  };

  const openAddNearby = () => setNearbyForm(emptyNearbyForm);
  const openEditNearby = (s: NearbyServiceItem) => setNearbyForm({ ...s });
  const saveNearby = () => {
    if (!nearbyForm || !nearbyForm.label.trim()) return;
    const { id, ...rest } = nearbyForm;
    if (id) updateNearbyService(id, rest);
    else addNearbyService({ ...rest, enabled: true });
    setNearbyForm(null);
  };

  return (
    <AdminLayout
      title="Home Panel"
      subtitle="Customize the rider Home screen's pull-up panel — promo banner, offers, quick tiles & more"
    >
      <div className="space-y-6">
        {/* Promo Slides */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Sliding Promo Banner</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Auto-advancing banner at the top of the pull-up panel, in every sheet state</p>
            </div>
            <button
              onClick={openAddSlide}
              className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#E05F00] transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          </div>

          {slideForm && (
            <div className="mt-4 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{slideForm.id ? "Edit Slide" : "New Slide"}</h3>
                <button onClick={() => setSlideForm(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                  <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Title</label>
                  <input
                    type="text"
                    value={slideForm.title}
                    onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="Flying Plus"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">CTA label</label>
                  <input
                    type="text"
                    value={slideForm.cta}
                    onChange={(e) => setSlideForm({ ...slideForm, cta: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="Upgrade"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Subtitle</label>
                <input
                  type="text"
                  value={slideForm.subtitle}
                  onChange={(e) => setSlideForm({ ...slideForm, subtitle: e.target.value })}
                  className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  placeholder="Priority pickups & zero cancellation fees"
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Icon</label>
                  <select
                    value={slideForm.icon}
                    onChange={(e) => setSlideForm({ ...slideForm, icon: e.target.value as PromoSlideIcon })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    {PROMO_ICON_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Color From</label>
                  <input
                    type="color"
                    value={slideForm.colorFrom}
                    onChange={(e) => setSlideForm({ ...slideForm, colorFrom: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Color To</label>
                  <input
                    type="color"
                    value={slideForm.colorTo}
                    onChange={(e) => setSlideForm({ ...slideForm, colorTo: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Tap Action</label>
                  <select
                    value={slideForm.destination}
                    onChange={(e) => setSlideForm({ ...slideForm, destination: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    {DESTINATION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div
                className="rounded-xl overflow-hidden flex items-center gap-3 p-3.5"
                style={{ background: `linear-gradient(135deg, ${slideForm.colorFrom}, ${slideForm.colorTo})` }}
              >
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  {(() => { const I = PROMO_ICON_MAP[slideForm.icon]; return <I className="w-4 h-4 text-white" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{slideForm.title || "Preview title"}</p>
                  <p className="text-[10px] text-white/75 truncate">{slideForm.subtitle || "Preview subtitle"}</p>
                </div>
                <span className="text-[10px] font-semibold text-white bg-white/20 px-2 py-1 rounded-full flex-shrink-0">{slideForm.cta || "CTA"}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={saveSlide} className="btn-saffron px-5 py-2 text-sm">{slideForm.id ? "Save Changes" : "Add Slide"}</button>
                <button onClick={() => setSlideForm(null)} className="px-5 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {promoSlides.map((slide, i) => {
              const SlideIcon = PROMO_ICON_MAP[slide.icon];
              return (
                <div key={slide.id} className={`flex items-center gap-3 rounded-xl p-3 ${slide.enabled ? "bg-[#F8F9FA] dark:bg-[#0F172A]" : "bg-gray-50 dark:bg-black/20 opacity-60"}`}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${slide.colorFrom}, ${slide.colorTo})` }}
                  >
                    <SlideIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{slide.title}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{slide.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => movePromoSlide(slide.id, -1)} disabled={i === 0} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move up">
                      <ChevronUp className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                    </button>
                    <button onClick={() => movePromoSlide(slide.id, 1)} disabled={i === promoSlides.length - 1} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move down">
                      <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                    </button>
                    <button
                      onClick={() => updatePromoSlide(slide.id, { enabled: !slide.enabled })}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                      aria-label={slide.enabled ? "Disable" : "Enable"}
                    >
                      {slide.enabled ? <Eye className="w-3.5 h-3.5 text-[#138808]" /> : <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                    </button>
                    <button onClick={() => openEditSlide(slide)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Edit">
                      <Pencil className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    </button>
                    <button onClick={() => removePromoSlide(slide.id)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                    </button>
                  </div>
                </div>
              );
            })}
            {promoSlides.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No slides yet — add one above.</p>}
          </div>
        </div>

        {/* Offer Teasers */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">"Offers for you" Carousel</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Shown when the panel is pulled to full screen</p>
            </div>
            <button
              onClick={openAddOffer}
              className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#E05F00] transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Offer
            </button>
          </div>

          {offerForm && (
            <div className="mt-4 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{offerForm.id ? "Edit Offer" : "New Offer"}</h3>
                <button onClick={() => setOfferForm(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                  <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Title</label>
                  <input
                    type="text"
                    value={offerForm.title}
                    onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="Flat ₹50 OFF"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Subtitle</label>
                  <input
                    type="text"
                    value={offerForm.subtitle}
                    onChange={(e) => setOfferForm({ ...offerForm, subtitle: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="On rides above ₹150"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Text Color</label>
                  <input
                    type="color"
                    value={offerForm.color}
                    onChange={(e) => setOfferForm({ ...offerForm, color: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Background Color</label>
                  <input
                    type="color"
                    value={offerForm.bg}
                    onChange={(e) => setOfferForm({ ...offerForm, bg: e.target.value })}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E293B]"
                  />
                </div>
              </div>
              <div className="w-40 rounded-xl p-3" style={{ backgroundColor: offerForm.bg }}>
                <p className="text-xs font-bold" style={{ color: offerForm.color }}>{offerForm.title || "Preview title"}</p>
                <p className="text-[10px] mt-0.5" style={{ color: offerForm.color }}>{offerForm.subtitle || "Preview subtitle"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={saveOffer} className="btn-saffron px-5 py-2 text-sm">{offerForm.id ? "Save Changes" : "Add Offer"}</button>
                <button onClick={() => setOfferForm(null)} className="px-5 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {offerTeasers.map((o, i) => (
              <div key={o.id} className={`flex items-center gap-3 rounded-xl p-3 ${o.enabled ? "bg-[#F8F9FA] dark:bg-[#0F172A]" : "bg-gray-50 dark:bg-black/20 opacity-60"}`}>
                <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ backgroundColor: o.bg }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{o.title}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{o.subtitle}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => moveOfferTeaser(o.id, -1)} disabled={i === 0} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move up">
                    <ChevronUp className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                  </button>
                  <button onClick={() => moveOfferTeaser(o.id, 1)} disabled={i === offerTeasers.length - 1} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move down">
                    <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                  </button>
                  <button onClick={() => updateOfferTeaser(o.id, { enabled: !o.enabled })} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label={o.enabled ? "Disable" : "Enable"}>
                    {o.enabled ? <Eye className="w-3.5 h-3.5 text-[#138808]" /> : <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                  </button>
                  <button onClick={() => openEditOffer(o)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Edit">
                    <Pencil className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  </button>
                  <button onClick={() => removeOfferTeaser(o.id)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                  </button>
                </div>
              </div>
            ))}
            {offerTeasers.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No offers yet — add one above.</p>}
          </div>
        </div>

        {/* Nearby Services */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Nearby Services</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Quick-tile grid in the full-screen panel</p>
            </div>
            <button
              onClick={openAddNearby}
              className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-[#E05F00] transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Service
            </button>
          </div>

          {nearbyForm && (
            <div className="mt-4 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{nearbyForm.id ? "Edit Service" : "New Service"}</h3>
                <button onClick={() => setNearbyForm(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                  <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Label</label>
                  <input
                    type="text"
                    value={nearbyForm.label}
                    onChange={(e) => setNearbyForm({ ...nearbyForm, label: e.target.value })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    placeholder="Hospital"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Icon</label>
                  <select
                    value={nearbyForm.icon}
                    onChange={(e) => setNearbyForm({ ...nearbyForm, icon: e.target.value as NearbyServiceIcon })}
                    className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  >
                    {NEARBY_ICON_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveNearby} className="btn-saffron px-5 py-2 text-sm">{nearbyForm.id ? "Save Changes" : "Add Service"}</button>
                <button onClick={() => setNearbyForm(null)} className="px-5 py-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {nearbyServices.map((s, i) => {
              const ServiceIcon = NEARBY_ICON_MAP[s.icon];
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl p-3 ${s.enabled ? "bg-[#F8F9FA] dark:bg-[#0F172A]" : "bg-gray-50 dark:bg-black/20 opacity-60"}`}>
                  <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                    <ServiceIcon className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                  </div>
                  <p className="flex-1 text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{s.label}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveNearbyService(s.id, -1)} disabled={i === 0} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move up">
                      <ChevronUp className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                    </button>
                    <button onClick={() => moveNearbyService(s.id, 1)} disabled={i === nearbyServices.length - 1} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30" aria-label="Move down">
                      <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                    </button>
                    <button onClick={() => updateNearbyService(s.id, { enabled: !s.enabled })} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label={s.enabled ? "Disable" : "Enable"}>
                      {s.enabled ? <Eye className="w-3.5 h-3.5 text-[#138808]" /> : <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                    </button>
                    <button onClick={() => openEditNearby(s)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Edit">
                      <Pencil className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    </button>
                    <button onClick={() => removeNearbyService(s.id)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                    </button>
                  </div>
                </div>
              );
            })}
            {nearbyServices.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4 col-span-2">No services yet — add one above.</p>}
          </div>
        </div>

        {/* Quick Tiles */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">"More for you" Quick Tiles</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">School Pass, Send Parcel, Refer &amp; Earn, Support — rename or hide, full-screen panel only</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickTiles.map((tile) => (
              <div key={tile.id} className={`flex items-center gap-3 rounded-xl p-3 ${tile.enabled ? "bg-[#F8F9FA] dark:bg-[#0F172A]" : "bg-gray-50 dark:bg-black/20 opacity-60"}`}>
                <input
                  type="text"
                  value={tile.label}
                  onChange={(e) => updateQuickTile(tile.id, { label: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] outline-none min-w-0"
                />
                <button onClick={() => updateQuickTile(tile.id, { enabled: !tile.enabled })} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex-shrink-0" aria-label={tile.enabled ? "Disable" : "Enable"}>
                  {tile.enabled ? <Eye className="w-3.5 h-3.5 text-[#138808]" /> : <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ride Types */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Ride Type Chips</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">Share, Reserve, Women, School, Corporate, Schedule — rename or hide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rideTypes.map((rt) => (
              <div key={rt.id} className={`flex items-center gap-3 rounded-xl p-3 ${rt.enabled ? "bg-[#F8F9FA] dark:bg-[#0F172A]" : "bg-gray-50 dark:bg-black/20 opacity-60"}`}>
                <input
                  type="text"
                  value={rt.label}
                  onChange={(e) => updateRideType(rt.id, { label: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] outline-none min-w-0"
                />
                <button onClick={() => updateRideType(rt.id, { enabled: !rt.enabled })} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex-shrink-0" aria-label={rt.enabled ? "Disable" : "Enable"}>
                  {rt.enabled ? <Eye className="w-3.5 h-3.5 text-[#138808]" /> : <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
