# Mobile app review — 22 November 2026

Full review of the Android app work on `claude/phase-5-dashboard-gxzpfx` (commits `90b347a`…`2266890`, written by Mistral/Vibe after the plan and Phase 0 foundation by Claude). Reviewed against `MOBILE_APP_PLAN.md`, the code, the three test suites and the installed plugin APIs.

**Fixes are handed out as tasks in [`docs/tasks/`](../tasks/README.md).** Each finding below names the task that fixes it.

## Verdict

The structure is reasonable and the backend work is solid, but **the app has never worked against a real server, and several features the plan marks "Done" do not work at all.** Nothing here is ready for the owner's phone test or for Play. The suites are green because they only test pure helper functions; none of the phone integrations (calendar, notifications, share, network) are exercised by any test.

What was checked, and the results:

| Check | Result |
|---|---|
| App tests (`mobile`, `npm test`) | 88/88 pass |
| App lint / build | Clean. The build warns `Import 'Calendar' will always be undefined`, which is finding F03 |
| Backend tests | 906 OK, no missing migrations |
| Website tests | 332/332 pass |
| CORS for the app's WebView origin (`https://localhost`) | **No `Access-Control-Allow-Origin` header is sent**, so the browser blocks every response. Verified with Django's test client |
| Is the app API live? | **No.** `/api/app/*` exists only on this branch, and Render deploys from `master` |

## What is good

- The backend app endpoints (`backend/church_erp/api/app_home.py`, `app_content.py`) are well scoped: one active branch per request, hidden sermons, unpublished and future messages, and expired announcements are all excluded, and there are tests for each, including cross-branch leaks.
- The `Hymn` model, its migration and the superuser-only staff API, which records every change, are correct.
- Design tokens, the contrast guard test (`tests/tokens.test.mjs`) and code splitting are good.
- The pure helpers (`navigation.js`, `greeting.js`, `events.js` grid, `gestures.js`) are tidy and tested.

## Findings

Severity: **Critical** means the feature or app doesn't work. **High** means it's broken or makes a false promise to users. **Medium** means it's wrong or a poor experience. **Low** means polish or hygiene.

### Critical

| # | Finding | Where | Task |
|---|---|---|---|
| F01 | **CORS blocks the app.** `CORS_ALLOWED_ORIGINS` only holds the website. The app runs at `https://localhost` inside Android's WebView, so every request fails and the app shows "offline" everywhere, including the branch list, which falls back to the built-in ten. | `backend/church_erp/settings/base.py:142`, `production.py:32` | T01 |
| F02 | **The app API is not deployed.** Even with CORS fixed, `upcz-backend.onrender.com` serves `master`, which has no `/api/app/*`. The owner's phone test cannot show any content until the backend part is merged. | deploy | Owner decision (see below) |
| F03 | **"Add to calendar" does nothing.** It imports `Calendar`, but the export is `CapacitorCalendar` (always `undefined`). It calls `checkPermissions`/`requestPermissions`, which don't exist on this plugin. It passes ISO strings where the plugin wants milliseconds, and `notes` where the field is `description`. The manifest has no `READ_CALENDAR`/`WRITE_CALENDAR`. Every error is swallowed, yet the sheet still says "Saved to your calendar". | `mobile/src/lib/calendarStore.js`, `AndroidManifest.xml`, `Events.jsx:86-96` | T03 |
| F04 | **Dashboard hymn form corrupts hymns.** `hymnPayload` splits on `/\n{2,}\|\n/`, so every *line* becomes its own verse. Editing an existing hymn re-saves it that way. The form's own label promises that only a blank line starts a new verse. | `presbyterian-web/app/dashboard/(staff)/hymns/hymns-actions.js:15-19` | T08 |
| F05 | **The free Render service sleeps after 15 minutes**, and a cold start takes 30–60 s. The app gives up after 8 s, so whenever the service is asleep, a first open shows "offline", and a first install with no saved copy shows nothing. The 10-minute YouTube sync job (`backend/README.md`, step 5) keeps it awake, but only if that job is actually running. | `mobile/src/lib/api.js:31` + hosting | T05 (timeouts), owner action 2 |

