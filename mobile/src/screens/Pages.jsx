import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunHorizon } from "@phosphor-icons/react/dist/csr/SunHorizon";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import Page from "./Page.jsx";
import BranchPicker from "../components/BranchPicker.jsx";
import { loadBranches } from "../lib/api.js";
import { initialOf, profileErrors, profileFromForm } from "../lib/profile.js";
import { SPRING_SNAPPY } from "../lib/motion.js";
import { getPrefs } from "../lib/storage.js";
import { openExternally } from "../lib/links.js";
import { notificationPermission, notificationStatus } from "../lib/reminders.js";
import { useForegroundRefresh } from "../lib/useContent.js";
import { BATTERY_GUIDE, needsBatteryGuide } from "../lib/phoneMake.js";
import { KINDS, markStale, sectionLabel, writeFavs } from "../lib/favourites.js";
import { loadMessages, loadSermons } from "../lib/content.js";
import HeartButton from "../components/HeartButton.jsx";
import pkg from "../../package.json";

export const PRIVACY_POLICY_URL = import.meta.env?.VITE_PRIVACY_URL || "";

export function ProfilePage({ onBack, profile, onSave }) {
  const prefs = useRef(getPrefs()).current;
  const [draft, setDraft] = useState(profile);
  const [branchState, setBranchState] = useState({ status: "loading", branches: [], source: "api" });
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const result = await loadBranches({ prefs });
    setBranchState({ status: "ready", ...result });
  }, [prefs]);
  useEffect(() => {
    load();
  }, [load]);

  const [lastProfile, setLastProfile] = useState(profile);
  if (lastProfile !== profile) {
    setLastProfile(profile);
    setDraft(profile);
  }

  const changed = useMemo(
    () => JSON.stringify(profileFromForm(draft)) !== JSON.stringify(profileFromForm(profile)),
    [draft, profile],
  );

  const save = () => {
    const next = profileFromForm(draft);
    const errors = profileErrors(next);
    if (errors.email) {
      setError(errors.email);
      return;
    }
    onSave(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Page title="Your profile" onBack={onBack}>
      <div className="profile-head">
        <span className="avatar avatar-big" aria-hidden="true">{initialOf(draft.name) || "?"}</span>
        <p className="t-callout">This is only stored on this phone. It is never sent anywhere.</p>
      </div>

      <div className="form">
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" type="text" autoComplete="name" value={draft.name}
            onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))} />
        </label>
        <BranchPicker
          status={branchState.status}
          branches={branchState.branches}
          source={branchState.source}
          onRetry={load}
          value={draft.branchSlug}
          onChange={(slug) => setDraft((d) => ({ ...d, branchSlug: slug }))}
        />
        <label className="field">
          <span className="field-label">Email <span className="field-optional">(optional)</span></span>
          <input className="input" type="email" autoComplete="email" value={draft.email}
            onChange={(event) => { setDraft((d) => ({ ...d, email: event.target.value })); setError(null); }} />
          {error && <span className="field-error" role="alert">{error}</span>}
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="button button-primary" onClick={save} disabled={!changed}>
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </Page>
  );
}

