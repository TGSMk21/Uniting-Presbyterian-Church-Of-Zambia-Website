// Where the person is: one of five tabs, pages opened on top (profile, settings,
// favourites), and at most one bottom sheet. Plain data, so the Android back button's
// behaviour can be tested (MOBILE_APP_PLAN.md, Phase 0).

export const TABS = [
  { id: "home", label: "Home" },
  { id: "events", label: "Events" },
  { id: "sermons", label: "Sermons" },
  { id: "hymns", label: "Hymns" },
  { id: "announcements", label: "Announcements" },
];

export const PAGES = ["profile", "settings", "favourites", "motion-lab"];

export function initialNav() {
  return { tab: "home", visited: ["home"], stack: [], sheet: null, scrollTopTick: 0 };
}

export function selectTab(nav, tab) {
  if (!TABS.some((t) => t.id === tab)) return nav;
  if (tab === nav.tab && nav.stack.length === 0) return { ...nav, scrollTopTick: nav.scrollTopTick + 1 };
  const visited = nav.visited.includes(tab) ? nav.visited : [...nav.visited, tab];
  return { ...nav, tab, visited, stack: [], sheet: null };
}

export function openPage(nav, page) {
  if (!PAGES.includes(page) || nav.stack.at(-1) === page) return nav;
  return { ...nav, stack: [...nav.stack, page], sheet: null };
}

export function openSheet(nav, sheet) {
  return { ...nav, sheet };
}

// The Android back button: close a sheet, then a page, then go Home, then leave.
export function back(nav) {
  if (nav.sheet) return { nav: { ...nav, sheet: null }, leave: false };
  if (nav.stack.length) return { nav: { ...nav, stack: nav.stack.slice(0, -1) }, leave: false };
  if (nav.tab !== "home") return { nav: { ...nav, tab: "home" }, leave: false };
  return { nav, leave: true };
}
