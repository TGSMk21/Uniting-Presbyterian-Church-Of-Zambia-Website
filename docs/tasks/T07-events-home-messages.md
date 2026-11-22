# T07 — Events, Home and message screens

**Fixes:** F14, F16, F17 (app part), F18, F25, F27 · **Area:** app · **Branch:** `task/T07` · **Depends on:** T02, T05 (T03/T04 merged first if open: this touches `EventBody`)

## Decisions (don't change them)

1. **The Events list has two sections.** "Coming up" (today and later, **soonest first**), then "Earlier" (past, **most recent first**). An empty section isn't shown. This replaces the single newest-first list.
2. **Past events always show their date.** `eventLabel` returns "Today", "Tomorrow" or "Yesterday", otherwise the weekday and date (`"Sunday 15 November"`, plus the year if it isn't this year).
3. **No "Add to calendar" on past events.** The sheet shows "This event has passed." instead of the button. If a past event is still marked added, also show a quiet "Remove from my events" button that undoes it.
4. **`App.jsx` owns the added-events list**, so the list, the calendar and the sheet always agree.
5. **The greeting is chosen synchronously**, with no flicker. Remember the last pick in `localStorage` (like the theme), not in Preferences.
6. **Library messages open immediately**, and the text loads inside the page.

## Changes

### 1. `mobile/src/lib/events.js`

- `eventLabel(event, today)`: as in decision 2.
- New `splitEvents(events, today)` → `{ upcoming, past }`. `upcoming` is sorted by date then `start_time` ascending. `past` is sorted by date descending, then `start_time` descending.
- New `formatDuration(iso)`: `"PT1H2M3S"` → `"1 h 2 min"`, `"PT31M10S"` → `"31 min"`, `"PT45S"` → `"Under 1 min"`, `""` or invalid → `""`.
- New `dayAria(iso, dot)` → `"Sunday 22 November, events"` / `", sermon"` / `", events and a sermon"` / nothing extra.

### 2. `mobile/src/App.jsx`

- `const [added, setAdded] = useState([])`, filled once from `readAdded(prefs)` and again after "Delete my information".
- Pass `added` to `EventsTab`. Pass `added` and `onAddedChange={setAdded}` to `EventBody`.

### 3. `mobile/src/screens/Events.jsx`

- `EventBody`: take `added` and `onAddedChange` as props, and remove its own `readAdded` effect. After `toggleAdded`, call `onAddedChange(list)`. Past events follow decision 3: `event.date < todayIso()`.
- `EventsTab`: use `splitEvents`. Render each section with a `t-overline section-label` heading ("Coming up", "Earlier"). Remove its own `added` state and read the prop.
- `CalendarView`: buttons get `aria-label={dayAria(cell.iso, dot)}` and `aria-pressed={on}`. Remove `role="grid"` and `role="gridcell"`.

### 4. `mobile/src/lib/greeting.js`

- Replace `GREETINGS` with the pool below, **exactly as written** (the owner reviews the wording).
- `fillName`: when the name is empty, also clean up `", ?"`, `", !"` and `", ,"`. Replace the regexes with: `.replace(/,\s*([.?!,])/g, "$1")` and keep the trailing-comma and double-space clean-up.
- New `pickGreetingSync(part, storage = globalThis.localStorage, rng = Math.random)`: read `upcz.greeting` from `storage` (`try/catch`; JSON `{part, index}`), pick without repeating the last index for the same part, write it back, and return `{ index, text }`.

```js
export const GREETINGS = {
  "early-morning": [
    "Good morning, {name}. His mercies are new this morning.",
    "Up early, {name}? The Lord is already here.",
    "Good morning, {name}. Give Him the first moments of the day.",
    "A fresh start, {name}. Grace for today is ready.",
    "Good morning, {name}. This is the day the Lord has made.",
    "Before the day gets busy, {name}, a quiet word with God.",
    "Good morning, {name}. Walk with Him today.",
    "Morning has come, {name}. He kept you through the night.",
    "Good morning, {name}. Begin with thanks.",
    "Early light, {name}. May God guide your steps today.",
    "Good morning, {name}. You are not alone today.",
    "A new day, {name}. Commit it to the Lord.",
  ],
  morning: [
    "Good morning, {name}.",
    "Good morning, {name}. May your work today be blessed.",
    "Peace to you this morning, {name}.",
    "Good morning, {name}. Grace and peace to you.",
    "Good morning, {name}. The Lord is near.",
    "Morning, {name}. Whatever today holds, God holds you.",
    "Good morning, {name}. Do your work as for the Lord.",
    "Good morning, {name}. Take a moment with God's word.",
    "Morning, {name}. Be strong and of good courage.",
    "Good morning, {name}. Let your light shine today.",
    "Good morning, {name}. May you know His joy today.",
    "Morning, {name}. Cast your cares on Him.",
  ],
  afternoon: [
    "Good afternoon, {name}.",
    "Good afternoon, {name}. Take a breath; God is with you.",
    "Good afternoon, {name}. Grace for the rest of the day.",
    "Afternoon, {name}. May your work be fruitful.",
    "Good afternoon, {name}. Come to Him and find rest.",
    "Good afternoon, {name}. He gives strength to the weary.",
    "Afternoon, {name}. Keep going; the Lord goes with you.",
    "Good afternoon, {name}. A moment of peace, right here.",
    "Good afternoon, {name}. Give thanks in all things.",
    "Afternoon, {name}. May His peace guard your heart.",
    "Good afternoon, {name}. You are loved by God.",
    "Good afternoon, {name}. Halfway through the day, and He is faithful.",
  ],
  evening: [
    "Good evening, {name}.",
    "Good evening, {name}. Thank God for today.",
    "Good evening, {name}. Lay down the day's worries.",
    "Evening, {name}. May your home be filled with peace.",
    "Good evening, {name}. The Lord has carried you today.",
    "Good evening, {name}. Rest well tonight.",
    "Evening, {name}. Time to slow down with God.",
    "Good evening, {name}. Peace be with you and your family.",
    "Good evening, {name}. Count today's blessings.",
    "Evening, {name}. His faithfulness lasts through the night.",
    "Good evening, {name}. Let His word close your day.",
    "Good evening, {name}. Be still, and know that He is God.",
  ],
  night: [
    "Good night, {name}. Sleep in peace.",
    "Still awake, {name}? The Lord does not sleep.",
    "Good night, {name}. He watches over you.",
    "It's late, {name}. Rest in His care.",
    "Good night, {name}. Leave tomorrow in God's hands.",
    "Peace tonight, {name}. You are safe in Him.",
    "Good night, {name}. In peace I will lie down and sleep.",
    "It's late, {name}. Cast your cares on Him and rest.",
    "Good night, {name}. His love holds you.",
    "Quiet hours, {name}. God is near.",
    "Good night, {name}. Tomorrow His mercies are new.",
    "Good night, {name}. May the Lord give you rest.",
  ],
};
```

### 5. `mobile/src/screens/Home.jsx` and `mobile/src/lib/useHome.js`

- Home: `const [now, setNow] = useState(() => new Date())`, updated through `useForegroundRefresh(() => setNow(new Date()))`, so the part of the day changes after the app has been in the background.
- The greeting comes from `useMemo(() => pickGreetingSync(part), [part])`. Remove `chooseGreeting`/`greeting` from `useHome.js` (and the `KEYS.greeting` Preferences use). Leave the `KEYS.greeting` constant in `storage.js`; T09 uses it to know what to delete.
- The events preview: `data.events` if it isn't empty, otherwise `data.recent_events` labelled "Recently at your branch". Remove any other events request from Home.

### 6. Messages: `mobile/src/screens/Sermons.jsx`, `MessagePage.jsx`, `App.jsx`

- Tapping a library row calls `onOpenMessage(row)` **straight away** (no `await`).
- `MessagePage` takes `branchSlug`. If `message.message` is a string, render as now. Otherwise use `useResource(messageResource(branchSlug, message.id))`:
  - Loading: two `skeleton` lines under the title (reuse the `skeleton sk-title` classes).
  - Loaded: render the loaded message.
  - Offline with nothing saved: "This message isn't saved on this phone yet. Connect to the internet to read it." with a "Try again" quiet button.
- Hide the Share button and heart until the text is there.

### 7. `Sermons.jsx`: duration

Use `formatDuration(sermon.duration)` in place of the `replace` chain.

## Tests (write first, see them fail)

- `events.test.mjs`: `splitEvents` orders both sections correctly (include two events on the same day with different times); `eventLabel` for yesterday, a past date this year (no year), a past date last year (with the year), tomorrow and later; `formatDuration` for all four cases; `dayAria` for all four variants.
- `greeting.test.mjs`: **for every greeting in every part**, `fillName(text, "")` contains none of `", ."`, `", ?"`, `", ,"`, `", !"` and no double space, and `fillName(text, "Mary")` contains `"Mary"`. Each part has at least 12 greetings. `pickGreetingSync` never repeats the last index (run it 50 times with a memory `storage` object that has `getItem`/`setItem`), and works when `storage` throws.

**Mutation check (do, then undo):** sort "Coming up" descending; the `splitEvents` test must fail.

## Acceptance checks

1. Tests, lint and build are clean.
2. In a browser against a local backend with one past and two future events: "Coming up" lists the nearest first, "Earlier" shows a date, a past event's sheet has no "Add to calendar", and adding in the sheet updates the list's "· Added" immediately.
3. Reload Home several times: the greeting never flickers from one sentence to another.

## Out of scope

The visual design of the cards, and reminder times.