export function FavouritesPage({ onBack, favs, onToggleFav, branchSlug, onOpenMessage, onOpenSermon, onOpenHymn, onOpenVerse }) {
  const [prefs] = useState(() => getPrefs());
  const [marked, setMarked] = useState(favs);

  // When a fresh server list is available, flag favourites the branch no longer lists.
  // The snapshot still opens them offline; they're just marked as no longer current.
  useEffect(() => {
    let alive = true;
    (async () => {
      const load = async (loader, key) => {
        const result = await loader({ prefs, branchSlug, timeoutMs: 6000 });
        return result.data ? result.data[key] : null;
      };
      const [sermons, messages] = await Promise.all([
        load(loadSermons, "sermons"),
        load(loadMessages, "messages"),
      ]);
      if (!alive) return;
      setMarked((current) => {
        let next = current;
        if (sermons) next = markStale(next, "sermons", sermons.map((s) => s.video_id));
        if (messages) next = markStale(next, "messages", messages.map((m) => m.id));
        if (next !== current) writeFavs(prefs, next);
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [prefs, branchSlug]);

  const openers = {
    messages: (item) => onOpenMessage(item.snapshot ?? item),
    verses: (item) => onOpenVerse(item.snapshot ?? item),
    sermons: (item) => onOpenSermon(item.snapshot ?? item),
    hymns: (item) => onOpenHymn(item.snapshot ?? item),
  };
  const emptyWords = {
    messages: "Tap the heart on today's message to keep it here.",
    verses: "Tap the heart on the daily verse to keep it here.",
    sermons: "Tap the heart on any sermon to keep it here.",
    hymns: "Tap the heart on any hymn to keep it here.",
  };

  return (
    <Page title="Favourites" onBack={onBack}>
      <p className="t-callout screen-lede">What you've kept. Favourites are saved on this phone only — they work offline.</p>
      {KINDS.map((kind) => {
        const items = marked[kind] ?? [];
        return (
          <section key={kind} aria-label={sectionLabel(kind)}>
            <h2 className="t-overline section-label">{sectionLabel(kind)}</h2>
            {items.length === 0 ? (
              <div className="card empty-card"><p className="t-callout">{emptyWords[kind]}</p></div>
            ) : (
              <ul className="list">
                {items.map((item) => (
                  <li key={`${kind}-${item.id}`} className="sermon-row-wrap">
                    <button type="button" className="list-row" onClick={() => openers[kind](item)}>
                      <span className="grow">
                        <span className="t-body block">{item.title}</span>
                        <span className="t-caption block">
                          {item.sub}{item.stale ? " · No longer listed by your branch" : ""}
                        </span>
                      </span>
                      <CaretRight size={18} className="chev" />
                    </button>
                    <HeartButton active onToggle={() => onToggleFav(kind, item)} label={`Remove ${item.title}`} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </Page>
  );
}

const THEMES = [
  { value: "system", label: "Phone", Icon: DeviceMobile },
  { value: "light", label: "Light", Icon: SunHorizon },
  { value: "dark", label: "Dark", Icon: Moon },
];

const NOTIFICATION_WORDS = {
  granted: "Allowed",
  prompt: "Not asked yet. Tap to allow: you'll get a reminder the evening before and the morning of an event you add.",
  denied: "Turned off. To get reminders, allow notifications for UPCZ in your phone's settings.",
  web: "Reminders work in the app on your phone.",
  unavailable: "Reminders work in the app on your phone.",
  loading: "Checking...",
};

export function SettingsPage({ onBack, theme, reduceMotion, onToggleReduceMotion, onOpen, onDeleteMyInfo }) {
  const [confirming, setConfirming] = useState(false);
  const [notif, setNotif] = useState("loading");
  const refreshNotif = useCallback(() => {
    notificationStatus().then(setNotif);
  }, []);
  useEffect(refreshNotif, [refreshNotif]);
  useForegroundRefresh(refreshNotif);

  return (
    <Page title="Settings" onBack={onBack}>
      <h2 className="t-overline section-label">Appearance</h2>
      <div className="segmented" role="radiogroup" aria-label="Theme">
        {THEMES.map(({ value, label, Icon }) => {
          const on = theme.pref === value;
          return (
            <button key={value} type="button" role="radio" aria-checked={on} className="segment"
              onClick={() => theme.setPref(value)}>
              {on && <motion.span layoutId="segment-pill" className="segment-pill" transition={SPRING_SNAPPY} />}
              <Icon size={20} weight={on ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <p className="t-caption setting-note">
        {theme.pref === "system" ? "Follows your phone's light or dark setting." : `Always ${theme.pref}.`}
      </p>

      <h2 className="t-overline section-label">Motion</h2>
      <ul className="list">
        <li>
          <button type="button" className="list-row" role="switch" aria-checked={reduceMotion}
            onClick={() => onToggleReduceMotion(!reduceMotion)}>
            <span className="grow">
              <span className="t-body">Reduce motion</span>
              <span className="t-caption block">Gentle fades instead of movement</span>
            </span>
            <span className={`switch ${reduceMotion ? "switch-on" : ""}`} aria-hidden="true"><span className="switch-knob" /></span>
          </button>
        </li>
      </ul>

      <h2 className="t-overline section-label">Notifications</h2>
      <ul className="list">
        <li>
          {notif === "prompt" ? (
            <button type="button" className="list-row"
              onClick={async () => {
                await notificationPermission();
                setNotif(await notificationStatus());
              }}>
              <Bell size={20} className="row-icon" aria-hidden="true" />
              <span className="grow">
                <span className="t-body">Event reminders</span>
                <span className="t-caption block">{NOTIFICATION_WORDS[notif] ?? notif}</span>
              </span>
            </button>
          ) : (
            <div className="list-row static">
              <Bell size={20} className="row-icon" aria-hidden="true" />
              <span className="grow">
                <span className="t-body">Event reminders</span>
                <span className="t-caption block">{NOTIFICATION_WORDS[notif] ?? notif}</span>
              </span>
            </div>
          )}
        </li>
      </ul>
      {needsBatteryGuide() && <p className="t-caption setting-note battery-guide">{BATTERY_GUIDE}</p>}

      <h2 className="t-overline section-label">Testing</h2>
      <ul className="list">
        <li>
          <button type="button" className="list-row" onClick={() => onOpen("motion-lab")}>
            <span className="grow">
              <span className="t-body">Smoothness test</span>
              <span className="t-caption block">Animations to check on this phone</span>
            </span>
            <CaretRight size={18} className="chev" />
          </button>
        </li>
      </ul>

      <h2 className="t-overline section-label">About</h2>
      <ul className="list">
        <li className="list-row static">
          <span className="grow">
            <span className="t-body">UPCZ app</span>
            <span className="t-caption block">Version {pkg.version}</span>
          </span>
        </li>
        {PRIVACY_POLICY_URL ? (
          <li>
            <button type="button" className="list-row" onClick={() => openExternally(PRIVACY_POLICY_URL)}>
              <span className="grow"><span className="t-body">Privacy policy</span></span>
              <ArrowSquareOut size={18} className="chev" />
            </button>
          </li>
        ) : (
          <li className="list-row static">
            <span className="grow">
              <span className="t-body">Privacy policy</span>
              <span className="t-caption block">Published on the church's website with the app's release</span>
            </span>
          </li>
        )}
      </ul>

      <h2 className="t-overline section-label">Your data</h2>
      <ul className="list">
        <li>
          <button type="button" className={`list-row danger ${confirming ? "danger-armed" : ""}`}
            onClick={() => (confirming ? onDeleteMyInfo() : setConfirming(true))}>
            <Trash size={20} className="row-icon" aria-hidden="true" />
            <span className="grow">
              <span className="t-body">{confirming ? "Tap again to erase everything on this phone" : "Delete my information from this phone"}</span>
              <span className="t-caption block">Name, branch, email and saved lists — gone, and the app asks again</span>
            </span>
          </button>
        </li>
      </ul>
    </Page>
  );
}
