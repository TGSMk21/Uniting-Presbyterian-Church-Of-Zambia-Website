# UPCZ App: Design Direction

For the owner's approval (MOBILE_APP_PLAN.md, Phase 0). Every screen in later phases follows this page. The values themselves live in `src/design/tokens.css` and `src/lib/motion.js`.

## The feeling: "morning light on paper"

Calm, warm and reverent. It should feel like opening a well-made Bible or hymn book, not a news app. The church's crest gives the colours. Nothing should shout.

## Colour

| Role | Light | Dark | Used for |
|---|---|---|---|
| Paper | `#f6f3ec` warm off-white | `#0d1017` deep ink-navy | The background everywhere |
| Surface | `#fffdf8` | `#151a24` | Cards, lists, sheets |
| Ink | `#17191f` | `#ece8df` warm white | Text |
| Navy (crest) | `#1b2a6b` | `#b3c3f2` | Meaning and action: buttons, the selected tab, links |
| Red (crest) | `#c0322a` | `#ea6b61` | Only for "live now", "today" and "overdue" moments |

- Flat colours. No gradients, no glows, no purple or pink.
- Dark mode is a night palette with warm text, so scripture reads like lamplight, not a black terminal screen.
- The crest always keeps its official colours.

## Type

- **Newsreader** (a reading serif with optical sizing) for the greeting, scripture, daily messages and page titles. It gives the app its voice.
- **The phone's own font** (Roboto on most Android phones) for everything you tap: tabs, buttons, labels. It is familiar, light to load, and follows the phone's text-size setting.
- Large text is set tighter, small text slightly looser, and all sizes grow when the person enlarges text on their phone.

## Layout

- One main thing per screen, with generous space around it.
- **The five tabs always show their names**, so nothing is hidden behind an icon. The selected tab fills in its icon and sits on a soft navy capsule that springs across when you change tabs.
- The top bar is clear at the top of a page. Once you scroll, it turns into frosted glass and shows the page's name.
- Pages opened from the top bar (profile, favourites, settings) slide in from the right and leave the same way.
- Details (events, announcements) open in a **bottom sheet** you can drag down or flick away.
- Every touch target is at least 48 px.

## Motion

- **Springs, not timers**, for anything a finger touches. A moving sheet can be grabbed and reversed at any moment, and a flick is carried through.
- No bounce by default. A little bounce only after a flick, and on the tab capsule.
- Buttons respond the moment they're pressed (a slight press-in), not on release.
- A light tap of vibration only for meaningful moments: changing tab, a sheet snapping closed.
- **"Reduce motion" on the phone means gentle fades instead of movement.** Lighter phones get solid bars instead of frosted glass, and no tilt.

## Signature moments

1. **The opening:** the crest is drawn as a pen line, the navy flames rise, the red flames sweep up, and the cross fills in. It takes about 1.5 seconds and continues straight from Android's own splash.
2. **Depth:** the crest (and later a few special cards) tilts gently toward your finger or with the phone, and catches a soft light.
3. **The greeting:** a large serif greeting with your name, which changes with the time of day.

## What we avoid (so it never looks generated)

- Stock icon sets used everywhere (we use Phosphor, with a filled icon for the selected tab).
- Gradient blobs, glowing cards, emoji as icons, and generic illustrations.
- Placeholder-looking empty states: every empty screen says plainly what will appear and how.
- Many competing buttons: one primary action per screen.
