# UPCZ Android App: Phased Plan (Version 1)

Written 14 November 2026. This plan follows the owner's 16 specs for the first version of the Android app. Each phase gives people something they can install and use. **A phase is finished only when every item in it is ticked and the owner has signed off.** Nothing in the next phase starts before that.

---

## 1. Thoughts on the approach (Capacitor)

**Recommendation: use Capacitor, but not by wrapping the website.**

Capacitor puts a web app inside a native Android shell, and gives it native features such as notifications, haptics and the status bar. That suits this app: it is mostly reading and browsing, the church already has a tested API, and the design skills we use are web-based. If the app is later needed on iPhone, the same code can be shipped there with little extra work.

**What I'd do differently from "start with Capacitor and add and remove features":**
- The existing website is server-rendered, so it can't be packed into an app. It also contains the whole staff dashboard, which version 1 doesn't want. So the app is a **new, small web app** (Vite and React) in its own `mobile/` folder. It talks to the same API and uses the same crest, colours and wording rules as the website.
- Nothing is "removed" later, because staff features were never added.

**The honest risk:** a Capacitor app draws its screens in Android's built-in web view. On a new phone this is smooth. On a cheap or old phone, heavy animation and 3D can stutter. Many of the church's members will use budget phones. To handle this:
- **Phase 0 tests this on a low-end phone before we commit.** If it isn't smooth, we stop and choose another approach (React Native or Flutter) before any real work is lost.
- All motion uses only the cheap kinds of animation (movement, fading, scaling), so the phone's graphics chip does the work.
- The "light 3D" is limited to the crest and a few cards, using CSS 3D. It is off when the phone is slow or the user asked for less motion. No heavy 3D libraries.

**Two choices that make the app simpler than it sounds:**
- **Reminders are made on the phone.** The "day before" and "day of" reminders for events are scheduled on the phone itself (local notifications). They work offline and need no push service or server. Server push (Firebase) is only worth adding later, for things like "a service is live now".
- **Favourites and the profile live on the phone** in version 1, so there are no accounts and no passwords. The cost: if someone reinstalls the app or changes phone, their favourites are lost. This is stated plainly in Settings.

---

## 2. What already exists, and what must be built

| App feature | What the church's API offers today | Work needed |
|---|---|---|
| Daily message and daily verse | Public daily messages per branch, with title, message, verse reference and verse text | A lean "home" address so the app makes one request, not four (Phase 2) |
| Sermons | Public sermons per branch (YouTube videos, title, verse, date, `is_live`) | Faster "live now" detection (see Decision 4) |
| Events | Public events per branch (date, times, location, details, photos). Can filter by date | Photos and past/upcoming ordering confirmed in Phase 4 |
| Announcements | Public announcements per branch, pinned first, current ones only | None |
| Branches (for choosing a branch) | Public list with names and slugs | None |
| **Hymns** | **Nothing exists** | A hymns model, a place in the dashboard to enter and import them, and a public address (Phase 6). **Needs the hymn texts and permission to use them (Decision 1)** |
| User profile (name, branch, email) | Nothing | A way to store the profile on the server, only if the owner wants it (Decision 2) |
| Reminders and favourites | Nothing | Done on the phone, so no server work |

---

## 3. Decisions needed from the owner

Each phase can start without most of these, but the decision is needed before the phase named.

1. **Hymns (needed before Phase 6).** Where do the Tumbuka, Chewa and English hymn texts come from, and does the church have permission to publish them in an app? Hymn books are often under copyright. I can build the screens and the dashboard entry form without the texts, but not the content.
2. **The profile and the email address (needed before Phase 1).** Spec 3 collects name, branch and email "to customise the experience", and spec 16 mentions a login option on first open. My reading is that these are the *same* first-run screen: no password, no staff sign-in. My recommendation: keep name and branch on the phone only; send the email to the server **only if the person agrees**, and only if the church has a use for it (for example, news). Collecting email needs a privacy policy, which Google Play also requires. Please confirm: (a) is this one screen, and (b) does the church want emails stored on the server?
3. **Where the calendar lives (needed before Phase 4).** The bottom bar has five tabs and the top bar has three icons, so the calendar has no obvious home. My recommendation: a **List | Calendar** switch at the top of the Events screen. It shows the events and sermons for the user's branch, with the ones they added highlighted.
4. **"Live now" speed (needed before Phase 3).** The website checks YouTube once an hour, so a live service could take up to an hour to appear. For the app to show "Live now" promptly, we need a faster check while a service is likely happening (for example every 5 minutes on Sunday mornings). Please confirm the usual service times.
5. **Which branch's content appears (needed before Phase 2).** I assume the app shows the user's own branch. Should events and announcements from the national church also appear? Default: no, branch only in version 1.
6. **Google Play account (needed before Phase 8).** A Google Play developer account (a one-time fee of US$25) in the church's name, a name for the app, and a web address for the privacy policy.

