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

export function FavouritesPage({ onBack }) {
  return (
    <Page title="Favourites" onBack={onBack}>
      {["Daily messages", "Daily verses", "Sermons", "Hymns"].map((section) => (
        <section key={section} aria-label={section}>
          <h2 className="t-overline section-label">{section}</h2>
          <div className="card empty-card"><p className="t-callout">Tap the heart on any {section.toLowerCase().replace(/s$/, "")} to keep it here.</p></div>
        </section>
      ))}
    </Page>
  );
}

const THEMES = [
  { value: "system", label: "Phone", Icon: DeviceMobile },
  { value: "light", label: "Light", Icon: SunHorizon },
  { value: "dark", label: "Dark", Icon: Moon },
];

function notificationStatus() {
  if (globalThis.Notification?.permission) return globalThis.Notification.permission;
  return "unavailable";
}

const NOTIFICATION_WORDS = {
  granted: "Allowed",
  denied: "Not allowed — you can change this in your phone's settings",
  default: "Not asked yet",
  unavailable: "Not available in this browser",
};

export function SettingsPage({ onBack, theme, reduceMotion, onToggleReduceMotion, onOpen, onDeleteMyInfo }) {
  const [confirming, setConfirming] = useState(false);

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
        <li className="list-row static">
          <Bell size={20} className="row-icon" aria-hidden="true" />
          <span className="grow">
            <span className="t-body">Event reminders</span>
            <span className="t-caption block">{NOTIFICATION_WORDS[notificationStatus()] ?? notificationStatus()}. You'll be asked before anything is sent.</span>
          </span>
        </li>
      </ul>

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
