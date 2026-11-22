# T04 — Reminders and the notification permission

**Fixes:** F09, F10 (High) · **Area:** app · **Branch:** `task/T04` · **Depends on:** nothing (T03 may merge first; touch only the lines named here in `Events.jsx`)

## Why

- Tapping a reminder only opens the app. Spec 11 says it should open the event.
- `removeStaleReminders` cancels **every** pending reminder whose event isn't in the *current* branch's list, so changing branch silently kills reminders.
- Reminders are never rescheduled when an event's date or time changes.
- There's no status-bar icon (Android draws a white square), and there's no `allowWhileIdle`, so reminders are late on phones in Doze.
- Settings reads the web `Notification.permission`, which Android WebView doesn't have, so the phone shows "Not available in this browser".

## Decisions (don't change them)

- Each scheduled reminder carries `extra: { eventId, branchSlug, date, start_time }`. Cleaning up only ever touches reminders **for the branch being checked**.
- A new pure function decides what to cancel and what to reschedule, so it can be tested.
- Tapping a reminder opens the event sheet. The app looks the event up in the saved events for that branch. If it isn't there, it opens nothing (the app is simply open).
- Settings uses `LocalNotifications.checkPermissions()` on the phone.

## Changes

### 1. `mobile/src/lib/reminders.js`

- `reminderPlan(event, now)` stays as it is (tests depend on it).
- `scheduleEventReminders(event, { branchSlug })`: each notification gets
  `extra: { eventId: String(event.id), branchSlug, date: event.date, start_time: event.start_time ?? "" }`,
  `schedule: { at: p.at, allowWhileIdle: true }`,
  `smallIcon: "ic_stat_upcz"` and `iconColor: "#1b2a6b"`.
- Add this pure function:
  ```js
  // pending: [{ id, extra }] from getPending(). events: the branch's current list.
  // Returns { cancel: [ids], reschedule: [event] } for reminders of THIS branch only.
  export function reconcileReminders(pending, events, branchSlug) { … }
  ```
  Rules, for each pending notification whose `extra.branchSlug === branchSlug`:
  - If its event id isn't in `events`, put it in `cancel`.
  - If the event exists but `date` or `start_time` differs from `extra`, put the event in `reschedule` (once per event, not once per notification).
  - Leave notifications with another `branchSlug`, or with no `extra`, untouched.
- Replace `removeStaleReminders(keptEventIds)` with:
  ```js
  export async function syncReminders(events, branchSlug, addedIds) { … }
  ```
  On the phone only: `getPending()` → `reconcileReminders` → cancel those ids. Reschedule each returned event **only if** its id is in `addedIds` (by calling `scheduleEventReminders(event, { branchSlug })`, which cancels the old ones first). Wrap everything in `try/catch`.
- Add a read-only status function that never prompts:
  ```js
  // "granted" | "denied" | "prompt" | "unavailable" | "web"
  export async function notificationStatus() { … }
  ```
  If not native, return `"web"`. Otherwise return `(await LocalNotifications.checkPermissions()).display`, mapping `"prompt-with-rationale"` to `"prompt"`. Any error returns `"unavailable"`.
- Keep `notificationPermission()` (it asks). It is used when the person adds an event or taps the Settings row.

### 2. `mobile/src/screens/Events.jsx`

- `EventBody` needs the branch: add a `branchSlug` prop, and call `scheduleEventReminders(event, { branchSlug })`.
- In `EventsTab`, replace the `removeStaleReminders(...)` effect with `syncReminders(events.data.events, branchSlug, added)`, and run it only when `events.source === "api"` (fresh data, not the saved copy).

### 3. `mobile/src/App.jsx`

- Pass `branchSlug={profile.branchSlug}` to `<EventBody>`.
- Add an effect (native only) that registers `LocalNotifications.addListener("localNotificationActionPerformed", …)` once, and removes it on unmount (`handle.remove()`; handle the promise as the back-button listener does). On a tap:
  1. Read `eventId` and `branchSlug` from `notification.extra`.
  2. Read the saved events copy for that branch, `readJSON(getPrefs(), "upcz.events." + branchSlug, null)`, and find the event in `cached.data.events`. After T05 lands, Claude will point this at the new store; for now use the key that exists today.
  3. If it's found, `setEvent(found)`. If the app is still on the opening or first-run stage, keep the event in a ref and open it once the stage becomes `app`.

### 4. Status-bar icon: new file `mobile/android/app/src/main/res/drawable/ic_stat_upcz.xml`

A plain white cross (Android tints it). Use exactly this:
```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M10.5,2h3v6h6v3h-6v11h-3V11h-6V8h6z"/>
</vector>
```

### 5. `mobile/capacitor.config.json`

Add to `plugins`:
```json
"LocalNotifications": { "smallIcon": "ic_stat_upcz", "iconColor": "#1b2a6b" }
```

### 6. `mobile/src/screens/Pages.jsx`, `SettingsPage` notifications row

- Remove the `notificationStatus()` helper that reads `globalThis.Notification`. Import `notificationStatus` from `reminders.js` instead.
- `const [notif, setNotif] = useState("loading")`, and in an effect `notificationStatus().then(setNotif)`. Re-check it when the app comes back to the foreground (use `useForegroundRefresh` from `lib/useContent.js`), because the person may have changed it in the phone's settings.
- Words (replace `NOTIFICATION_WORDS`):
  - `granted`: "Allowed"
  - `prompt`: "Not asked yet. Tap to allow: you'll get a reminder the evening before and the morning of an event you add."
  - `denied`: "Turned off. To get reminders, allow notifications for UPCZ in your phone's settings."
  - `web` / `unavailable`: "Reminders work in the app on your phone."
  - `loading`: "Checking…"
- The row is a button **only** when the status is `prompt`. Tapping it calls `notificationPermission()` and then sets `notif` to the fresh `notificationStatus()`. In every other state, render it as `list-row static` (not a button).

## Tests (write first, see them fail): `mobile/tests/reminders.test.mjs`

1. `reconcileReminders` cancels a reminder whose event is gone (same branch).
2. It leaves alone a reminder of **another** branch, and one with no `extra`.
3. It reschedules an event whose `start_time` changed, **once** even though two notifications exist for it.
4. It does nothing when everything matches.

**Mutation check (do, then undo):** drop the `branchSlug` comparison; test 2 must fail.

## Acceptance checks

1. Tests, lint and build are clean.
2. In a desktop browser (`npm run dev`), Settings → Notifications shows "Reminders work in the app on your phone." and isn't a button.
3. Write in the report: "Notification tap and Doze timing need checking on a real phone." Don't claim you checked them.

## Out of scope

The calendar (T03). Changing reminder times (18:00 and 07:00 stay).