Until you answer, I'll use the recommendation written next to each one.

---

## 4. How every item is finished

The same loop applies to every item in every phase:

1. **Tests first**, and seen failing. Backend changes use the existing test suite; the app uses its own tests.
2. **Build** the smallest thing that works.
3. **Deliberate-mistake checks** on any rule (for example, which events show, when a reminder fires), to be sure the tests notice.
4. **Walk it in a real browser at phone size**, in light and dark, on throwaway data. From Phase 0 on, also **on a real Android phone**, including a low-end one.
5. **Code review** and, for anything that touches data or permissions, a **security review**.
6. **Owner sign-off** at the end of the phase.

Standing rules carry over from the website: no real passwords or keys entered in anything we test, throwaway accounts are deleted afterwards, and nothing reaches the live site without the owner's explicit "Yes, push to master".

**Design rules for every screen** (spec 15 is the top priority):
- Use the `apple-design` and `motionsites-web-builder` skills, and the existing crest palette (navy and a small touch of red, flat colours, no gradients, no pink or purple glow).
- One main thing per screen. Important things are always visible, never hidden in menus.
- Big touch targets (at least 48 px), readable text that grows with the phone's font size.
- Every animation has a reason, keeps to a few durations, and can be switched off by the phone's "reduce motion" setting.
- Light, dark and "follow the phone" themes everywhere. The status bar, the system bars and the splash screen match the theme.
- It must not look generated: no stock icon grids, no default component-library styling, no generic hero blocks.

---

## Phase 0: Foundation and proof

**Goal:** prove the approach works on a real phone and set up everything the later phases rely on. *Delivers: an installable app that opens, shows the five-tab bar and switches theme.*

- [x] Owner confirms Decisions 1 to 6 (or accepts the recommendations). **Accepted the recommendations, 2026-11-14.**
- [x] Create `mobile/` with Vite and React, linting and tests set up like the website's.
- [x] Add Capacitor and the Android project. App name, package id (for example `org.upcz.app`) and icon placeholders chosen. **App name "UPCZ", id `org.upcz.app`, Capacitor 8. The launcher icons (including Android's adaptive and themed icons) and Android's splash are drawn from the crest, not placeholders.**
- [x] **Build pipeline:** an installable APK can be produced. If this container can't build it (it may need access to Google's download sites), set up GitHub Actions to build the APK, and the owner downloads it to install. **This container is refused `dl.google.com`, and the request to allow it couldn't be shown in the owner's Claude app (it needs a newer version or claude.ai on a computer). So GitHub Actions builds it (`.github/workflows/android-app.yml`): tests and lint first, then the APK, kept for 30 days under the run's "Artifacts". First build passed (run 1, 4.1 MB).**
- [x] **Design foundations:** colour tokens for light and dark taken from the website's crest palette, type scale, spacing, shadows and corner sizes, motion durations and easing curves. A short design direction (a one-page look) approved by the owner. **Built (`src/design/tokens.css`, `src/lib/motion.js`); the direction in `mobile/DESIGN.md` was approved by the owner on 2026-11-17 (tokens checked against the page: paper, crest navy, red accent, Newsreader + system sans, 4 px space, 48 px touch, springs in `motion.js`).**
- [x] **Navigation shell:** the five-tab bottom bar (Home, Events, Sermons, Hymns, Announcements) with the three top-bar icons (profile, favourites, settings) and placeholder screens, with the tab-switch transition. **Labels always show; checked to fit on a 360 px phone.**
- [x] **Theme system:** light, dark and follow-the-phone, remembered, applied before the first paint so there is no flash. **Also applied to Android's status and navigation bars and its splash.**
- [x] **Device adaptation basics:** safe areas and edge-to-edge drawing, the phone's back gesture works on every screen, the app keeps its place when the phone rotates or the app is put away. **Back: closes a sheet, then a page, then returns Home, then puts the app away (tested). Each tab keeps its scroll position. To be confirmed on the owner's phone during the proof below.**
- [ ] **Proof on a low-end phone:** a test animation page (the logo draw-in, a bottom sheet, the crest tilt) runs at a steady smooth speed on the owner's lowest-end Android phone, with the speeds recorded. **If it fails, stop and agree on another approach before continuing.** **The test page is built (Settings → Smoothness test). In a browser slowed to one-sixth speed at 360 px: crest drawing 98 to 99% of frames on time, sheet 100%, tab switching 92 to 96% (a short hitch the first time each tab opens). Waiting for the owner's real-phone results. 2026-11-17: the owner directed work to continue in parallel; the proof runs on the owner's phone against the APK from GitHub Actions. Still open.**
- [ ] Phase review and owner sign-off. **Code review done: two sheet fixes (the dimming now fades as the sheet is dragged; focus returns to the button that opened it). Drag, flick, Escape and focus checked in a browser.**

