# T09 — Share, "Delete my information", Settings and the privacy page

**Fixes:** F08, F11 (High), F19, F20, F21, plus the owner's no-em-dash rule · **Area:** app + website · **Branch:** `task/T09` · **Depends on:** T04, T05 (and T06/T07 if they're merged first; re-read `App.jsx` before you start)

## Decisions (don't change them)

1. **Share** uses `@capacitor/share@8.0.3` on the phone (Android WebView has no `navigator.share`). The browser keeps today's Web Share → clipboard fallback.
2. **"Delete my information"** removes everything the app saved about the person: profile, first-run flag, branch list, greeting memory, favourites, added events, the calendar-id map (`upcz.cal.*`), read marks, every saved content copy (`blobs.clear()` plus the store's memory) and **all scheduled reminders**. It keeps the theme, "reduce motion", text size and "seen opening" (preferences, not personal). It does **not** delete events the person put in their phone's own calendar, and the wording says so.
3. **The Smoothness test** shows only when `import.meta.env.DEV` or `import.meta.env.VITE_SHOW_TEST_TOOLS === "1"`. The debug APK will set that variable (T10); the Play build won't.
4. **No em dashes (—)** in any user-facing text, in the app or on the privacy page (owner's rule, 2026-11-08). Use a full stop, a comma or a colon instead.

## Changes

### 1. Share: `mobile/src/lib/share.js`

`npm install --save-exact @capacitor/share@8.0.3`

```js
export async function shareText({ title, text }, { native = isNative(), plugin = Share } = {}) {
  if (native) {
    try { await plugin.share({ title, text, dialogTitle: "Share" }); return "shared"; }
    catch (error) { return /cancel/i.test(String(error?.message)) ? "cancelled" : "failed"; }
  }
  // …the existing navigator.share → clipboard code, unchanged
}
```
- `SermonPage.jsx` and `MessagePage.jsx`: keep the result, and show "Shared" or "Copied" to match it (today it always says "Copied").
- `tests/share.test.mjs` (new): native success → `"shared"`; native cancel (`new Error("Share canceled")`) → `"cancelled"`; native other error → `"failed"`; non-native with no `navigator` → `"failed"`.

### 2. Wipe: new `mobile/src/lib/wipe.js`

```js
// Keys kept on purpose: preferences, not personal information.
export const KEEP_KEYS = ["upcz.theme", "upcz.reduceMotion", "upcz.textSize", "upcz.opening"];
export function keysToRemove(allKeys) { /* every key starting with "upcz." that isn't in KEEP_KEYS and doesn't start with "upcz.c." (blob keys are cleared through blobs.clear()) */ }
export async function wipeLocalData({ prefs, listKeys, blobs, store, cancelAllReminders }) { … }
```
- `listKeys`: native → `(await Preferences.keys()).keys`; web → `Object.keys(localStorage)`.
- `cancelAllReminders` (add to `reminders.js`): native only; `getPending()` → `cancel` all of them; `try/catch`.
- Add `reset()` to `createStore` in `store.js`: it clears every in-memory entry and the in-flight markers, then notifies all subscribers.
- `App.jsx` `deleteMyInfo`: call `wipeLocalData(...)`, then reset React state (`profile`, `favs`, `readMarks`, `added`, `nav`), then go to first-run as today.
- Settings row caption, replacing today's: "Your name, branch, email, favourites, added events, reminders and saved content. Events you put in your phone's calendar stay there."
- `tests/wipe.test.mjs` (new): `keysToRemove` removes `upcz.profile`, `upcz.favs`, `upcz.cal.12`, `upcz.addedEvents`, `upcz.readAnnouncements`, `upcz.greeting`, `upcz.branches`, `upcz.firstrun` and `upcz.cacheV2`; it keeps every key in `KEEP_KEYS` and ignores non-`upcz.` keys. `wipeLocalData` with memory fakes calls `blobs.clear`, `store.reset` and `cancelAllReminders` once each.

### 3. Settings and profile wording: `mobile/src/screens/Pages.jsx`, `FirstRun.jsx`

- The Smoothness test section follows decision 3.
- FirstRun email hint: "Optional. It stays on this phone. The app doesn't send it anywhere."
- Profile line: "Your name and email stay on this phone. The app only uses your branch to fetch its news."

### 4. No em dashes in the app

Replace `—` in every user-facing string under `mobile/src/` (for example "Added — tap to remove" becomes "Added. Tap to remove", and "You're offline — …" if any is left). Comments may keep them.

New test `tests/wording.test.mjs`: for every `.jsx` file in `src/screens` and `src/components`, and for `src/lib/greeting.js`, `src/lib/phoneMake.js` and `src/lib/reminders.js`, remove `/* … */` blocks and lines whose trimmed start is `//` or `{/*`, then assert there is no `—`.

### 5. Privacy page: `presbyterian-web/app/(national)/privacy/page.js`

- Remove every em dash from the visible text (the `metadata.title` may keep its separators, matching other pages).
- **Notifications:** replace "You can turn them off in the app's Settings or in your phone's settings at any time." with "You can turn them off in your phone's settings at any time, or remove an event's reminders by tapping it again in the app."
- **What the app reads from the internet:** add "Like any website, the church's server and the companies that host it see your phone's internet address when the app fetches content. It isn't linked to your name or stored with anything you typed."
- **New section "Deleting your information":** "In the app, Settings → Delete my information removes everything the app saved on your phone: your details, favourites, added events, reminders and saved content. Events you put in your phone's own calendar stay there until you delete them. Uninstalling the app also removes everything it saved."
- Update "Last updated" to the date you make the change.
- Add `"app/(national)/privacy/page.js"` to the file list in `presbyterian-web/tests/noEmDashes.test.mjs` (the loop that reads files and strips `title:` lines).

### 6. `mobile/RELEASE.md`

Make the data-deletion bullet match decision 2.

## Acceptance checks

1. App tests, lint and build are clean. Website tests and lint are clean.
2. `npm run build` (without `VITE_SHOW_TEST_TOOLS`) followed by `npm run preview`: Settings has no Smoothness test. `npm run dev`: it's there.
3. In a browser: add a favourite, add an event, open some screens, then Settings → Delete my information (twice). The app is back on first-run; afterwards, `localStorage` has only the kept keys (`upcz.theme` etc.) and no `upcz.c.` keys. Paste the key list.

## Out of scope

Workflows and build variables (T10).