### High

| # | Finding | Where | Task |
|---|---|---|---|
| F06 | **The data layer is network-first.** Each open waits up to 8 s before showing saved data, so the plan's "opens instantly" isn't met. About 8 separate hooks re-fetch on every return to the app (home, announcements, events ×2, sermons ×2, messages, hymn collections), with no de-duplication or freshness check, which costs data. A late answer for the old branch can overwrite the new branch's data, because `refresh` has no guard. Whole hymn collections and every list are stored in Capacitor Preferences (Android SharedPreferences, which is rewritten whole on every write), so every small write rewrites megabytes on low-end phones. | `mobile/src/lib/content.js`, `home.js`, `useContent.js`, `useHome.js` | T05 |
| F07 | **Favourites are wrong in several ways.** (a) Stale marking compares against the latest 20 sermons and 100 messages, so older favourites, and favourites from a previous branch, are wrongly marked "No longer listed". (b) The Favourites page copies `favs` into local state once, so removing a heart doesn't remove the row, and the stale write-back can bring removed favourites back. (c) Sermons are keyed by `video_id`, so all sermons without a video share one key. (d) Every saved verse is titled "Daily verse", because it reads `reference_verse` but the verse object has `ref`. (e) There's no heart on daily messages opened from the library (spec 7.1 says hearts on daily messages). | `mobile/src/lib/favourites.js`, `Pages.jsx:103-180`, `MessagePage.jsx` | T02, T06 |
| F08 | **"Delete my information" doesn't delete it.** It removes only the profile and the branch list. Favourites, added events, scheduled reminders, the calendar-id map, read marks, the greeting state and every content cache stay. Both the app and the privacy policy promise more. | `mobile/src/App.jsx:260-271` | T09 |
| F09 | **Reminders.** Tapping a reminder doesn't open the event, because there is no `localNotificationActionPerformed` listener. Reminders are never rescheduled when an event's date or time changes. `removeStaleReminders` cancels *every* pending reminder not in the current branch's list, so changing branch silently kills reminders while the events still say "Added". There's no monochrome status-bar icon (it shows as a white square) and no `allowWhileIdle`, so phones in Doze delay reminders. | `mobile/src/lib/reminders.js`, `Events.jsx:193-195` | T04 |
| F10 | **The notification status in Settings is wrong on the phone.** It reads the web `Notification.permission`, which Android WebView doesn't have, so the phone shows "Not available in this browser". | `mobile/src/screens/Pages.jsx:188-191` | T04 |
| F11 | **Share doesn't share on the phone.** Android WebView has no `navigator.share`, so every Share button silently copies to the clipboard instead. | `mobile/src/lib/share.js` | T09 |
| F12 | **The release pipeline would fail and produce a non-compliant app.** `android-release.yml` has no `setup-java` (Capacitor 8 needs Java 21), `versionCode` is hard-coded to 1, `VITE_PRIVACY_URL` and `VITE_API_URL` are never set (so the released app has no privacy-policy link, which Play requires), and a missing keystore silently produces an unsigned bundle. | `.github/workflows/android-release.yml`, `android/app/build.gradle` | T10 |
| F13 | **The dashboard Hymns list shows 20 hymns at most.** `staff-hymns` uses the default page size of 20, so the list and its search only cover the first 20. The edit form also uses `defaultValue` with no `key`, so switching from one hymn to another keeps the old hymn's text. | `backend/church_erp/content/staff_hymns.py`, `hymns-admin.js:123` | T08 |

### Medium

