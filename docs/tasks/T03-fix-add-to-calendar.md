# T03 — Make "Add to calendar" work

**Fixes:** F03 (Critical) · **Area:** app · **Branch:** `task/T03` · **Depends on:** nothing

## Why

`mobile/src/lib/calendarStore.js` is wrong against the installed plugin, `@capgo/capacitor-calendar@8.0.17`:

| Wrong now | Correct (from `node_modules/@capgo/capacitor-calendar/dist/esm/definitions.d.ts`) |
|---|---|
| `capgoCalendar.Calendar` (undefined; the build warns about it) | `import { CapacitorCalendar, CalendarPermissionScope } from "@capgo/capacitor-calendar"` |
| `Calendar.checkPermissions()` / `requestPermissions()` returning `{calendar}` | `checkPermission({ scope: CalendarPermissionScope.WRITE_CALENDAR })` returns `{ result }`; `requestFullCalendarAccess()` returns `{ result }`, where `result` is `"granted"`, `"denied"`, `"prompt"`, … |
| `startDate`/`endDate` as ISO strings | numbers (milliseconds since the epoch) |
| `notes` | `description` |
| `deleteEvent({ id })` | correct as it is |

The Android manifest also lacks the calendar permissions, so the request can never be granted. And the sheet says "Saved to your calendar" even when nothing was saved.

## Decisions (don't change them)

- **"Added" is the app's own state**: the event is highlighted in the in-app calendar and reminders are set (T04). Putting it in the phone's calendar is attempted too, and **the sheet must say truthfully whether that worked.**
- Ask with `requestFullCalendarAccess()` (read and write). On Android, the plugin needs read access to find the default calendar.
- **Event times are Zambian time.** Zambia is UTC+02:00 all year with no daylight saving, so build times as `${date}T${HH:MM:SS}+02:00`. This keeps them right even if the phone is set to another time zone.
- If `end_time` is missing, or not after `start_time`, the end is the start plus 1 hour. If `start_time` is missing, use `09:00:00`.

## Changes

### 1. `mobile/src/lib/calendarStore.js`

Rewrite the phone-calendar part. Keep `ADDED_KEY`, `toggleId`, `readAdded`, `writeAdded` and `toggleAdded` exactly as they are (other code and tests use them).

```js
import { CapacitorCalendar, CalendarPermissionScope } from "@capgo/capacitor-calendar";

export const ZAMBIA_OFFSET = "+02:00";
const calKey = (eventId) => `upcz.cal.${eventId}`;

// Start and end in milliseconds, read as Zambian time.
export function eventTimes(event) {
  const start = Date.parse(`${event.date}T${String(event.start_time || "09:00:00").slice(0, 8)}${ZAMBIA_OFFSET}`);
  let end = event.end_time ? Date.parse(`${event.date}T${String(event.end_time).slice(0, 8)}${ZAMBIA_OFFSET}`) : NaN;
  if (!Number.isFinite(end) || end <= start) end = start + 60 * 60 * 1000;
  return { start, end };
}

// Returns one of: "added", "denied", "failed", "unavailable" (not on a phone).
export async function addToPhoneCalendar(event, prefs, { plugin = CapacitorCalendar, native = isNative() } = {}) { … }

// Removes the phone-calendar entry this app made, if any. Always forgets the stored id.
export async function removeFromPhoneCalendar(event, prefs, { plugin = CapacitorCalendar, native = isNative() } = {}) { … }
```

Behaviour of `addToPhoneCalendar`:
1. If `!native`, return `"unavailable"`.
2. `const { result } = await plugin.checkPermission({ scope: CalendarPermissionScope.WRITE_CALENDAR })`. If it isn't `"granted"`, call `plugin.requestFullCalendarAccess()` and read its `result`. If that still isn't `"granted"`, return `"denied"`.
3. `const { id } = await plugin.createEvent({ title: event.title, startDate: start, endDate: end, location: event.location || "", description: event.details || "", isAllDay: false })`.
4. If `id` is truthy, `writeJSON(prefs, calKey(event.id), String(id))`.
5. Return `"added"`. Wrap steps 2–4 in `try/catch`; any error returns `"failed"`.