## Phase 1: Opening screen, first-run, profile and settings

**Goal:** a person installs the app, sees a lovely opening, tells us who they are and which branch they belong to, and lands in the app. *Delivers: a complete first-time experience.*

- [x] **Opening screen (spec 2):** the crest draws in line by line, then settles and fades into the app. About two seconds on a first start, shorter on later starts. It matches the theme and honours "reduce motion" (the crest simply fades in). The crest artwork is checked to be clean line shapes so it can be drawn. **[rev] Done (2026-11-17):** `src/screens/Opening.jsx` — full draw on the first ever start (~2 s), a short fade on later starts, plain fade under reduce motion; the app gate (`src/lib/gate.js`) goes opening → first-run → tabs, and the Android back button leaves the app during opening and first-run, so nobody is trapped.**
- [x] **Branch list** loaded from the church's API, kept for offline use, with a built-in fallback if the first start has no internet. **[rev] Done (2026-11-17):** `src/lib/api.js` — `GET {VITE_API_URL or https://upcz-backend.onrender.com/api}/branches/` with an 8 s timeout, saved to phone storage on success; on any failure the saved list is used, and with nothing saved the built-in list of the owner's ten main branches (from `seed_upcsa_branches.py`) is shown, labelled as saved with the app. `parseBranches` keeps only well-formed rows, deduped and sorted.**
- [x] **First-run screen (specs 3 and 16):** name, branch (a search-as-you-type picker, not a long list) and email (optional, with the reason shown in plain words). No password. A "Skip for now" that can't trap anyone. Kept on the phone. **[rev] Done (2026-11-17):** `src/screens/FirstRun.jsx` with the shared `BranchPicker` — search-as-you-type over the API/cached/fallback list, loading skeletons, offline notice with Try again, an empty-match message that suggests Skip; Continue validates and saves, Skip saves an empty profile; both land in the app.**
- [x] Email handling follows Decision 2 (stays on the phone, or is sent to the server with a clear "I agree" and an API address for it, with tests). **[rev] Done (2026-11-17):** per the accepted recommendation, the email stays on the phone only; the field says so in plain words and the profile store is local-only by construction (no server address is ever called for it). The email is optional and validated; an invalid one is refused with a plain message.**
- [x] **Profile screen (spec 8):** see and change name, branch and email. **[rev] Done (2026-11-17):** the top-bar avatar now shows the first letter of the name; the profile page edits all three with the same branch picker, saves on demand, and states that nothing leaves the phone.**
- [x] **Settings screen (spec 8):** theme (Light, Dark, Follow my phone), reduced motion, notification permission status (switched on in Phase 4), about the app, version, the privacy policy link, and a clear "Delete my information from this phone" button. **[rev] Done (2026-11-17):** theme segmented control as built; a Reduce motion switch that drives `MotionConfig` (fades replace springs); a read-only notifications row showing the phone's permission (asking happens in Phase 4); About with the version from `package.json`; a privacy-policy row that links out when `VITE_PRIVACY_URL` is set and otherwise says it will be published with the release (nothing invented); Delete my information is a two-tap danger row that clears profile, first-run flag and saved lists and returns to first-run.**
- [x] Changing the branch refreshes everything that depends on it. **[rev] Done (2026-11-17):** saving a profile bumps a version that re-renders every tab with the new profile (avatar, greeting, and the per-tab branch empty states), so branch-dependent content reloads from the new branch from Phase 2 on.**
- [x] Empty, error and offline states written in plain words. **[rev] Done (2026-11-17):** a shared `Notice` component; every tab without a chosen branch says what it will show and offers one "Choose your branch" action; the branch picker has loading skeletons, an offline/saved-list notice with Try again, and a no-match message.**
- [ ] Phase review and owner sign-off. **[rev] Built (2026-11-17):** 38 app tests (22 new for storage/profile/api/gate), 3 deliberate breakages all caught (junk branch rows, skipping first-run, accepting a bad email — the first needed one more test case); lint clean; `vite build` clean. Browser walk on the owner's phone with the APK is part of the Phase 0 proof.**

