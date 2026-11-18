import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { App as NativeApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { TabBar, TopBar } from "./components/Chrome.jsx";
import { AnnouncementsTab, EventsTab, HomeTab, HymnsTab, SermonsTab } from "./screens/Tabs.jsx";
import { FavouritesPage, ProfilePage, SettingsPage } from "./screens/Pages.jsx";
import MotionLab from "./screens/MotionLab.jsx";
import Opening from "./screens/Opening.jsx";
import FirstRun from "./screens/FirstRun.jsx";
import { TABS, back, initialNav, openPage, selectTab } from "./lib/navigation.js";
import { useTheme } from "./lib/useTheme.js";
import { useReduceMotion } from "./lib/useSettings.js";
import { isLowEnd, isNative, tap } from "./lib/device.js";
import { SPRING, TAB_ENTER, TAB_ENTER_TRANSITION } from "./lib/motion.js";
import { KEYS, getPrefs, readFlag, readJSON, removeKey, writeFlag, writeJSON } from "./lib/storage.js";
import { emptyProfile, initialOf } from "./lib/profile.js";
import { MODES, completeFirstRun, completeOpening, initialMode } from "./lib/gate.js";

const TAB_SCREENS = {
  home: HomeTab, events: EventsTab, sermons: SermonsTab, hymns: HymnsTab, announcements: AnnouncementsTab,
};

function TabScreen({ id, active, scrollTopTick, onScrolled, profile, onOpenProfile }) {
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
      <Screen profile={profile} onOpenProfile={onOpenProfile} />
    </motion.main>
  );
}

export default function App() {
  const [reduceMotion, setReduceMotion] = useReduceMotion();
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <Shell reduceMotion={reduceMotion} onToggleReduceMotion={setReduceMotion} />
    </MotionConfig>
  );
}

function Shell({ reduceMotion, onToggleReduceMotion }) {
  const theme = useTheme();
  const [stage, setStage] = useState("loading");
  const [gate, setGate] = useState({ seenOpening: false, firstRunDone: false });
  const [profile, setProfile] = useState(emptyProfile());
  const [profileVersion, setProfileVersion] = useState(0);
  const [nav, setNav] = useState(initialNav);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(nav);
  const stageRef = useRef(stage);
  useEffect(() => { navRef.current = nav; }, [nav]);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  const reduced = useReducedMotion();

  useEffect(() => {
    let alive = true;
    const prefs = getPrefs();
    Promise.all([
      readFlag(prefs, KEYS.seenOpening),
      readFlag(prefs, KEYS.firstRunDone),
      readJSON(prefs, KEYS.profile, emptyProfile()),
    ]).then(([seenOpening, firstRunDone, saved]) => {
      if (!alive) return;
      setGate({ seenOpening, firstRunDone });
      setProfile(saved);
      setStage(MODES.opening);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fx = isLowEnd() ? "low" : "full";
    if (isNative()) SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNative()) return undefined;
    const listener = NativeApp.addListener("backButton", () => {
      if (stageRef.current !== MODES.app) {
        NativeApp.minimizeApp();
        return;
      }
      const step = back(navRef.current);
      if (step.leave) NativeApp.minimizeApp();
      else setNav(step.nav);
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, []);

  const finishOpening = useCallback(async () => {
    const next = completeOpening(gate);
    await writeFlag(getPrefs(), KEYS.seenOpening, true).catch(() => {});
    setGate(next);
    setStage(initialMode(next));
  }, [gate]);

  const finishFirstRun = useCallback(async (saved) => {
    const next = completeFirstRun(gate, saved);
    const prefs = getPrefs();
    await Promise.all([
      writeFlag(prefs, KEYS.firstRunDone, true),
      writeJSON(prefs, KEYS.profile, saved),
    ]).catch(() => {});
    setGate(next);
    setProfile(saved);
    setProfileVersion((v) => v + 1);
    setStage(MODES.app);
  }, [gate]);

  const saveProfile = useCallback(async (saved) => {
    await writeJSON(getPrefs(), KEYS.profile, saved).catch(() => {});
    setProfile(saved);
    setProfileVersion((v) => v + 1);
  }, []);

  const deleteMyInfo = useCallback(async () => {
    const prefs = getPrefs();
    await Promise.all([
      removeKey(prefs, KEYS.profile),
      removeKey(prefs, KEYS.branches),
      writeFlag(prefs, KEYS.firstRunDone, false),
    ]).catch(() => {});
    setGate((current) => ({ ...current, firstRunDone: false }));
    setProfile(emptyProfile());
    setNav(initialNav());
    setStage(MODES.firstRun);
  }, []);

  const choose = useCallback((tab) => {
    if (tab !== navRef.current.tab) tap();
    setNav((current) => selectTab(current, tab));
  }, []);
  const open = useCallback((page) => setNav((current) => openPage(current, page)), []);
  const close = useCallback(() => setNav((current) => back(current).nav), []);

  if (stage === "loading") return <div className="app" aria-busy="true" />;
  if (stage === MODES.opening) return <Opening quick={gate.seenOpening} onDone={finishOpening} />;
  if (stage === MODES.firstRun) return <FirstRun onDone={finishFirstRun} />;

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
          <TabScreen key={`${id}-${profileVersion}`} id={id} active={id === nav.tab}
            scrollTopTick={id === nav.tab ? nav.scrollTopTick : 0}
            onScrolled={setScrolled} profile={profile} onOpenProfile={() => open("profile")} />
        ))}
        <TopBar
          title={TABS.find((t) => t.id === nav.tab).label}
          scrolled={scrolled}
          initial={initialOf(profile.name)}
          onProfile={() => open("profile")}
          onFavourites={() => open("favourites")}
          onSettings={() => open("settings")}
        />
        <TabBar active={nav.tab} onSelect={choose} />
      </motion.div>

      <AnimatePresence>
        {page === "profile" && <ProfilePage key="profile" onBack={close} profile={profile} onSave={saveProfile} />}
        {page === "favourites" && <FavouritesPage key="favourites" onBack={close} />}
        {page === "settings" && (
          <SettingsPage key="settings" onBack={close} theme={theme} onOpen={open}
            reduceMotion={reduceMotion} onToggleReduceMotion={onToggleReduceMotion}
            onDeleteMyInfo={deleteMyInfo} />
        )}
        {page === "motion-lab" && <MotionLab key="motion-lab" onBack={close} />}
      </AnimatePresence>
    </div>
  );
}
