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
- [ ] **Design foundations:** colour tokens for light and dark taken from the website's crest palette, type scale, spacing, shadows and corner sizes, motion durations and easing curves. A short design direction (a one-page look) approved by the owner. **Built (`src/design/tokens.css`, `src/lib/motion.js`); the direction is in `mobile/DESIGN.md`, waiting for the owner's approval.**
- [x] **Navigation shell:** the five-tab bottom bar (Home, Events, Sermons, Hymns, Announcements) with the three top-bar icons (profile, favourites, settings) and placeholder screens, with the tab-switch transition. **Labels always show; checked to fit on a 360 px phone.**
- [x] **Theme system:** light, dark and follow-the-phone, remembered, applied before the first paint so there is no flash. **Also applied to Android's status and navigation bars and its splash.**
- [x] **Device adaptation basics:** safe areas and edge-to-edge drawing, the phone's back gesture works on every screen, the app keeps its place when the phone rotates or the app is put away. **Back: closes a sheet, then a page, then returns Home, then puts the app away (tested). Each tab keeps its scroll position. To be confirmed on the owner's phone during the proof below.**
- [ ] **Proof on a low-end phone:** a test animation page (the logo draw-in, a bottom sheet, the crest tilt) runs at a steady smooth speed on the owner's lowest-end Android phone, with the speeds recorded. **If it fails, stop and agree on another approach before continuing.** **The test page is built (Settings → Smoothness test). In a browser slowed to one-sixth speed at 360 px: crest drawing 98 to 99% of frames on time, sheet 100%, tab switching 92 to 96% (a short hitch the first time each tab opens). Waiting for the owner's real-phone results.**
- [ ] Phase review and owner sign-off. **Code review done: two sheet fixes (the dimming now fades as the sheet is dragged; focus returns to the button that opened it). Drag, flick, Escape and focus checked in a browser.**

## Phase 1: Opening screen, first-run, profile and settings

**Goal:** a person installs the app, sees a lovely opening, tells us who they are and which branch they belong to, and lands in the app. *Delivers: a complete first-time experience.*

- [ ] **Opening screen (spec 2):** the crest draws in line by line, then settles and fades into the app. About two seconds on a first start, shorter on later starts. It matches the theme and honours "reduce motion" (the crest simply fades in). The crest artwork is checked to be clean line shapes so it can be drawn.
- [ ] **Branch list** loaded from the church's API, kept for offline use, with a built-in fallback if the first start has no internet.
- [ ] **First-run screen (specs 3 and 16):** name, branch (a search-as-you-type picker, not a long list) and email (optional, with the reason shown in plain words). No password. A "Skip for now" that can't trap anyone. Kept on the phone.
- [ ] Email handling follows Decision 2 (stays on the phone, or is sent to the server with a clear "I agree" and an API address for it, with tests).
- [ ] **Profile screen (spec 8):** see and change name, branch and email.
- [ ] **Settings screen (spec 8):** theme (Light, Dark, Follow my phone), reduced motion, notification permission status (switched on in Phase 4), about the app, version, the privacy policy link, and a clear "Delete my information from this phone" button.
- [ ] Changing the branch refreshes everything that depends on it.
- [ ] Empty, error and offline states written in plain words.
- [ ] Phase review and owner sign-off.

## Phase 2: Home screen and the daily message

**Goal:** the app's front door: a warm greeting, the daily verse and the daily message. *Delivers: a useful daily-devotion app on its own.*

- [ ] **Greeting (spec 4):** by time of day (early morning, morning, afternoon, evening, night), with the person's first name. A large pool of short, warm, Christian greetings for each time of day, written plainly and not cliché, rotated so people don't see the same one twice in a row. The owner reviews the wording before sign-off.
- [ ] **Home content address:** one lean API address (`/api/app/home/?branch=`) returning today's verse, daily message, latest sermons, upcoming events and anything live. Tested for each branch and for days with nothing published.
- [ ] **Daily verse (spec 5):** the reference and verse text, laid out as a calm, well-set quote, with a share button.
- [ ] **Daily message card (spec 5):** title and verse reference, opening the full **Daily message screen** with the verse, the whole message and a share button.
- [ ] **Home layout engine (spec 9):** the order of the home cards is decided by rules, not hard-coded: greeting, then a "Live now" card (Phase 3), then a "Today's event" card (Phase 4), then verse, daily message, sermons preview, events preview. The empty slots are built now and filled in the phases named.
- [ ] **Data layer:** requests are cached on the phone so the app opens instantly and works offline with the last data it saw. Pull to refresh, background refresh, and a quiet "Updated 2 hours ago" instead of spinners.
- [ ] Skeleton loading states that match the final layout.
- [ ] Phase review and owner sign-off.

## Phase 3: Sermons, library and "Live now"

**Goal:** watch sermons and browse the library of daily messages. *Delivers: the sermon archive in the app.*

- [ ] **Sermons screen (spec 12):** laid out like the website's sermons page, with tabs: **Sermons** (videos, newest first) and **Daily messages** (a browsable library by date, with search). Smooth tab switching.
- [ ] **Sermon detail:** title, preacher, date, verse and the video. How the video plays is decided here (the YouTube player inside the app, or open the YouTube app), and tested on a real phone, including the low-end one.
- [ ] **Home sermons preview (spec 6):** the most recent few, newest first, with a "See all sermons" button that goes to the Sermons screen.
- [ ] **Live now card (spec 9):** when a sermon is live, a prominent card appears right under the greeting and takes the person straight to the video. It disappears when the service ends.
- [ ] **Live detection speed:** as decided in Decision 4, with tests that "live" is picked up and cleared correctly.
- [ ] Phase review and owner sign-off.

## Phase 4: Events, calendar and reminders

**Goal:** see what's happening and be reminded. *Delivers: the events and reminders people will use most.*

- [ ] **Events screen (spec 10):** upcoming and past events, **most recent first**, each a card. Tapping one opens a **bottom sheet** with a smooth spring animation, showing the details, location, times and photos (swipe through them), and it can be dragged down to close.
- [ ] **Home events preview (spec 7):** upcoming events; if there are none, the events that just passed (labelled as such).
- [ ] **Today's event card (spec 9):** on the day of an event, a card appears right under the greeting (below "Live now" if both).
- [ ] **Add to calendar (spec 11):** every upcoming event has an "Add to calendar" button that turns into "Added" (and can be undone).
- [ ] **Reminders (spec 11):** when an event is added, the phone schedules a reminder **the day before** and one **on the day**, at sensible times (for example 6 pm the day before and 7 am on the day), both written as friendly notifications that open the event. They are rescheduled if the event changes and removed if the event is removed or cancelled.
- [ ] **Permission flow:** the app explains *why* before the Android permission prompt (Android 13 and newer asks at that moment), and handles "No" gracefully, with a way to turn it on later from Settings.
- [ ] **Reliability on real phones:** tested on the phones in use. Some makes (for example Tecno, Infinix and Xiaomi) stop background reminders unless the app is allowed; the app detects this and shows a short guide for that phone.
- [ ] **In-app calendar (spec 11 and Decision 3):** a List | Calendar switch on the Events screen. A month view with dots for the branch's events and sermons, and the person's added events highlighted. Tapping a day shows its items.
- [ ] Phase review and owner sign-off.

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
