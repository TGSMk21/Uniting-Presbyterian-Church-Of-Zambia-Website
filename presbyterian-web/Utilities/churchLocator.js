// Pure rules for the national "Find a Branch" page, kept apart from the map
// and React so they can be tested on their own.

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function hasLocation(branch) {
  return branch?.latitude != null && branch?.longitude != null;
}

// "Freedom Compound, Chilanga, Lusaka, Zambia" → "Lusaka"
export function townOf(branch) {
  const parts = (branch?.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : parts[0] || "";
}

export function towns(branches) {
  return [...new Set(branches.map(townOf).filter(Boolean))].sort();
}

export function filterBranches(branches, query = "", town = "") {
  const wanted = query.trim().toLowerCase();
  return branches.filter((branch) => {
    if (town && townOf(branch) !== town) return false;
    if (!wanted) return true;
    return `${branch.name} ${branch.address || ""}`.toLowerCase().includes(wanted);
  });
}

// Great-circle (haversine) distance between two { lat, lng } points.
export function distanceKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Nearest first; branches with no location go last, with distanceKm: null.
export function sortByDistance(branches, from) {
  return branches
    .map((branch) => ({
      ...branch,
      distanceKm: hasLocation(branch)
        ? distanceKm(from, { lat: Number(branch.latitude), lng: Number(branch.longitude) })
        : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

// Approximate pins mark an area, so don't navigate people to that exact spot.
export function directionsUrl(branch) {
  if (branch.location_confirmed && hasLocation(branch)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`;
  }
  const query = [branch.name, branch.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