Behaviour of `removeFromPhoneCalendar`:
- If `!native`, do nothing.
- Read the stored id. If there is one, call `plugin.deleteEvent({ id })` inside `try/catch`, because the person may have deleted it already.
- **Always** `prefs.remove(calKey(event.id))` afterwards.

### 2. `mobile/src/screens/Events.jsx`, `EventBody` only

- Keep a `phoneCal` state: `null | "added" | "denied" | "failed" | "unavailable"`.
- In `toggle`, store the return value of `addToPhoneCalendar` in `phoneCal`. Leave the reminders lines as they are (T04 changes them).
- When the event is added, replace the note under the button with these exact texts:
  - `"added"`: "In your phone's calendar."
  - `"denied"`: "Not put in your phone's calendar, because calendar access is off. You can allow it in your phone's settings."
  - `"failed"`: "Your phone's calendar couldn't be updated. The event is still saved in this app."
  - `"unavailable"` or `null`: nothing about the phone calendar.

  Then add a second sentence about reminders, using the existing `remindersOn` logic: "Reminders are set for the evening before and the morning of." **or** "Reminders are off. Allow notifications in Settings to get them."
- If the event is already marked added when the sheet opens (`phoneCal === null`), show only the reminders sentence.

### 3. `mobile/android/app/src/main/AndroidManifest.xml`

Under the existing `INTERNET` permission, add:
```xml
<uses-permission android:name="android.permission.READ_CALENDAR" />
<uses-permission android:name="android.permission.WRITE_CALENDAR" />
```

### 4. `mobile/RELEASE.md`

In the data-safety bullets, the calendar sentence should read: "Calendar access is asked for only when you tap "Add to calendar"; the app writes that one event and reads nothing else."

## Tests (write first, see them fail): `mobile/tests/calendarStore.test.mjs`

Add a fake plugin builder:
```js
function fakePlugin({ perm = "granted", afterRequest = "granted", createId = "77", throwOnCreate = false } = {}) {
  const calls = [];
  return {
    calls,
    checkPermission: async (opts) => { calls.push(["check", opts]); return { result: perm }; },
    requestFullCalendarAccess: async () => { calls.push(["request"]); return { result: afterRequest }; },
    createEvent: async (opts) => { calls.push(["create", opts]); if (throwOnCreate) throw new Error("x"); return { id: createId }; },
    deleteEvent: async (opts) => { calls.push(["delete", opts]); },
  };
}
```
Tests:
1. `eventTimes` reads Zambian time: `{date:"2026-11-22", start_time:"10:00:00", end_time:"12:00:00"}` gives start `Date.parse("2026-11-22T08:00:00Z")` and end `Date.parse("2026-11-22T10:00:00Z")`.
2. `eventTimes` with no end, or with end before start, gives start plus 1 hour. With no start, it uses 09:00.
3. `addToPhoneCalendar` with permission granted: returns `"added"`, `createEvent` gets numeric `startDate`/`endDate` and `description` (not `notes`), and the id is stored under `upcz.cal.<id>`.
4. Permission `prompt` and request `denied`: returns `"denied"`, `createEvent` is never called, nothing is stored.
5. `createEvent` throws: returns `"failed"`.
6. `native: false`: returns `"unavailable"` and makes no plugin calls.
7. `removeFromPhoneCalendar`: calls `deleteEvent` with the stored id and removes the key. When `deleteEvent` throws, the key is still removed.

**Mutation check (do, then undo):** put `notes:` back in place of `description:`; test 3 must fail.

## Acceptance checks

1. `npm run build` prints **no** `IMPORT_IS_UNDEFINED` warning. Paste the tail of the output.
2. All tests pass. Lint is clean.
3. `grep -n CALENDAR mobile/android/app/src/main/AndroidManifest.xml` shows both permissions.

## Out of scope

Reminders (T04), the events list (T07). Don't add a different calendar plugin.
