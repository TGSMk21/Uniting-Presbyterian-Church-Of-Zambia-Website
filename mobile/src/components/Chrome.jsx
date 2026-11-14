// The app's frame: the top bar (profile, favourites, settings) and the five-tab bar
// (MOBILE_APP_PLAN.md, spec 8). Labels are always shown, so nothing is hidden.
import { motion } from "motion/react";
import { BookOpenText } from "@phosphor-icons/react/dist/csr/BookOpenText";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { MegaphoneSimple } from "@phosphor-icons/react/dist/csr/MegaphoneSimple";
import { MusicNotes } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { User } from "@phosphor-icons/react/dist/csr/User";
import { TABS } from "../lib/navigation.js";
import { SPRING_TAB } from "../lib/motion.js";

const TAB_ICONS = {
  home: House, events: CalendarDots, sermons: BookOpenText, hymns: MusicNotes, announcements: MegaphoneSimple,
};

export function TopBar({ title, scrolled, initial, onProfile, onFavourites, onSettings }) {
  return (
    <header className="top-bar" data-scrolled={scrolled || undefined}>
      <button type="button" className="icon-button avatar-button" onClick={onProfile} aria-label="Your profile">
        <span className="avatar" aria-hidden="true">{initial || <User size={18} weight="bold" />}</span>
      </button>
      <span className="top-bar-title" aria-hidden={!scrolled}>{title}</span>
      <div className="top-bar-actions">
        <button type="button" className="icon-button" onClick={onFavourites} aria-label="Favourites">
          <Heart size={24} />
        </button>
        <button type="button" className="icon-button" onClick={onSettings} aria-label="Settings">
          <GearSix size={24} />
        </button>
      </div>
    </header>
  );
}

export function TabBar({ active, onSelect }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map(({ id, label }) => {
        const Icon = TAB_ICONS[id];
        const on = id === active;
        return (
          <button key={id} type="button" className="tab" aria-current={on ? "page" : undefined}
            onClick={() => onSelect(id)}>
            <span className="tab-icon">
              {on && <motion.span layoutId="tab-pill" className="tab-pill" transition={SPRING_TAB} />}
              <Icon size={24} weight={on ? "fill" : "regular"} />
            </span>
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
