// Single source of truth for RidePay's real support contact details —
// referenced everywhere the app shows a support email/phone (legal page
// footers, the Support pages, About page, marketing footer). Distinct from
// India's emergency numbers (100 police, 112 unified), which stay hardcoded
// where they already are — those must never be replaced with this.
export const SUPPORT_EMAIL = "online@saypx.in";
export const SUPPORT_PHONE_DISPLAY = "+91 62940 11684";
export const SUPPORT_PHONE_TEL = "tel:+916294011684";
export const SUPPORT_EMAIL_MAILTO = `mailto:${SUPPORT_EMAIL}`;