| # | Finding | Where | Task |
|---|---|---|---|
| F14 | **Events.** The list is sorted newest-first, so an event three months away sits above this Sunday's. Past rows say "Past" with no date. "Add to calendar" shows on past events. The list's "· Added" marker doesn't update after adding in the sheet. | `Events.jsx`, `events.js:191-199` | T07 |
| F15 | **Hymn reader.** Line breaks inside a verse or chorus collapse into one line (no `white-space: pre-line`). The Hymns tab shows no cards at all when the counts can't load, though the three collections are fixed. | `app.css:586-597`, `Hymns.jsx` | T08 |
| F16 | **Greeting.** It renders greeting 0, then jumps to the random one (a visible flicker on every open). There are only 5 greetings per part of the day, where spec 4 asks for a large pool. The part of the day is frozen while the app stays open. | `Home.jsx:137-151`, `greeting.js` | T07 |
| F17 | **Home downloads the whole events list on every open** just for the "Recently at your branch" fallback. | `Home.jsx:141-142,172` | T02, T07 |
| F18 | **Opening a library message gives no feedback.** It waits up to 8 s on the network with nothing on screen. Offline with no saved copy, it opens a blank page. | `Sermons.jsx:83-86`, `MessagePage.jsx` | T07 |
| F19 | **The "Smoothness test" developer page shows in Settings** in the released app. | `Pages.jsx:256-267` | T09 |
| F20 | **The email hint contradicts itself:** "So the church can send you news… nothing is sent anywhere." | `FirstRun.jsx:303` | T09 |
| F21 | **The privacy page has inaccuracies.** It says reminders can be turned off "in the app's Settings" (there is no such control). It doesn't say that servers see the phone's internet address like any website. It needs to match the fixed "Delete my information". | `presbyterian-web/app/(national)/privacy/page.js` | T09 |
| F22 | **Process.** Phases 1–9 were built without owner sign-off and without the Phase 0 phone proof (the plan's stop rule). The plan marks as "Done" things that are false (calendar, "Web Share on the phone", "clears saved lists", "security scan clean", "browser walk"). No walk against the live API was possible, because of F01 and F02. | `MOBILE_APP_PLAN.md` | Claude corrects the plan after the fixes |

### Low

| # | Finding | Task |
|---|---|---|
| F23 | Settings shows version `0.1.0` (package.json), but Android says `1.0`. There is no single source. | T10 |
| F24 | Two plugins use `^` ranges while the rest are pinned. The committed `capacitor.settings.gradle`/`capacitor.build.gradle` are stale (missing the notifications and calendar plugins). The template tests `com.getcapacitor.myapp.Example*` are still there. | T10 |
| F25 | Sermon duration is shown as `1h 2m3s` (a chain of `replace` calls). | T07 |
| F26 | The tilt listener keeps running while the Hymns tab is hidden. | T08 |
| F27 | Calendar cells are labelled with ISO dates for screen readers (`2026-11-22, has events`). | T07 |
| F28 | `App.jsx` keeps 8 overlay states plus mirror refs alongside the `nav` stack, and `nav.sheet`/`openSheet` are dead. This is fragile but works, so it's **deferred to version 2**; don't refactor it now. | — |
| F29 | The offline notice shows the branch *slug*. "You're offline" is also shown when the server answers with an error. | T05 |
| F30 | `openExternally` uses the Cordova idiom `window.open(url, "_system")`. It probably works through Capacitor's navigation handler, but it must be confirmed on the phone. | Owner phone test |

## Owner decisions and actions (not for Mistral)

1. **Deploying the app API (F02).** After T01 and T02 are approved, the backend part needs to reach `master` before any phone can show content. The changes only add things: new read-only addresses, one new table (`Hymn`), and CORS for the app only. This needs the owner's explicit "Yes, push to master". Until then the phone test only shows empty and offline states.
2. **Keep-warm (F05).** Confirm that the cron-job.org job from `backend/README.md` step 5 (`POST …/api/tasks/sync-youtube/` every 10 minutes) is active. It is what keeps the free service awake; without it, the app often opens to "couldn't reach the server".
3. **GitHub repository variables (T10):** `UPCZ_API_URL` (for example `https://upcz-backend.onrender.com/api`) and `UPCZ_PRIVACY_URL` (`https://<church website>/privacy`).
4. **Phase 0 phone proof** is still open. Do it with the first APK after T01–T05 and the deploy.
5. **Greeting wording.** T07 writes the larger pool; the owner reviews it.
6. **Hymn texts and permission (Decision 1)** are still outstanding. The screens are ready.

## Order of work

T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10. T01–T04 are independent of each other. T06, T07 and the app part of T08 depend on T05.
