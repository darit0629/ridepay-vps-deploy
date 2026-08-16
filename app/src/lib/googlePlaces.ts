import { categorizeGoogleTypes, type PoiCategory } from "@/lib/googleMarkerIcons";

export interface SelectedPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
}

// Wires Google's own Places Autocomplete dropdown directly to an <input>.
// Google renders and positions its own suggestion list (the `.pac-container`
// it injects into <body>), so callers don't need to render a results list
// themselves - this replaces the old hand-rolled search dropdown entirely.
export function attachAutocomplete(
  input: HTMLInputElement,
  onSelect: (place: SelectedPlace) => void,
  biasCenter: google.maps.LatLngLiteral
): google.maps.places.Autocomplete {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ["name", "formatted_address", "geometry"],
    // A tight ~6km box around the rider so nearby places consistently
    // outrank identically-named (or just more globally popular) ones far
    // away — without hard-excluding genuinely distant searches (bounds here
    // is a soft bias, not a filter; strictBounds stays off on purpose).
    bounds: {
      south: biasCenter.lat - 0.055,
      west: biasCenter.lng - 0.055,
      north: biasCenter.lat + 0.055,
      east: biasCenter.lng + 0.055,
    },
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    const location = place.geometry?.location;
    if (!location) return;
    onSelect({
      name: place.name || place.formatted_address || input.value,
      lat: location.lat(),
      lng: location.lng(),
    });
  });

  return autocomplete;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PoiCategory;
}

// Free-text destination search, ranked purely by distance from the rider
// instead of Google's default relevance/prominence ranking. Plain
// google.maps.places.Autocomplete (see attachAutocomplete above) only soft-
// biases toward `bounds` — a bare category word like "college" still comes
// back dominated by big-city results with more reviews/prominence far away.
// Place.searchByText with rankPreference "DISTANCE" fixes that for both
// generic category words ("college") and specific named places ("Ranaghat
// college") alike, so this replaces the destination <input>'s dropdown
// instead of running alongside it.
export async function searchPlacesNearby(
  query: string,
  center: google.maps.LatLngLiteral,
  radiusMeters = 12000
): Promise<PlaceSearchResult[]> {
  const { places } = await google.maps.places.Place.searchByText({
    textQuery: query,
    locationBias: { center, radius: radiusMeters },
    rankPreference: google.maps.places.SearchByTextRankPreference.DISTANCE,
    fields: ["id", "displayName", "formattedAddress", "location", "types"],
    maxResultCount: 8,
  });

  return places
    .filter((place) => place.location && place.displayName)
    .map((place) => ({
      id: place.id,
      name: place.displayName!,
      address: place.formattedAddress ?? "",
      lat: place.location!.lat(),
      lng: place.location!.lng(),
      category: categorizeGoogleTypes(place.types ?? []),
    }));
}

const NEARBY_PLACE_TYPES = [
  "restaurant",
  "cafe",
  "bank",
  "atm",
  "hospital",
  "pharmacy",
  "school",
  "university",
  "shopping_mall",
  "store",
  "supermarket",
  "clothing_store",
  "gas_station",
  "lodging",
  "tourist_attraction",
];

// Real nearby shops/restaurants/schools/landmarks from Google's own place
// database - the direct fix for "I can't find my college/shop/mall" since
// Google's coverage is far denser than the free OSM data used previously.
export async function fetchNearbyPlaces(
  center: google.maps.LatLngLiteral,
  radiusMeters = 1500
): Promise<NearbyPlace[]> {
  const { places } = await google.maps.places.Place.searchNearby({
    fields: ["displayName", "location", "types", "id"],
    locationRestriction: { center, radius: radiusMeters },
    includedTypes: NEARBY_PLACE_TYPES,
    maxResultCount: 20,
  });

  return places
    .filter((place) => place.location && place.displayName)
    .map((place) => ({
      id: place.id,
      name: place.displayName!,
      lat: place.location!.lat(),
      lng: place.location!.lng(),
      category: categorizeGoogleTypes(place.types ?? []),
    }));
}
