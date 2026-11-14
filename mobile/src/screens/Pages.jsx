// Pages opened from the top bar (spec 8): profile, favourites and settings.
import { motion } from "motion/react";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunHorizon } from "@phosphor-icons/react/dist/csr/SunHorizon";
import Page from "./Page.jsx";
import { SPRING_SNAPPY } from "../lib/motion.js";

export function ProfilePage({ onBack }) {
  return (
    <Page title="Your profile" onBack={onBack}>
      <p className="t-callout">Your name, branch and email will be here, so the app can greet you and show your branch.</p>
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

export function SettingsPage({ onBack, theme, onOpen }) {
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
      <p className="t-caption about-line">UPCZ app, version 0.1 (Phase 0 preview)</p>
    </Page>
  );
}
