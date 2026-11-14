# UPCZ Web App: Features Overview

An overview of everything the Uniting Presbyterian Church in Zambia web app does today, grouped by who uses it. Last updated 14 November 2026.

The app has three parts:

| Part | Who it's for | Address |
|---|---|---|
| **National site** | The public | `/` |
| **Branch sites** | The public, one site per congregation | `/<branch>` (for example `/chilanga`) |
| **Staff dashboard** | Ministers, elders, office bearers, content editors and administrators | `/dashboard` |

---

## 1. The public website

### National site
- **Welcome page**: the church's welcome, fellowships, and events from across the church, with a hero carousel whose slides are edited in the dashboard.
- **"My branch"**: a visitor can choose their branch once. After that, the main link takes them straight to their branch's site. They can switch branches or go back to the national site at any time from a small chip and pop-up.
- **Find a Branch** (`/find-a-branch`): a map of every branch (OpenStreetMap). "Find the nearest branch to me" uses the visitor's location and brings the nearest branch to the top of the page.
- **Contact page**: a contact form that sends the message by email to the church.

### Branch sites
Each branch has its own site with the same layout:
- **Home**: the branch's welcome, hero image, today's daily message, announcements, and a preview of upcoming projects and events.
- **About**: the branch's story, its ministers and its service times.
- **Sermons**: the branch's sermon videos, brought in automatically from its YouTube channel, each on its own page with title and Bible verses.
- **Projects & Events** (`/<branch>/projects-and-events`): projects and events with photos, a gallery and a slideshow. The old "Projects & Activities" address still works and redirects here.
- **Contact form**: messages go to that branch's own email address.

### Look and feel
- Colours from the church crest (royal navy, with warm red as a small accent), with no gradients.
- The crest with *NEC TAMEN CONSUMEBATUR* on every page, and the crest as the browser tab and phone home-screen icon.
- Light and dark themes, following the device's setting by default.
- Built for phones first, and checked at phone and computer widths.

---

## 2. The staff dashboard

### Signing in and accounts
- **Secure sign-in**, with lockout after repeated wrong passwords.
- **Two-step login** with an authenticator app (plus 10 one-time recovery codes). Required for superusers and branch admins.
- **Temporary passwords** must be changed at first sign-in. Staff can change their own password, which ends their other sessions.
- **Asking for access**: anyone can ask for a dashboard account. The branch's minister or a superuser approves it, chooses the role, and the person sets their own password from a one-time link.

### Roles

| Role | What they can do |
|---|---|
| **Superuser** | Everything: all branches, staff, presbyteries, checklists and the change history |
| **Branch Admin (Minister)** | Their own branch's content and pages; adds and suspends their branch's content editors and elders; appoints their branch's Session Clerk and Treasurer |
| **Content Editor** | Their own branch's website content |
| **Elder / office bearer** | The shared workspace only (meetings, deliverables, documents) |

Every page and every API address checks the person's role and branch. Staff at one branch can never see or change another branch's data.

### Overview (home page of the dashboard)
- A greeting and a short **"Needs your attention"** list, linking to where each thing is done. Most urgent first:
  - overdue work
  - work handed in for you to check
  - meeting invitations to answer
  - new documents shared with you
  - work due soon and meetings this week
  - for content staff: access requests, AI drafts to check, a missing daily message for tomorrow
- Shortcuts to everyday tasks for ministers and content editors, and a list of recent changes.
- A **notification bell** with the unread count, on computers and phones.

### Website content (ministers, content editors, superusers)
- **Pages**: edit the wording and images of every page of the national site and each branch site, using labelled fields so a layout can't be broken. Changes appear on the public site straight away.
- **Daily messages**: write, schedule and publish each day's message per minister.
- **AI daily message drafts**: for ministers who turn it on, the system reads their written sermons and drafts tomorrow's message (with Google Gemini). Drafts are clearly marked and must be checked and approved by staff before they are published.
- **Written sermons**: paste a sermon, or upload many Word, PDF or text files at once. These feed the AI drafts and stay private.
- **Announcements**, **Sermons** (titles and verses; edits survive the YouTube sync), **Projects** and **Events**, with photos.
- **Ministers** (with photos and order) and **service times**.
- **Branch details**: contact email, phone, address and the exact map pin.
- **Media library**: private photos and documents (PDF, Word, Excel, PowerPoint, audio). The file type is read from inside each file, and photos are cleaned of hidden data such as location.
- **CSV export** of every section, limited to what that person can see.

### People and branches
- **Staff**: add, change and suspend accounts.
- **Requests**: approve or decline requests for access.
- **Branches** (superusers): add branches and place each one in its presbytery.
- **Change history** (superusers): who changed what, and when, across the dashboard.

---

## 3. The shared workspace (ministers, elders and office bearers)