## Phase 2: Home screen and the daily message

**Goal:** the app's front door: a warm greeting, the daily verse and the daily message. *Delivers: a useful daily-devotion app on its own.*

- [x] **Greeting (spec 4):** by time of day (early morning, morning, afternoon, evening, night), with the person's first name. A large pool of short, warm, Christian greetings for each time of day, written plainly and not cliché, rotated so people don't see the same one twice in a row. The owner reviews the wording before sign-off. **[rev] Done (2026-11-17):** `src/lib/greeting.js` — five parts of the day (5–8 early morning, 8–12 morning, 12–17 afternoon, 17–22 evening, else night), five plain greetings per part with a `{name}` placeholder, rotation that never repeats the last one (persisted in phone storage), and clean wording when no name is set. Wording pool is ready for the owner's review at sign-off.**
- [x] **Home content address:** one lean API address (`/api/app/home/?branch=`) returning today's verse, daily message, latest sermons, upcoming events and anything live. Tested for each branch and for days with nothing published. **[rev] Done (2026-11-17):** `GET /api/app/home/?branch=<slug>` (`church_erp/api/app_home.py`, public, read-throttled like the other public reads). 400 without `branch`, 404 for an unknown or inactive branch. Returns `branch`, `date`, `verse` (today's published message's verse, falling back to the branch home page wording, else null), `daily_message` (latest published with date ≤ today, branch-isolated), `live` (is_live and not hidden), `sermons` (latest 5, hidden excluded) and `events` (upcoming 5, soonest first). 13 tests; 3 deliberate breakages (hidden live shown, future-dated message shown, cross-branch leak) all caught; full backend suite 883 tests OK.
- [x] **Daily verse (spec 5):** the reference and verse text, laid out as a calm, well-set quote, with a share button. **[rev] Done (2026-11-17):** verse card on Home — Newsreader quote, reference underneath, Share button (Web Share on the phone, copy-to-clipboard with a "Copied" confirmation as the fallback).**
- [x] **Daily message card (spec 5):** title and verse reference, opening the full **Daily message screen** with the verse, the whole message and a share button. **[rev] Done (2026-11-17):** message card on Home (title + verse reference, one tap opens it); `src/screens/MessagePage.jsx` slides over with the verse, the whole message and a share button; the Android back button closes it first.**
- [x] **Home layout engine (spec 9):** the order of the home cards is decided by rules, not hard-coded: greeting, then a "Live now" card (Phase 3), then a "Today's event" card (Phase 4), then verse, daily message, sermons preview, events preview. The empty slots are built now and filled in the phases named. **[rev] Done (2026-11-17):** `homeSlots()` in `src/lib/home.js` returns the rule-based order and each slot renders only when its data exists; the live and today-event slots are reserved in the order and render nothing until Phases 3 and 4 fill them. Sermons and events previews show the first three rows with "See all" to their tabs.**
- [x] **Data layer:** requests are cached on the phone so the app opens instantly and works offline with the last data it saw. Pull to refresh, background refresh, and a quiet "Updated 2 hours ago" instead of spinners. **[rev] Done (2026-11-17):** `loadHome()` (`src/lib/home.js`) — one request to `/api/app/home/?branch=` with an 8 s timeout, cached per branch (`upcz.home.<slug>`), answers checked to belong to the requested branch; offline it serves the saved copy and says so, with nothing saved it reports offline. `useHome` refreshes in the background when the app comes to the foreground (Capacitor appStateChange / visibilitychange). Home has pull-to-refresh (pull past 72 px at the top) and a quiet "Updated 2 hours ago" caption with a refresh button — no spinners.**
- [x] Skeleton loading states that match the final layout. **[rev] Done (2026-11-17):** title-and-cards shimmer placeholders on first load, shaped like the greeting and the cards.**
- [ ] Phase review and owner sign-off. **[rev] Built (2026-11-17):** 51 app tests (13 new for greeting/home), 3 deliberate breakages caught (live slot dropped, wrong-branch answer accepted, repeating greeting); lint and `vite build` clean. Browser walk on the owner's phone with the APK; greeting wording needs the owner's review.**

