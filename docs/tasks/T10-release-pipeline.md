# T10 — Release pipeline and Android project hygiene

**Fixes:** F12 (High), F23, F24 · **Area:** CI + Android · **Branch:** `task/T10` · **Depends on:** nothing (do it last so it can be checked against the finished app)

## Why

- `android-release.yml` has no `setup-java`. Capacitor 8 compiles with Java 21, so the release build fails.
- `versionCode` is hard-coded to 1, but Play rejects a second upload with the same code.
- Neither workflow sets `VITE_API_URL` or `VITE_PRIVACY_URL`, so the released app has no privacy-policy link (Play requires one in the app).
- Without a keystore, the release silently builds an unsigned bundle, while the comment says "falls back to the debug key".
- Settings shows `0.1.0` but Android says `1.0`.
- Two plugins use `^` ranges.
- The committed `capacitor.settings.gradle`/`capacitor.build.gradle` are stale.
- Capacitor's template tests (`com.getcapacitor.myapp`) are still there.

## Decisions (don't change them)

- **The release workflow takes `version_code` (integer) and `version_name` (text) as inputs.** It fails early, with a plain message, if any secret or variable is missing.
- **Repository variables** (Settings → Secrets and variables → Actions → **Variables**): `UPCZ_API_URL` and `UPCZ_PRIVACY_URL`. The owner sets them. Workflows read them as `${{ vars.UPCZ_API_URL }}`.
- **The debug APK** sets `VITE_SHOW_TEST_TOOLS: "1"` so the Smoothness test is available for the phone proof. The release never sets it.
- **The app shows** `VITE_APP_VERSION` when it's set, otherwise `package.json`'s version.

## Changes

### 1. `.github/workflows/android-release.yml`

- `on: workflow_dispatch: inputs:` `version_code` (required, type `number`) and `version_name` (required, type `string`, for example `"1.0.0"`).
- `timeout-minutes: 30` on the job.
- Add the same `actions/setup-java@v4` step as `android-app.yml` (temurin, 21, gradle cache).
- First step after checkout, "Check release settings": `run: bash mobile/scripts/check-release-env.sh`, with `env:` holding `UPCZ_KEYSTORE_B64`, `UPCZ_KEYSTORE_PASSWORD`, `UPCZ_KEY_ALIAS`, `UPCZ_KEY_PASSWORD` (secrets), `UPCZ_API_URL`, `UPCZ_PRIVACY_URL` (vars) and `UPCZ_VERSION_CODE: ${{ inputs.version_code }}`.
- New file `mobile/scripts/check-release-env.sh` (`#!/usr/bin/env bash`, `set -u`): for each of those seven names, if the variable is empty, print `::error::<NAME> is not set. See mobile/RELEASE.md.` Also print an error if `UPCZ_VERSION_CODE` isn't a positive integer (`^[1-9][0-9]*$`). Exit 1 if there was any error, otherwise print `Release settings OK.` and exit 0. Never print a variable's value.
- The build step for the web files gets `env: VITE_API_URL`, `VITE_PRIVACY_URL`, and `VITE_APP_VERSION: ${{ inputs.version_name }}`.
- The Gradle step gets `env: UPCZ_VERSION_CODE: ${{ inputs.version_code }}` and `UPCZ_VERSION_NAME: ${{ inputs.version_name }}`, plus the existing keystore variables.
- Name the artifact `upcz-release-${{ inputs.version_name }}-${{ inputs.version_code }}`.

### 2. `.github/workflows/android-app.yml` (debug)

The web build step gets `env: VITE_API_URL: ${{ vars.UPCZ_API_URL }}`, `VITE_PRIVACY_URL: ${{ vars.UPCZ_PRIVACY_URL }}` and `VITE_SHOW_TEST_TOOLS: "1"`. Empty variables are fine here; the app has defaults.

### 3. `mobile/android/app/build.gradle`

- `versionCode ((System.getenv("UPCZ_VERSION_CODE") ?: "1") as Integer)` and `versionName (System.getenv("UPCZ_VERSION_NAME") ?: "1.0")`.
- Fix the signing comment: without a keystore, a release build **stops**. Add, after the signing block:
  ```groovy
  gradle.taskGraph.whenReady { graph ->
      def wantsRelease = graph.allTasks.any { it.name.toLowerCase().contains("release") }
      if (wantsRelease && !System.getenv("UPCZ_KEYSTORE_PATH")) {
          throw new GradleException("Release builds need the upload key (UPCZ_KEYSTORE_PATH). See mobile/RELEASE.md.")
      }
  }
  ```

### 4. App version: `mobile/src/screens/Pages.jsx`

`Version {import.meta.env.VITE_APP_VERSION || pkg.version}`.

### 5. Dependencies: `mobile/package.json`

Pin `"@capacitor/local-notifications": "8.3.1"` and `"@capgo/capacitor-calendar": "8.0.17"` (no `^`). Run `npm install` so `package-lock.json` matches.

### 6. Sync the Android project

From `mobile/`: `npm run build && npx cap sync android`. Commit the regenerated `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`. They must now list local-notifications, calendar, filesystem and share. Don't commit `android/app/src/main/assets/public` (it's ignored).

### 7. Remove template tests

Delete `mobile/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` and `mobile/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`.

### 8. `mobile/RELEASE.md`

- "Before the first release": add step "Set the repository variables `UPCZ_API_URL` (`https://upcz-backend.onrender.com/api`) and `UPCZ_PRIVACY_URL` (`https://<the church's website>/privacy`)."
- Rewrite "Versioning": choose `version_code` (one more than the last upload; Play Console shows the last one) and `version_name` when running the release workflow. Nothing in the code changes per release.

## Acceptance checks

1. App tests, lint and build are clean.
2. Push `task/T10`; the **Android app** workflow run on that push is green. Paste the run URL and the APK artifact name.
3. GitHub only lets you run a hand-started workflow once it's on the default branch, so test the guard locally (Git Bash on Windows is fine). Paste both outputs:
   - `bash mobile/scripts/check-release-env.sh` with nothing set: seven `::error::` lines, exit code 1.
   - With all seven set to dummy values (e.g. `UPCZ_KEYSTORE_B64=x … UPCZ_VERSION_CODE=3 bash mobile/scripts/check-release-env.sh`): `Release settings OK.`, exit code 0. Then again with `UPCZ_VERSION_CODE=abc`: one error, exit code 1.
   The full signed build is the owner's step, after creating the key and merging to `master`.
4. `grep -n '"\^' mobile/package.json` finds nothing.

## Out of scope

Creating keys or secrets (owner only). Play Console steps.
