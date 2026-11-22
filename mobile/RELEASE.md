# Releasing the UPCZ app on Google Play

One page for the owner, then the full steps. Everything here matches what the app actually does — the privacy policy at **`/privacy` on the church's website** is the public version of this.

## The one-pager: updating the app and when something breaks

**To update the app:** push the change to the app branch and let the GitHub Actions build finish (the APK appears under the run's Artifacts; for Play, run the "Android app (release)" workflow and upload the AAB in Play Console → the track you want). Nothing else is needed — the app reads the church's live website, so content changes need no app update at all.

**If something breaks:** in Play Console, pause the rollout (or roll back to the previous release) — members keep the working version. Fix on a new branch, let Actions build it, test it in Internal testing first, then roll out again. If the app crashes for someone, the anonymous crash reports are in Play Console → Android vitals; they contain no personal information.

**The signing key:** stored in the owner's password manager, never in this repository. The release workflow reads it from GitHub secrets.

## Before the first release (once)

1. **Google Play developer account** in the church's name (one-time US$25) — Decision 6. The person who creates it keeps the login; add a second owner in Play Console so it isn't tied to one phone number.
2. **Create the upload key** on your computer and keep it safe:
   ```bash
   keytool -genkey -v -keystore upcz-upload-key.jks -alias upcz -keyalg RSA -keysize 2048 -validity 10000
   ```
   Store `upcz-upload-key.jks` and the passwords in the password manager. Then add four GitHub secrets (repo → Settings → Secrets → Actions): `UPCZ_KEYSTORE_B64` (`base64 -w0 upcz-upload-key.jks`), `UPCZ_KEYSTORE_PASSWORD`, `UPCZ_KEY_ALIAS` (`upcz`), `UPCZ_KEY_PASSWORD`. Enroll the key in **Play App Signing** when Play Console asks — Google then keeps the real signing key and your upload key only signs uploads.
3. **App listing:** name "UPCZ", short description "Sermons, daily messages, events and hymns from your Uniting Presbyterian Church in Zambia.", full description from `mobile/DESIGN.md`/the website. Icon: the adaptive icon is already in the app (drawn from the crest). Feature graphic: `mobile/store-assets/feature-graphic-1024x500.png`. Screenshots: take 2+ phone screenshots from real phones during internal testing (Play requires them) — home, events with a sheet open, a sermon, the hymn reader.
4. **Privacy policy URL** in Play Console: `https://<the church's website>/privacy` (page added in this branch). In the app, Settings → Privacy policy links there via the `VITE_PRIVACY_URL` build variable; set it in the release workflow environment or leave the default once the site is live.
5. **Data safety form** — answer to match the policy page:
   - Data collected: **none**. No personal or sensitive data is collected, shared, or sold.
   - Data safety: app does not request access to photos, media, files, camera, microphone, or precise location. Calendar access is asked for only when you tap "Add to calendar"; the app writes that one event and reads nothing else. Notification permission is asked for only before reminders.
   - Data deletion: everything is stored on the phone; deleting the app or using Settings → "Delete my info" removes it.
   - Security: data is not transmitted from the phone except public, non-personal reads of church content (branch name only); HTTPS everywhere.
   - Crash reports: anonymous technical reports via Google Play only.

## Releasing, step by step

1. Merge the app branch to `master` only with the owner's explicit "Yes, push to master".
2. Actions → **Android app** runs on the push: tests, lint, debug APK (for the owner's phone).
3. Actions → **Android app (release)** → Run workflow → download `upcz-release-*.aab` from Artifacts.
4. Play Console → the app → **Internal testing**: upload the AAB, add the owner and a few trusted testers by email, on a range of phones including a low-end Tecno/Infinix/Xiaomi. Watch Android vitals for crashes.
5. Fix what testers find; each fix is a new AAB on the same internal track. **The first release candidate is the exact build the testers used.**
6. **Closed testing**: add a few branches (their ministers' emails). Fix what comes back.
7. **Production**: staged rollout, start at 20%, watch Android vitals for 48 hours, then 100%.
8. Hymn texts: only added once permission is confirmed (Decision 1) — via Dashboard → Hymns (superuser) or bulk import.

## Versioning

`versionCode`/`versionName` live in `mobile/android/app/build.gradle` (1 / "1.0"). Bump both for every Play upload.
