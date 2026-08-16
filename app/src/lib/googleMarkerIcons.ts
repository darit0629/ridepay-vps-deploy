export type PoiCategory =
  | "shop"
  | "food"
  | "cafe"
  | "bank"
  | "health"
  | "fuel"
  | "hotel"
  | "attraction"
  | "education"
  | "other";

// Classic google.maps.Marker (not AdvancedMarkerElement) is used throughout
// this app on purpose: it needs no Map ID / cloud map styling setup, which
// keeps the Google Cloud project configuration simple for this project.
function svgIcon(size: number, inner: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${inner}</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function dotIcon(size: number, fill: string): google.maps.Icon {
  const r = size / 2 - 2;
  return svgIcon(size, `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${fill}" stroke="white" stroke-width="2"/>`);
}

// Classic teardrop map-pin — anchored at its bottom tip (not center) so it
// visually "points at" the coordinate, the way a dropped pin should.
function pinIcon(size: number, fill: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <path d="M12 0C7.58 0 4 3.58 4 8c0 5.7 6.16 13.6 7.3 15.02a.9.9 0 0 0 1.4 0C13.84 21.6 20 13.7 20 8c0-4.42-3.58-8-8-8z" fill="${fill}" stroke="white" stroke-width="1"/>
    <circle cx="12" cy="8" r="3.4" fill="white"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size),
  };
}

export function createCurrentLocationIcon(): google.maps.Icon {
  return dotIcon(16, "#138808");
}

export function createPickupIcon(): google.maps.Icon {
  return pinIcon(38, "#138808");
}

export function createDestinationIcon(): google.maps.Icon {
  return pinIcon(38, "#FF6B00");
}

export type VehicleStatus = "available" | "busy" | "booked" | "offline" | "premium";

const VEHICLE_STATUS_RING: Record<VehicleStatus, string> = {
  available: "#138808",
  busy: "#FF6B00",
  booked: "#0EA5E9",
  offline: "#9CA3AF",
  premium: "#EAB308",
};

export function createVehicleIcon(options: { parcelBadge?: boolean; status?: VehicleStatus } = {}): google.maps.Icon {
  const status = options.status ?? "available";
  const ring = VEHICLE_STATUS_RING[status];
  const badge = options.parcelBadge
    ? `<circle cx="27" cy="7" r="6.5" fill="#FF6B00" stroke="white" stroke-width="1.5"/>
       <text x="27" y="10" font-size="8" text-anchor="middle">📦</text>`
    : "";
  const star = status === "premium"
    ? `<circle cx="27" cy="27" r="6.5" fill="#EAB308" stroke="white" stroke-width="1.5"/>
       <text x="27" y="30" font-size="8" text-anchor="middle">⭐</text>`
    : "";
  return svgIcon(
    34,
    `<circle cx="17" cy="17" r="15.5" fill="white" stroke="${ring}" stroke-width="2.5"/>
     <circle cx="17" cy="17" r="15.5" fill="none" stroke="white" stroke-width="0.5"/>
     <text x="50%" y="57%" font-size="16" text-anchor="middle" dominant-baseline="middle">🛺</text>
     ${badge}
     ${star}`
  );
}

export function createDriverIcon(): google.maps.Icon {
  return svgIcon(
    28,
    `<circle cx="14" cy="14" r="13" fill="#FF6B00" stroke="white" stroke-width="3"/>
     <text x="50%" y="56%" font-size="13" text-anchor="middle" dominant-baseline="middle">🚗</text>`
  );
}

// Premium heading-aware marker used on the active ride-navigation screen: a
// glowing ring with a directional arrow (rotated to the current bearing)
// plus the rickshaw glyph, standing in for a true 3D vehicle model.
export function createNavigationVehicleIcon(headingDeg = 0): google.maps.Icon {
  const size = 44;
  const c = size / 2;
  return svgIcon(
    size,
    `<circle cx="${c}" cy="${c}" r="21" fill="#FF6B00" opacity="0.18"/>
     <circle cx="${c}" cy="${c}" r="15.5" fill="white" stroke="#FF6B00" stroke-width="3"/>
     <g transform="rotate(${headingDeg} ${c} ${c})">
       <polygon points="${c},${c - 20} ${c - 5},${c - 12} ${c + 5},${c - 12}" fill="#FF6B00"/>
     </g>
     <text x="50%" y="58%" font-size="17" text-anchor="middle" dominant-baseline="middle">🛺</text>`
  );
}

export function createCourierIcon(): google.maps.Icon {
  return svgIcon(
    34,
    `<circle cx="17" cy="17" r="16" fill="#0EA5E9" stroke="white" stroke-width="3"/>
     <text x="50%" y="56%" font-size="15" text-anchor="middle" dominant-baseline="middle">🛵</text>`
  );
}

const POI_STYLE: Record<PoiCategory, { emoji: string; border: string }> = {
  shop: { emoji: "🛍️", border: "#FF6B00" },
  food: { emoji: "🍴", border: "#DC2626" },
  cafe: { emoji: "☕", border: "#92400E" },
  bank: { emoji: "🏧", border: "#1E3A5F" },
  health: { emoji: "⚕️", border: "#138808" },
  fuel: { emoji: "⛽", border: "#6B7280" },
  hotel: { emoji: "🏨", border: "#7C3AED" },
  attraction: { emoji: "📍", border: "#0EA5E9" },
  education: { emoji: "🎓", border: "#2563EB" },
  other: { emoji: "📌", border: "#6B7280" },
};

// Same emoji set as the map pins, for rendering POI category in flat list UI
// (e.g. the destination search results dropdown) without pulling in a full
// google.maps.Icon.
export function poiEmoji(category: PoiCategory): string {
  return POI_STYLE[category].emoji;
}

export function createPoiIcon(category: PoiCategory): google.maps.Icon {
  const { emoji, border } = POI_STYLE[category];
  const size = 30;
  return svgIcon(
    size,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="white" stroke="${border}" stroke-width="2"/>
     <text x="50%" y="55%" font-size="14" text-anchor="middle" dominant-baseline="middle">${emoji}</text>`
  );
}

const GOOGLE_TYPE_CATEGORY: Record<string, PoiCategory> = {
  restaurant: "food",
  meal_takeaway: "food",
  meal_delivery: "food",
  fast_food_restaurant: "food",
  cafe: "cafe",
  coffee_shop: "cafe",
  bank: "bank",
  atm: "bank",
  hospital: "health",
  pharmacy: "health",
  doctor: "health",
  gas_station: "fuel",
  lodging: "hotel",
  hotel: "hotel",
  tourist_attraction: "attraction",
  museum: "attraction",
  park: "attraction",
  school: "education",
  primary_school: "education",
  secondary_school: "education",
  university: "education",
  shopping_mall: "shop",
  store: "shop",
  supermarket: "shop",
  clothing_store: "shop",
};

export function categorizeGoogleTypes(types: string[]): PoiCategory {
  for (const type of types) {
    const category = GOOGLE_TYPE_CATEGORY[type];
    if (category) return category;
  }
  return "other";
}