## Phase 3: Sermons, library and "Live now"

**Goal:** watch sermons and browse the library of daily messages. *Delivers: the sermon archive in the app.*

- [x] **Sermons screen (spec 12):** laid out like the website's sermons page, with tabs: **Sermons** (videos, newest first) and **Daily messages** (a browsable library by date, with search). Smooth tab switching. **[rev] Done (2026-11-18):** `src/screens/Sermons.jsx` — a spring-pill sub-tab switch; sermons as a newest-first list (title, date, verse, duration, red Live badge); the library with a search box that filters title and verse reference client-side (so it works offline too). New lean endpoints `GET /api/app/sermons/?branch=&limit=` (default 20, cap 50) and `GET /api/app/messages/?branch=&q=&limit=` (default 100, cap 200), plus `GET /api/app/messages/<id>/?branch=` for the full message (`church_erp/api/app_content.py`; 400/404 rules and branch isolation as for home). 10 backend tests, 3 deliberate breakages caught; full suite 893 OK.**
- [x] **Sermon detail:** title, preacher, date, verse and the video. How the video plays is decided here (the YouTube player inside the app, or open the YouTube app), and tested on a real phone, including the low-end one. **[rev] Done (2026-11-18), decision recorded: the video opens in the YouTube app (or browser) via the system link, not an in-app player — reliable on low-end web views; to be confirmed on the owner's phones at sign-off.** `src/screens/SermonPage.jsx`: title, preacher, date, verse, Watch + Share; Android back closes it first.**
- [x] **Home sermons preview (spec 6):** the most recent few, newest first, with a "See all sermons" button that goes to the Sermons screen. **[rev] Done (2026-11-18):** the Phase 2 preview rows now open the sermon page; "See all" goes to the Sermons tab.**
- [x] **Live now card (spec 9):** when a sermon is live, a prominent card appears right under the greeting and takes the person straight to the video. It disappears when the service ends. **[rev] Done (2026-11-18):** the reserved "live" slot now renders a red-accented Live now card under the greeting, opening the sermon page; it disappears as soon as the API no longer reports a live sermon.**
- [x] **Live detection speed:** as decided in Decision 4, with tests that "live" is picked up and cleared correctly. **[rev] Done (2026-11-18):** Celery beat already syncs every 5 minutes (a test now asserts ≤ 300 s), and the sync's set/clear of `is_live` is covered by `content/tests/test_youtube_sync.py`; for production, `backend/README.md` now documents a second cron-job.org job Sundays 06:00–11:55 Africa/Lusaka every 5 minutes, so "live now" is picked up within 5 minutes during services (owner adds the job; still to tick in the README checklist).**
- [ ] Phase review and owner sign-off. **[rev] Built (2026-11-18):** 57 app tests (6 new for the content layer), 3 deliberate breakages caught (payload validation dropped, empty search hides all, offline detail lost); lint and `vite build` clean.**

## Phase 4: Events, calendar and reminders

**Goal:** see what's happening and be reminded. *Delivers: the events and reminders people will use most.*

