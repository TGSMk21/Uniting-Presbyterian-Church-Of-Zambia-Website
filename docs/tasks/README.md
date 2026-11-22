# Tasks for the coding agent (Mistral / Vibe)

These tasks fix the findings in [`docs/review/MOBILE_APP_REVIEW_2026-11-22.md`](../review/MOBILE_APP_REVIEW_2026-11-22.md). **Claude decides and reviews; you implement exactly what the task file says.** If a task seems wrong or impossible, stop and say so in your report. Don't improvise a different design.

## The loop

1. The owner tells you: "Do `docs/tasks/T0X-….md`."
2. Start from the latest working branch:
   ```bash
   git fetch origin
   git checkout -b task/T0X origin/claude/phase-5-dashboard-gxzpfx
   ```
3. Read the whole task file, then the files it names, before changing anything.
4. **Tests first.** Write the tests the task lists, run them, and see them fail. Then write the code until they pass.
5. Run **every** acceptance check in the task, plus the "always" checks below.
6. Write your report to `docs/tasks/reports/T0X-report.md` (template below).
7. Commit, then push the task branch:
   ```bash
   git push -u origin task/T0X
   ```
8. The owner tells Claude "T0X is done on `task/T0X`". Claude reads the diff, re-runs the checks, and replies with either **approved** (Claude merges it into the working branch) or a **numbered fix list**. For a fix list, add new commits on the same `task/T0X` branch. Don't start a new branch, and don't rewrite history.

## Rules

- **One task per branch.** Never commit to `master`, `main` or `claude/phase-5-dashboard-gxzpfx`. Never merge anything.
- **Touch only the files the task names.** If you truly need another file, change it and explain why in the report under "Deviations".
- **Don't edit** `MOBILE_APP_PLAN.md`, `docs/review/*` or `docs/tasks/T*.md`. Claude updates them.
- **No new dependencies** unless the task names the package and the **exact** version. Install with `npm install --save-exact <pkg>@<version>`.
- **Never** put keys, passwords or keystores in the repository.
- **Don't fake results.** If a command can't run on your machine, say so and paste the error. A report that says "passed" for something that wasn't run is the worst possible outcome.
- Keep the existing style: plain English in user-facing text, second person, no jargon, no exclamation marks. Use the existing CSS classes and tokens, with no new colours and no gradients.
- Keep diffs small. Don't reformat or "tidy" code you weren't asked to touch.
- **Existing tests:** never weaken or delete one. A test that checks an exact list of fields (`set(row) == {...}`) may gain the fields a task adds, as long as every old field stays in it. Say so under "Deviations" in the report.

## Always-run checks (paste the last lines of each into the report)

From `mobile/`:
```bash
npm test
npm run lint
npm run build
```
`npm run build` must not print `IMPORT_IS_UNDEFINED` or any other warning about our own code.

From `backend/` (only if the task touches `backend/`):
```bash
python manage.py test --settings=church_erp.settings.test
python manage.py makemigrations --check --dry-run --settings=church_erp.settings.test
```

From `presbyterian-web/` (only if the task touches it):
```bash
npm test
npm run lint
```

## Report template (`docs/tasks/reports/T0X-report.md`)

```markdown
# T0X report

## What I changed
- file — one line each

## Tests added
- test name — what it proves

## Tests seen failing first
- yes/no, with the failure line

## Acceptance checks
(each check from the task: the command and the last lines of its output)

## Always-run checks
(paste the outputs)

## Deviations
(anything not done exactly as written, and why; or "None")

## Things I could not verify
(for example "real phone not available"; or "None")
```

## Commit message

```
T0X: <short title from the task>

<2–4 lines: what changed and why, referencing the finding numbers (F03, …)>
```

## Task list

| Task | Title | Area | Depends on |
|---|---|---|---|
| [T01](T01-backend-app-access.md) | Let the app reach the API; health check | backend | — |
| [T02](T02-backend-app-api-additions.md) | App API additions (ids, recent events, favourites check, caching) | backend | — |
| [T03](T03-fix-add-to-calendar.md) | Make "Add to calendar" work | app | — |
| [T04](T04-reminders-and-notifications.md) | Reminders and notification permission | app | — |
| [T05](T05-data-layer.md) | Cache-first shared data store | app | — |
| [T06](T06-favourites.md) | Favourites fixes | app | T02, T05 |
| [T07](T07-events-home-messages.md) | Events, Home and message screens | app | T02, T05 |
| [T08](T08-hymns.md) | Hymns: dashboard form, staff list, reader | backend + website + app | T05 |
| [T09](T09-share-settings-privacy.md) | Share, delete my info, settings, privacy | app + website | T04, T05 |
| [T10](T10-release-pipeline.md) | Release pipeline and Android project hygiene | CI + android | — |
