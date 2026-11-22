# T03 report

## What I changed
- `mobile/src/lib/calendarStore.js` — rewrote the phone-calendar part against the installed plugin's real API (checked in `node_modules/@capgo/capacitor-calendar/dist/esm/definitions.d.ts` and `schemas/`): now imports `{ CapacitorCalendar, CalendarPermissionScope }` (no more nonexistent `Calendar` export); `eventTimes` is exported and reads Zambian time as `${date}T${HH:MM:SS}+02:00` (missing start → 09:00, missing/non-after end → start + 1h); `addToPhoneCalendar(event, prefs, { plugin, native })` returns `"added" | "denied" | "failed" | "unavailable"` and uses `checkPermission({ scope: WRITE_CALENDAR })` → `requestFullCalendarAccess()` → `createEvent({ title, startDate: <ms number>, endDate: <ms number>, location, description, isAllDay: false })`, storing the returned id under `upcz.cal.<eventId>`; `removeFromPhoneCalendar` deletes via `deleteEvent({ id })` in try/catch and always removes the stored key. `ADDED_KEY`, `toggleId`, `readAdded`, `writeAdded`, `toggleAdded` are byte-for-byte unchanged.
- `mobile/src/screens/Events.jsx` — `EventBody` only: new `phoneCal` state storing the `addToPhoneCalendar` outcome; the note under the button now says truthfully "In your phone's calendar." / "Not put in your phone's calendar, because calendar access is off. You can allow it in your phone's settings." / "Your phone's calendar couldn't be updated. The event is still saved in this app." (nothing about the phone calendar for `unavailable`/already-added), followed by the reminders sentence ("Reminders are set for the evening before and the morning of." / "Reminders are off. Allow notifications in Settings to get them."). Reminders lines untouched (T04).
- `mobile/android/app/src/main/AndroidManifest.xml` — added `READ_CALENDAR` and `WRITE_CALENDAR` under `INTERNET`.
- `mobile/RELEASE.md` — data-safety calendar bullet now reads: "Calendar access is asked for only when you tap \"Add to calendar\"; the app writes that one event and reads nothing else." (notification part kept).
- `mobile/tests/calendarStore.test.mjs` — appended the 7 new tests with the task's `fakePlugin` builder (existing tests untouched).

## Tests added
1. `eventTimes reads Zambian time` — 10:00–12:00 on 2026-11-22 in Zambia == 08:00–10:00 UTC.
2. `eventTimes: missing/invalid end is start + 1h; missing start is 09:00` — incl. 09:00 Zambia == 07:00Z.
3. granted permission → `"added"`, numeric `startDate`/`endDate`, `description` (and no `notes`), id stored under `upcz.cal.42`, check used `writeCalendar` scope.
4. `prompt` then request `denied` → `"denied"`, no `createEvent`, nothing stored.
5. `createEvent` throws → `"failed"`.
6. `native: false` → `"unavailable"`, zero plugin calls.
7. `removeFromPhoneCalendar` → `deleteEvent({id:"77"})` and key removed; throwing `deleteEvent` still removes the key.

## Tests seen failing first
Yes:

```
$ npm test
# SyntaxError: The requested module '../src/lib/calendarStore.js' does not provide an export named 'eventTimes'
# tests 86
# pass 85
# fail 1        <- the whole calendarStore test file failed to load
```

After the rewrite: `# tests 95 / # pass 95 / # fail 0`.

## Acceptance checks

1. Build has no `IMPORT_IS_UNDEFINED` (the old `Calendar` import was the cause; the warning is gone):

```
$ npm run build
...
dist/assets/react-BXeL_qA3.js   146.82 kB │ gzip: 49.49 kB
dist/assets/index-Cvat0ov6.js   277.19 kB │ gzip: 87.11 kB
✓ built in 336ms
$ npm run build 2>&1 | grep -cE "IMPORT_IS_UNDEFINED|warning"
0
```

2. All tests pass, lint clean:

```
$ npm test
# tests 95
# pass 95
# fail 0
$ npm run lint
> eslint .
(no findings; grep -cE "error|warning" → 0)
```

3. Manifest:

```
$ grep -n CALENDAR mobile/android/app/src/main/AndroidManifest.xml
41:    <uses-permission android:name="android.permission.READ_CALENDAR" />
42:    <uses-permission android:name="android.permission.WRITE_CALENDAR" />
```

Mutation check (then undone) — `notes:` in place of `description:`:

```
$ node --test tests/calendarStore.test.mjs
not ok 6 - addToPhoneCalendar with granted permission creates a numeric-ms event with description and stores the id
# pass 9
# fail 1
--- reverted ---
# tests 10
# pass 10
# fail 0
```

## Always-run checks

From `mobile/` (this task touches only `mobile/`; backend and website untouched, not re-run):

```
npm test      → # tests 95 / # pass 95 / # fail 0
npm run lint  → clean (0 errors, 0 warnings)
npm run build → ✓ built in 336ms, no IMPORT_IS_UNDEFINED or any warning (grep count 0)
```

## Deviations
None. Only the five files named in the task were changed (calendarStore.js, Events.jsx EventBody, calendarStore.test.mjs, AndroidManifest.xml, RELEASE.md), plus this report.

## Things I could not verify
- Real-phone behaviour: actual Android permission dialog, event appearing in the phone's calendar app, and behaviour on a phone set to another time zone (the +02:00 offset math is unit-tested, but not on a device). No emulator/phone in this environment.