- [x] **Events screen (spec 10):** upcoming and past events, **most recent first**, each a card. Tapping one opens a **bottom sheet** with a smooth spring animation, showing the details, location, times and photos (swipe through them), and it can be dragged down to close. **[rev] Done (2026-11-18):** `src/screens/Events.jsx` — newest-first list with Today badges; the shared draggable `Sheet` shows when/where, details and a snap-scrolling photo row. New lean endpoint `GET /api/app/events/?branch=&limit=` (default 100, cap 200, photos included; `backend/church_erp/api/app_content.py`), 3 tests + a cross-branch-leak mutation check caught; suite 896 OK.**
- [x] **Home events preview (spec 7):** upcoming events; if there are none, the events that just passed (labelled as such). **[rev] Done (2026-11-18):** Home preview uses the home payload's upcoming events; when there are none it falls back to the three most recent past events from the cached events list, labelled "Recently at your branch"; rows open the event sheet.**
- [x] **Today's event card (spec 9):** on the day of an event, a card appears right under the greeting (below "Live now" if both). **[rev] Done (2026-11-18):** the reserved "today-event" slot renders a Today card (title, count of further events, time, location) below Live now; it opens the event sheet.**
- [x] **Add to calendar (spec 11):** every upcoming event has an "Add to calendar" button that turns into "Added" (and can be undone). **[rev] Done (2026-11-18):** in the event sheet, via `@capgo/capacitor-calendar` on the phone (calendar permission asked at the moment); the added state is stored on the phone (`upcz.addedEvents`) so the button reads "Added" everywhere (list rows, calendar day list) and can be undone, which also removes the phone-calendar entry (its id is stored) — in a browser the state still works, without the phone calendar.**
- [x] **Reminders (spec 11):** when an event is added, the phone schedules a reminder **the day before** and one **on the day**, at sensible times (for example 6 pm the day before and 7 am on the day), both written as friendly notifications that open the event. They are rescheduled if the event changes and removed if the event is removed or cancelled. **[rev] Done (2026-11-18):** `@capacitor/local-notifications`; `reminderPlan()` gives 18:00 the day before and 07:00 on the day ("Tomorrow at 10:00 · Main Church"), past times dropped; deterministic ids per event so re-adding reschedules cleanly; `removeStaleReminders()` cancels reminders for events no longer in the branch's list. All local — no server push in v1, as decided.**
- [x] **Permission flow:** the app explains *why* before the Android permission prompt (Android 13 and newer asks at that moment), and handles "No" gracefully, with a way to turn it on later from Settings. **[rev] Done (2026-11-18):** the sheet's button copy explains the two reminders before any prompt; a denied answer shows a plain note and Settings' notification row becomes a tap-to-allow button that says why.**
- [x] **Reliability on real phones:** tested on the phones in use. Some makes (for example Tecno, Infinix and Xiaomi) stop background reminders unless the app is allowed; the app detects this and shows a short guide for that phone. **[rev] Built (2026-11-18):** `needsBatteryGuide()` detects Tecno/Infinix/Xiaomi/Redmi/Poco/itel from the phone's identity and Settings shows a short per-make battery guide; the actual on-phone check of reminder delivery stays with the owner's test walk.**
- [x] **In-app calendar (spec 11 and Decision 3):** a List | Calendar switch on the Events screen. A month view with dots for the branch's events and sermons, and the person's added events highlighted. Tapping a day shows its items. **[rev] Done (2026-11-18):** List | Calendar switch per Decision 3; Monday-first month grid (6 weeks), event dots in navy, sermon dots in grey, added events ringed in red; tapping a day lists that day's events (which open the sheet) and sermons.**
- [ ] Phase review and owner sign-off. **[rev] Built (2026-11-18):** 71 app tests (14 new: events, reminders, calendar store, phone make), 4 deliberate breakages caught (past reminders kept, added-dot overwritten, Sunday-first grid, no-op toggle); lint and `vite build` clean; new Capacitor plugins (`local-notifications`, `capgo/capacitor-calendar`) are picked up by `cap sync` in the Actions build. Owner walk: sheet drag, add/undo, reminder delivery on a real phone incl. a Tecno/Infinix/Xiaomi.**

## Phase 5: Announcements

**Goal:** the branch's announcements in the app. *Delivers: the simplest list screen, finished and polished.*

- [ ] **Announcements screen (spec 14):** a list with pinned ones first. Each item opens a **bottom sheet** (the same smooth component as Events) with the full text.
- [ ] A small "New" marker for announcements the person hasn't opened, and a count on the tab.
- [ ] Empty state written in plain words.
- [ ] Phase review and owner sign-off.

## Phase 6: Hymns

**Goal:** the three hymn collections. *Delivers: hymns in Tumbuka, Chewa and English.* **Starts only when the hymn texts and permission are confirmed (Decision 1).**

