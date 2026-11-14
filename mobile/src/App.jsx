// The app shell (MOBILE_APP_PLAN.md, Phase 0): five tabs that keep their place, pages that
// slide over them, the Android back button, and the theme.
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { App as NativeApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { TabBar, TopBar } from "./components/Chrome.jsx";
import { AnnouncementsTab, EventsTab, HomeTab, HymnsTab, SermonsTab } from "./screens/Tabs.jsx";
import { FavouritesPage, ProfilePage, SettingsPage } from "./screens/Pages.jsx";
import MotionLab from "./screens/MotionLab.jsx";
import { TABS, back, initialNav, openPage, selectTab } from "./lib/navigation.js";
import { useTheme } from "./lib/useTheme.js";
import { isLowEnd, isNative, tap } from "./lib/device.js";
import { SPRING, TAB_ENTER, TAB_ENTER_TRANSITION } from "./lib/motion.js";

const TAB_SCREENS = {
  home: HomeTab, events: EventsTab, sermons: SermonsTab, hymns: HymnsTab, announcements: AnnouncementsTab,
};

function TabScreen({ id, active, scrollTopTick, onScrolled }) {
  const ref = useRef(null);
  const Screen = TAB_SCREENS[id];
  const reduced = useReducedMotion();

  useEffect(() => {
    if (active && scrollTopTick) ref.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [active, scrollTopTick, reduced]);

  useEffect(() => {
    if (active) onScrolled((ref.current?.scrollTop ?? 0) > 24);
  }, [active, onScrolled]);

  return (
    <motion.main
      ref={ref}
      className="screen"
      hidden={!active}
      aria-label={TABS.find((t) => t.id === id).label}
      onScroll={(event) => active && onScrolled(event.currentTarget.scrollTop > 24)}
      initial={false}
      animate={active ? TAB_ENTER.animate : TAB_ENTER.initial}
      transition={active ? TAB_ENTER_TRANSITION : { duration: 0 }}
    >
      <Screen />
    </motion.main>
  );
}

export default function App() {
  const theme = useTheme();
  const [nav, setNav] = useState(initialNav);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(nav);
  useEffect(() => { navRef.current = nav; }, [nav]);
  const reduced = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.fx = isLowEnd() ? "low" : "full";
    if (isNative()) SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  }, []);

  // Android's back button and back gesture (MOBILE_APP_PLAN.md, Phase 0).
  useEffect(() => {
    if (!isNative()) return undefined;
    const listener = NativeApp.addListener("backButton", () => {
      const step = back(navRef.current);
      if (step.leave) NativeApp.minimizeApp();
      else setNav(step.nav);
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, []);

  const choose = useCallback((tab) => {
    if (tab !== navRef.current.tab) tap();
    setNav((current) => selectTab(current, tab));
  }, []);
  const open = useCallback((page) => setNav((current) => openPage(current, page)), []);
  const close = useCallback(() => setNav((current) => back(current).nav), []);

  const page = nav.stack.at(-1);
  const covered = Boolean(page);

  return (
    <div className="app">
      <motion.div
        className="tabs-layer"
        animate={reduced ? { opacity: covered ? 0.6 : 1 } : { x: covered ? "-22%" : 0, opacity: covered ? 0.85 : 1 }}
        transition={SPRING}
        inert={covered || undefined}
      >
        {nav.visited.map((id) => (
          <TabScreen key={id} id={id} active={id === nav.tab} scrollTopTick={id === nav.tab ? nav.scrollTopTick : 0}
            onScrolled={setScrolled} />
        ))}
        <TopBar
          title={TABS.find((t) => t.id === nav.tab).label}
          scrolled={scrolled}
          onProfile={() => open("profile")}
          onFavourites={() => open("favourites")}
          onSettings={() => open("settings")}
        />
        <TabBar active={nav.tab} onSelect={choose} />
      </motion.div>

      <AnimatePresence>
        {page === "profile" && <ProfilePage key="profile" onBack={close} />}
        {page === "favourites" && <FavouritesPage key="favourites" onBack={close} />}
        {page === "settings" && <SettingsPage key="settings" onBack={close} theme={theme} onOpen={open} />}
        {page === "motion-lab" && <MotionLab key="motion-lab" onBack={close} />}
      </AnimatePresence>
    </div>
  );
}
