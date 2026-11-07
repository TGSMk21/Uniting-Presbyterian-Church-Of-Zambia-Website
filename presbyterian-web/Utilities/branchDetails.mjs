// A branch's contact details and map position, edited from the dashboard
// (AGENT_EXECUTION_PLAN.md, Task 5.3). The API checks everything again.
import { BRANCH_LIST_TAG } from "./branchContent.mjs";
import { branchTag } from "./pageContent.mjs";

// A little wider than Zambia itself, matching the API.
export const ZAMBIA = { south: -18.5, north: -8.0, west: 21.5, east: 34.0 };
export const ZAMBIA_CENTRE = [-14.5, 28];

const POSITION_HELP = "Please enter the position as two numbers, like -15.4167, 28.2833.";

export function inZambia({ latitude, longitude }) {
  return latitude >= ZAMBIA.south && latitude <= ZAMBIA.north && longitude >= ZAMBIA.west && longitude <= ZAMBIA.east;
}

// Six decimal places is about 10 cm, as much as the API keeps.
export function roundPosition(value) {
  return Math.round(value * 1e6) / 1e6;
}

// "-15.4167, 28.2833" as copied from Google Maps. Empty means no position.
// Returns { position } or { error }.
export function parsePosition(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { position: null };
  const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
  const numbers = parts.map(Number);
  if (parts.length !== 2 || numbers.some((n) => !Number.isFinite(n)) || parts.some((p) => !/^[-+]?\d+(\.\d+)?$/.test(p))) {
    return { error: POSITION_HELP };
  }
  const [latitude, longitude] = numbers.map(roundPosition);
  if (inZambia({ latitude, longitude })) return { position: { latitude, longitude } };
  if (inZambia({ latitude: longitude, longitude: latitude })) {
    return { error: "These numbers look the wrong way round. The first one should be about -8 to -18." };
  }
  return { error: "This position is outside Zambia. Please check it." };
}

export function formatPosition(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return "";
  return `${Number(latitude)}, ${Number(longitude)}`;
}

export function detailsFromForm(formData) {
  const text = (key) => String(formData.get(key) ?? "").replace(/\r\n/g, "\n").trim();
  const parsed = parsePosition(formData.get("position"));
  const values = {
    contact_email: text("contact_email"),
    contact_phone: text("contact_phone"),
    address: text("address"),
    location_confirmed: formData.get("location_confirmed") === "on",
  };
  if (parsed.error) return { values, errors: { position: parsed.error } };
  return {
    values: {
      ...values,
      latitude: parsed.position?.latitude ?? null,
      longitude: parsed.position?.longitude ?? null,
    },
    errors: {},
  };
}

// The API's complaints, by box. Both parts of the position share one box.
export function detailsFailure(status, data) {
  if (status === 401) return { signedOut: true };
  if (status === 403) return { error: "You can't change this branch's details.", fields: {} };
  if (status === 404) return { error: "This branch couldn't be found.", fields: {} };
  if (status === 400 && data && typeof data === "object") {
    const boxes = { latitude: "position", longitude: "position" };
    const known = new Set(["contact_email", "contact_phone", "address", "location_confirmed", "position"]);
    const fields = {};
    const other = [];
    for (const [key, messages] of Object.entries(data)) {
      const box = boxes[key] || key;
      const text = [].concat(messages).join(" ");
      if (known.has(box)) fields[box] = fields[box] ? `${fields[box]} ${text}` : text;
      else other.push(text);
    }
    return { error: other.length ? other.join(" ") : null, fields };
  }
  return { error: "Nothing was saved. Please try again in a moment.", fields: {} };
}

// The branch's own pages and Find a Branch both show these details.
export function detailsTags(branch) {
  return [branchTag(branch), BRANCH_LIST_TAG];
}
