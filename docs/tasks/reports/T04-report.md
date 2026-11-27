# T04 report

## What I changed
- `mobile/src/lib/reminders.js` — `scheduleEventReminders(event, { branchSlug })` now puts `extra: { eventId, branchSlug, date, start_time }`, `schedule: { at, allowWhileIdle: true }`, `smallIcon: "ic_stat_upcz"`, `iconColor: "#1b2a6b"` on every notification; added the pure `reconcileReminders(pending, events, branchSlug)` (cancels gone events of this branch, reschedules changed events once per event, never touches other branches' or extra-less reminders); replaced `removeStaleReminders` with `syncReminders(events, branchSlug, addedIds)` (phone-only, getPending → reconcile → cancel, reschedule only added events, all in try/catch); added read-only `notificationStatus()` (never prompts; `"web"` off-device, maps `prompt-with-rationale` → `prompt`, errors → `"unavailable"`). `reminderPlan` and `notificationPermission` unchanged.
- `mobile/src/screens/Events.jsx` — `EventBody` takes a `branchSlug` prop and calls `scheduleEventReminders(event, { branchSlug })`; `EventsTab` replaces the `removeStaleReminders` effect with `syncReminders(events.data.events, branchSlug, added)` run only when `events.source === "api"`. Extra item 8 (from the owner, not the task file): on open, an already-added event now sets `remindersOn` from `notificationStatus() === "granted"` instead of always showing "Reminders are off".
- `mobile/src/App.jsx` — `<EventBody>` gets `branchSlug={profile.branchSlug}`; new native-only effect registers `LocalNotifications.addListener("localNotificationActionPerformed", …)` once and removes it on unmount (`listener.then((handle) => handle.remove())`, same as the back-button listener); on tap it reads `extra.eventId`/`extra.branchSlug`, looks the event up in the saved copy `upcz.events.<slug>` (`cached.data.events`), and opens it via `setEvent` — held in `pendingNotifEventRef` while the stage isn't `app`, opened by a stage effect once it becomes `app`.
- `mobile/android/app/src/main/res/drawable/ic_stat_upcz.xml` — new file, exactly the white-cross vector from the task.
- `mobile/capacitor.config.json` — added `"LocalNotifications": { "smallIcon": "ic_stat_upcz", "iconColor": "#1b2a6b" }` under `plugins`.
- `mobile/src/screens/Pages.jsx` — Settings notifications row: removed the web-`Notification.permission` helper, imports `notificationStatus` from `reminders.js`; `notif` starts `"loading"`, refreshed on mount and on foreground return via `useForegroundRefresh`; exact wording map (`granted` "Allowed", `prompt` "Not asked yet. Tap to allow: …", `denied` "Turned off. …", `web`/`unavailable` "Reminders work in the app on your phone.", `loading` "Checking…"); the row is a `<button>` only when status is `prompt` (tap → `notificationPermission()` then fresh `notificationStatus()`), otherwise a `list-row static` div. Removed the now-unused `isNative` import (lint error).
- `mobile/tests/reminders.test.mjs` — appended the 4 new `reconcileReminders` tests (existing tests untouched).

## Tests added
1. cancels a reminder whose event is gone (same branch).
2. leaves another branch's reminders and extra-less / eventId-less ones untouched.
3. reschedules a changed event exactly once even with two notifications.
4. does nothing when everything matches.

## Tests seen failing first
Yes:

```
$ npm test
# SyntaxError: The requested module '../src/lib/reminders.js' does not provide an export named 'reconcileReminders'
# tests 93
# pass 92
# fail 1
```

After the implementation: `# tests 99 / # pass 99 / # fail 0` (95 before + 4 new).

## Acceptance checks

1. Tests, lint, build clean:

```
$ npm test
# tests 99
# pass 99
# fail 0
$ npm run lint
> eslint .
(no findings)
$ npm run build
✓ built in 320ms
$ npm run build 2>&1 | grep -cE "IMPORT_IS_UNDEFINED|warn"
0
```

2. Off-device status path: `node -e "import('./src/lib/reminders.js').then(m => m.notificationStatus().then(console.log))"` prints `web`, so in a desktop browser Settings → Notifications shows "Reminders work in the app on your phone." and renders the `list-row static` div, not a button (the row is a button only when `notif === "prompt"`). I could not click through a real `npm run dev` browser session here — verified at the function/render-condition level instead.

Mutation check (then undone) — dropped the `branchSlug` comparison in `reconcileReminders`:

```
$ node --test tests/reminders.test.mjs
not ok 5 - reconcileReminders leaves other branches' reminders and extra-less ones alone
# pass 6
# fail 1
--- reverted ---
# tests 7
# pass 7
# fail 0
```

## Always-run checks
From `mobile/` (this task touches only `mobile/`; backend and website untouched, not re-run): `npm test` → 99/99; `npm run lint` → clean; `npm run build` → `✓ built in 320ms`, zero `IMPORT_IS_UNDEFINED`/warning lines.

## Deviations
None beyond the authorised extra item 8 (EventBody reopen sets `remindersOn` from `notificationStatus() === "granted"`), which the owner asked for explicitly. One judgement call inside `reconcileReminders`: a pending notification with our `branchSlug` but no `eventId` is left untouched (it can't be matched to an event); test 2 encodes this.

## Things I could not verify
- **Notification tap and Doze timing need checking on a real phone.** I did not check them: no Android device/emulator here. The listener registration, extra-payload reading, cached-event lookup and held-event handoff are code-reviewed only; `allowWhileIdle: true` is set as specified but its real-world effect under Doze is untested.
- A real desktop-browser click-through of Settings → Notifications (`npm run dev`) — verified at the function level (`notificationStatus()` → `"web"` off-device) and by the render condition, not by clicking in a browser.