One organised place for the church at branch, presbytery and synod level to plan meetings, track what each person must bring, and share documents only with the people who should see them.

### Church structure
- The three levels: **branch → presbytery → synod**. The four presbyteries (Copperbelt, Eastern Zambia, M'chinga, Munali) are set up; superusers can add more (for example DR Congo).
- **Offices**:
  - branch: Session Clerk, Treasurer
  - presbytery: Moderator, Clerk, Treasurer
  - synod: Moderator, Clerk, Treasurer

  Offices are stored as data, so new ones can be added later.
- **Appointments**: a minister appoints their branch's office bearers. The superuser appoints presbytery and synod office bearers. Appointing a new holder ends the previous holder's term, and their unfinished work passes to the new holder.
- The **Church structure** page shows who holds which office at your branch, your presbytery and the synod.

### Meetings and the calendar
- **Who can plan meetings**:
  - at a branch: the minister and the Session Clerk
  - at a presbytery or the synod: the Moderator and the Clerk
  - the superuser, anywhere
- **Inviting people** in a few taps with ready-made groups (for example "Session Clerks in Munali Presbytery", "Ministers in Munali Presbytery", "Everyone at Chilanga"), or by searching names. Everyone invited is notified straight away.
- **Calendar views**: Coming up, Month (a full grid on computers, dots and a list on phones), and Past.
- **Meeting page**: when and where, a video call link, the agenda, who's coming, what to bring, and the meeting's documents.
- **Answering**: each person taps **Attending** or **Sending apologies**. The organiser sees the counts.
- **Organiser tools**:
  - change the details (everyone is told if the time or place changes)
  - cancel (everyone is told)
  - invite more people or remove people
  - **record who came** after the meeting
  - **plan the next one** with the same people and agenda on a new date
- **Phone calendar**: a private link adds your meetings to your phone's own calendar app. Making a new link stops the old one.

### Deliverables (what each person must bring)
- Each meeting has a **"To bring"** list. Each item has one person and a due date.
- **Checklists**: planning a meeting offers the usual checklist for that kind of meeting:
  - **Session meeting**: minutes (Session Clerk), financial report (Treasurer), minister's report (Minister)
  - **Presbytery and Synod meetings**: minutes (Clerk), treasurer's report, moderator's report

  Each office holder is asked for their part automatically. The superuser edits the checklists on the **Checklists** page.
- **Handing in**: the person attaches the file and adds a note. The file is shared with the meeting's people.
- **Checking**: the organiser **accepts** it or **sends it back** with a reason. Nobody can accept their own work.
- **Tracking**: the meeting shows how many are accepted and which are overdue. The **Deliverables** page lists "Yours to prepare" and "Handed in to you".
- Reminders of due and overdue work appear on the Overview.

### Documents
- **Add a document** by uploading a file (PDF, Word, Excel, PowerPoint, text or a picture, up to 4 MB) or by writing it in the dashboard.
- **Private until you share it**, so the author can read it through first.
- **Sharing** (only with the people who need it):
  - one person
  - the people at a meeting
  - your branch
  - your presbytery
  - the whole synod (synod office bearers only)

  You can stop sharing at any time.
- **Viewer**:
  - Word files show as a readable page
  - PDFs and pictures open in the dashboard (phones use their own PDF viewer)
  - written documents and text files show as text
  - everything can be downloaded
- **Versions**: upload a corrected file or change the words; every save is a new version. Old versions can be viewed and **brought back**.
- **Who has opened it**: the author sees who has read each version.
- **Documents page**: "Shared with you" (new ones marked) and "Yours", with search.
- Meetings list the documents shared with them.

### Notifications
- People are notified when:
  - they are invited to a meeting
  - a meeting changes or is cancelled
  - work is assigned, handed in, accepted or sent back
  - a document is shared with them
- Opening a notification marks it read and goes to the right page.

---

## 4. Behind the scenes

- **Automatic jobs** (run by an hourly scheduled call):
  - new YouTube sermons are imported
  - tomorrow's AI daily message drafts are written
- **Security**:
  - strict security headers on every page
  - rate limits on the API
  - private files are only ever sent after an access check, never as public links
  - uploaded files are checked by their contents, not their names
- **Testing**: about 870 backend tests and 330 website tests. They include an access matrix that tries every staff address as every role and branch, and deliberate-mistake checks on the access rules.
- **Hosting**:
  - website on Vercel
  - API on Render
  - database on Supabase (PostgreSQL)
  - files on Cloudflare R2
  - email through Resend

---

## 5. Planned next

- **Mobile app** with phone pop-up notifications:
  - when invited to a meeting
  - the day before a meeting
  - a daily reminder of work due

  The design is written in `AGENT_EXECUTION_PLAN.md` (Task 8.7). The app will use the same API and rules.
- Later: email reminders, meetings that repeat on their own, and comparing two versions of a document.
