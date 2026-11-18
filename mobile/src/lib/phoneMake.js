const MAKES = ["tecno", "infinix", "xiaomi", "redmi", "poco", "itel"];

export function needsBatteryGuide(userAgent = globalThis.navigator?.userAgent ?? "") {
  const ua = String(userAgent).toLowerCase();
  return MAKES.some((make) => ua.includes(make));
}

export const BATTERY_GUIDE =
  "Some phones pause apps in the background, which can delay reminders. On your phone: open Settings → Apps → UPCZ → Battery (or Battery & device care) and choose Unrestricted or No restrictions, and allow notifications for the app.";
