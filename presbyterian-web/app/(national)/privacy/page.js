import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — UPCZ App — Uniting Presbyterian Church In Zambia",
  description:
    "What the UPCZ app does with your information: it keeps your details on your phone only and never sends them anywhere.",
};

// The privacy policy Google Play requires, published on the church’s own website.
// It must match what the app actually does (MOBILE_APP_PLAN.md, Phase 9).
export default function PrivacyPolicy() {
  return (
    <main>
      <section className="page-banner">
        <div className="page-banner-inner">
          <span className="page-banner-label">UPCZ app</span>
          <h1 style={{ fontFamily: "var(--font-playfair)" }}>Privacy policy</h1>
          <p>Last updated: 19 November 2026</p>
        </div>
      </section>
      <section className="page-section">
        <div className="page-section-inner prose">
          <p>
            The UPCZ app is the app of the Uniting Presbyterian Church in Zambia. This page explains, in plain
            words, what the app does with your information.
          </p>
          <h2>The short answer</h2>
          <p>
            <strong>Your details stay on your phone. The app never sends them anywhere.</strong> There are no
            accounts and no passwords in the app.
          </p>
          <h2>What the app asks for on first start</h2>
          <ul>
            <li><strong>Your name</strong> — used only to greet you on the home screen. Stored on your phone.</li>
            <li><strong>Your branch</strong> — used to show your branch’s sermons, events and announcements. Stored on your phone.</li>
            <li><strong>Your email address (optional)</strong> — you can skip it. If you enter it, it is stored on your phone only and is never sent to the church or anyone else.</li>
          </ul>
          <h2>What the app reads from the internet</h2>
          <p>
            The app reads only public church content — your branch’s sermons, daily messages, events,
            announcements and the hymn collections — from the church’s public website address. These requests
            contain only your branch’s name. No personal information is included in any request.
          </p>
          <h2>Calendar and reminders</h2>
          <p>
            When you tap “Add to calendar” on an event, the app asks your phone’s permission, then adds that one
            event to your phone’s calendar and sets two reminders on your phone (the evening before and the
            morning of the event). Both happen entirely on your phone. You can remove them at any time by
            tapping “Added — tap to remove”, or from your phone’s calendar and notification settings.
          </p>
          <h2>Notifications</h2>
          <p>
            The app asks your phone’s permission before showing any notification (Android 13 and newer). All
            reminders are created and shown by your phone, not sent over the internet. You can turn them off in
            the app’s Settings or in your phone’s settings at any time.
          </p>
          <h2>Favourites</h2>
          <p>Things you mark with a heart are saved on your phone only and work without internet.</p>
          <h2>Crash reports</h2>
          <p>
            If the app crashes, Google Play may show the church anonymous technical crash reports (such as the
            phone model and app version) in the Play Console. These do not include your name, email or anything
            you typed, and the church does not use any other crash-tracking service.
          </p>
          <h2>Photos and videos</h2>
          <p>
            Sermon videos open in the YouTube app or your browser. The app does not upload any photos or videos
            from your phone.
          </p>
          <h2>Children</h2>
          <p>The app does not collect any information from anyone, including children.</p>
          <h2>Changes and contact</h2>
          <p>
            If this policy changes, the new version is published on this page with a new date. Questions:
            contact the church through the <Link href="/contact">contact page</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