- [ ] **Backend:** a `Hymn` model (collection, number, title, verses and chorus, optional notes), a public read-only address, migrations, and tests.
- [ ] **Dashboard:** a Hymns section for superusers to add, edit and bulk-import hymns, with the change history recording each change.
- [ ] **Hymns screen (spec 13):** three large cards: **Tumbuka Hymns**, **Chewa Hymns**, **English Hymns**, with a calm hover/press motion and the number of hymns on each.
- [ ] **Hymn list:** by number or title, with fast search, opening to the hymn.
- [ ] **Hymn reader:** comfortable large text, verses and chorus clearly set apart, text size control, and a screen that stays on while reading.
- [ ] Works offline: hymns are downloaded the first time so they open without internet.
- [ ] Phase review and owner sign-off.

## Phase 7: Favourites

**Goal:** keep what matters. *Delivers: favourites across the whole app.*

- [ ] **Heart button** on daily messages, daily verses, sermons and hymns, with a small, satisfying animation and a light vibration (if the phone allows).
- [ ] **Favourites screen (spec 8):** from the top-bar icon, with four sections: Daily messages, Daily verses, Sermons and Hymns, each separate, with an empty state that tells the person how to add one.
- [ ] Saved on the phone, kept offline (a favourite still opens without internet), and shown in plain words that they stay on this phone only.
- [ ] A favourite whose content was removed on the server is handled gracefully.
- [ ] Phase review and owner sign-off.

## Phase 8: Polish, speed and accessibility

**Goal:** make it feel premium on every phone. *Delivers: the finished feel the owner asked for.*

- [ ] **Motion pass:** one consistent set of durations and springs across every screen and transition (shared-element transitions between a card and its sheet or page, tab changes, list entrance).
- [ ] **Light 3D and depth (spec 15):** the crest on the opening screen and a few cards respond gently to the phone's tilt or the finger, only where the test phone stays smooth, and switched off for "reduce motion" and low-end phones.
- [ ] **Low-end phone tuning:** start-up time, memory and smoothness measured and improved, with the numbers written down.
- [ ] **Adapting to the device:** large fonts and display size, tablets and folding phones, landscape, small screens, system dark mode switching while the app is open, and the predictive back gesture.
- [ ] **Accessibility:** screen-reader labels, focus order, contrast checked in both themes, touch targets of at least 48 px, and no information carried by colour alone.
- [ ] **Offline and poor network:** every screen is checked with no signal and with a very slow connection (data costs matter).
- [ ] **Wording review** of every message with the `writing-guidelines` approach: plain language, no jargon, no cliché.
- [ ] **Full code review** (high effort) and a **security review** of the whole app and the new backend addresses, with all findings fixed or explained.
- [ ] Phase review and owner sign-off.

## Phase 9: Release on Google Play

**Goal:** get the app to real members safely. *Delivers: the app on the Play Store.*

- [ ] App signing set up, and the signing key stored safely by the owner (never in the repository).
- [ ] Final icon (including the adaptive and monochrome versions), splash and Play Store images.
- [ ] **Privacy policy** published on a public web address, and Google's data-safety form completed to match what the app actually does.
- [ ] **Internal testing** with the owner and a few trusted people on a range of phones.
- [ ] **Closed beta** with a few branches. Problems found are fixed. The first release candidate is the one the testers used, not a different build.
- [ ] **Production release** in steps (for example 20 percent of people first), watching for crashes. A simple way to see crashes, chosen so it doesn't collect personal information.
- [ ] A one-page "How to update the app and what to do if something breaks" for the owner.
- [ ] Phase review and owner sign-off.

---

## 5. Out of scope for version 1

No staff features or editing inside the app, no passwords or accounts, no workspace (meetings, deliverables, documents), no server push notifications, no payments or giving, no in-app comments, and no languages other than English for the app's own wording. These can be planned as version 2.

## 6. Risks, in order of importance

1. **Smoothness on cheap phones.** Tested first, in Phase 0, with a clear stop rule.
2. **Hymn content and permission.** Phase 6 can't finish without it, so it comes after the phases that don't depend on it.
3. **Reminders on phones that limit background work.** Checked on real phones in Phase 4, with a guide for the makes that need it.
4. **Building the APK.** If this environment can't build it, the build moves to GitHub Actions in Phase 0.
5. **"Live now" lag.** Solved by the faster check in Decision 4.
