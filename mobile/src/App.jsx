import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { App as NativeApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { TabBar, TopBar } from "./components/Chrome.jsx";
import Sheet from "./components/Sheet.jsx";

// Screens load on first use, so the app starts fast on low-end phones.
const HomeTab = lazy(() => import("./screens/Home.jsx"));
const EventsTab = lazy(() => import("./screens/Events.jsx"));
const SermonsTab = lazy(() => import("./screens/Sermons.jsx"));
const HymnsTab = lazy(() => import("./screens/Hymns.jsx").then((m) => ({ default: m.default })));
const AnnouncementsTab = lazy(() => import("./screens/Announcements.jsx"));
const { HymnCollectionPage, HymnPage } = { HymnCollectionPage: lazy(() => import("./screens/Hymns.jsx").then((m) => ({ default: m.HymnCollectionPage }))), HymnPage: lazy(() => import("./screens/Hymns.jsx").then((m) => ({ default: m.HymnPage }))) };
const { FavouritesPage, ProfilePage, SettingsPage } = {
  FavouritesPage: lazy(() => import("./screens/Pages.jsx").then((m) => ({ default: m.FavouritesPage }))),
  ProfilePage: lazy(() => import("./screens/Pages.jsx").then((m) => ({ default: m.ProfilePage }))),
  SettingsPage: lazy(() => import("./screens/Pages.jsx").then((m) => ({ default: m.SettingsPage }))),
};
const MotionLab = lazy(() => import("./screens/MotionLab.jsx"));
const Opening = lazy(() => import("./screens/Opening.jsx"));
const FirstRun = lazy(() => import("./screens/FirstRun.jsx"));
const MessagePage = lazy(() => import("./screens/MessagePage.jsx"));
const SermonPage = lazy(() => import("./screens/SermonPage.jsx"));
const EventBody = lazy(() => import("./screens/Events.jsx").then((m) => ({ default: m.EventBody })));
const AnnouncementBody = lazy(() => import("./screens/Announcements.jsx").then((m) => ({ default: m.AnnouncementBody })));
import { useHome } from "./lib/useHome.js";
import { useResource } from "./lib/useResource.js";
import { announcementsResource, eventsResource } from "./lib/resources.js";
import { appStore } from "./lib/appStore.js";
import { removeLegacyCaches } from "./lib/blobStore.js";
import { useForegroundRefresh } from "./lib/useContent.js";
import { READ_ANNOUNCEMENTS, markRead, readMarks as readStoredMarks, unreadCount } from "./lib/marks.js";
import { emptyFavs, readFavs, toggleFav } from "./lib/favourites.js";
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

function TabScreen({ id, active, scrollTopTick, onScrolled, profile, onOpenProfile, home, onOpenMessage, onOpenSermon, onOpenEvent, announcements, readMarks, onOpenAnnouncement, onOpenCollection, favs, onToggleFav, onSelectTab, onPullRefresh, refreshing }) {
  const ref = useRef(null);
  const Screen = TAB_SCREENS[id];
  const reduced = useReducedMotion();
  const [pull, setPull] = useState(0);
  const touchY = useRef(null);

  useEffect(() => {
    if (active && scrollTopTick) ref.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [active, scrollTopTick, reduced]);

  useEffect(() => {
    if (active) onScrolled((ref.current?.scrollTop ?? 0) > 24);
  }, [active, onScrolled]);

  const onTouchStart = (event) => {
    if (onPullRefresh && ref.current?.scrollTop === 0) touchY.current = event.touches[0].clientY;
  };
  const onTouchMove = (event) => {
    if (touchY.current == null) return;
    const delta = event.touches[0].clientY - touchY.current;
    if (delta > 0 && (ref.current?.scrollTop ?? 0) <= 0) setPull(Math.min(delta, 96));
    else setPull(0);
  };
  const onTouchEnd = () => {
    if (touchY.current != null && pull > 72) onPullRefresh?.();
    touchY.current = null;
    setPull(0);
  };

  return (
    <motion.main
      ref={ref}
      className="screen"
      hidden={!active}
      aria-label={TABS.find((t) => t.id === id).label}
      onScroll={(event) => active && onScrolled(event.currentTarget.scrollTop > 24)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      initial={false}
      animate={active ? TAB_ENTER.animate : TAB_ENTER.initial}
      transition={active ? TAB_ENTER_TRANSITION : { duration: 0 }}
    >
      {onPullRefresh && (
        <div className="pull-indicator" style={{ height: pull > 4 ? 40 : 0, opacity: Math.min(pull / 72, 1) }} aria-hidden="true">
          <ArrowsClockwise size={18} className={refreshing ? "spin" : ""} />
        </div>
      )}
      <Screen profile={profile} onOpenProfile={onOpenProfile} home={home}
        onOpenMessage={onOpenMessage} onOpenSermon={onOpenSermon} onOpenEvent={onOpenEvent}
        data={id === "announcements" ? announcements.data : undefined}
        status={id === "announcements" ? announcements.status : undefined}
        source={id === "announcements" ? announcements.source : undefined}
        readMarks={readMarks} onOpenAnnouncement={onOpenAnnouncement} onOpenCollection={onOpenCollection}
        favs={favs} onToggleFav={onToggleFav} onSelectTab={onSelectTab} />
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
  const [message, setMessage] = useState(null);
  const [sermon, setSermon] = useState(null);
  const [event, setEvent] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [collection, setCollection] = useState(null);
  const [hymn, setHymn] = useState(null);
  const [verseFav, setVerseFav] = useState(null);
  const [favs, setFavs] = useState(emptyFavs());
  const home = useHome(profile.branchSlug);
  const branch = profile.branchSlug || null;
  const announcements = useResource(branch ? announcementsResource(branch) : null);
  // One foreground listener for the whole app: refresh whatever screens are watching.
  useForegroundRefresh(useCallback(() => appStore.refreshWatched(), []));
  const [marksPrefs] = useState(() => getPrefs());
  const [readMarks, setReadMarks] = useState([]);
  useEffect(() => {
    readStoredMarks(marksPrefs, READ_ANNOUNCEMENTS).then(setReadMarks);
  }, [marksPrefs, profile.branchSlug]);
  const unread = unreadCount(announcements.data?.announcements ?? [], readMarks);
  const openAnnouncement = useCallback((item) => {
    setAnnouncement(item);
    markRead(marksPrefs, READ_ANNOUNCEMENTS, item.id).then(setReadMarks);
  }, [marksPrefs]);
  const navRef = useRef(nav);
  const stageRef = useRef(stage);
  const messageRef = useRef(message);
  const sermonRef = useRef(sermon);
  const eventRef = useRef(event);
  const announcementRef = useRef(announcement);
  const collectionRef = useRef(collection);
  const hymnRef = useRef(hymn);
  useEffect(() => { navRef.current = nav; }, [nav]);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { messageRef.current = message; }, [message]);
  useEffect(() => { sermonRef.current = sermon; }, [sermon]);
  useEffect(() => { eventRef.current = event; }, [event]);
  useEffect(() => { announcementRef.current = announcement; }, [announcement]);
  useEffect(() => { collectionRef.current = collection; }, [collection]);
  useEffect(() => { hymnRef.current = hymn; }, [hymn]);
  useEffect(() => {
    readFavs(marksPrefs).then(setFavs);
  }, [marksPrefs, profile.branchSlug]);
  const toggleFavHandler = useCallback(async (kind, item) => {
    const result = await toggleFav(marksPrefs, kind, item);
    setFavs(result.favs);
  }, [marksPrefs]);
  const verseFavRef = useRef(verseFav);
  useEffect(() => { verseFavRef.current = verseFav; }, [verseFav]);
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

  // Once ever: drop the old content caches that used to live in Preferences/localStorage.
  useEffect(() => {
    const prefs = getPrefs();
    readFlag(prefs, "upcz.cacheV2").then(async (done) => {
      if (done) return;
      await removeLegacyCaches().catch(() => {});
      await writeFlag(prefs, "upcz.cacheV2", true).catch(() => {});
    });
  }, []);

  // A tap on a reminder opens its event sheet (looked up in the branch's saved events).
  const pendingNotifEventRef = useRef(null);
  useEffect(() => {
    if (stage === MODES.app && pendingNotifEventRef.current) {
      setEvent(pendingNotifEventRef.current);
      pendingNotifEventRef.current = null;
    }
  }, [stage]);

  useEffect(() => {
    if (!isNative()) return undefined;
    const listener = LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const extra = action.notification?.extra ?? {};
      if (extra.eventId == null || !extra.branchSlug) return;
      (async () => {
        const entry = await appStore.load(eventsResource(extra.branchSlug));
        const found = entry.data?.events?.find((e) => String(e.id) === String(extra.eventId));
        if (!found) return;
        if (stageRef.current !== MODES.app) pendingNotifEventRef.current = found;
        else setEvent(found);
      })();
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, []);

  useEffect(() => {
    if (!isNative()) return undefined;
    const listener = NativeApp.addListener("backButton", () => {
      if (stageRef.current !== MODES.app) {
        NativeApp.minimizeApp();
        return;
      }
      if (messageRef.current) {
        setMessage(null);
        return;
      }
      if (sermonRef.current) {
        setSermon(null);
        return;
      }
      if (eventRef.current) {
        setEvent(null);
        return;
      }
      if (announcementRef.current) {
        setAnnouncement(null);
        return;
      }
      if (hymnRef.current) {
        setHymn(null);
        return;
      }
      if (collectionRef.current) {
        setCollection(null);
        return;
      }
      if (verseFavRef.current) {
        setVerseFav(null);
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

  const page = nav.stack.at(-1);
  const covered = Boolean(page);

  return (
    <Suspense fallback={<div className="app" aria-busy="true" />}>
    <AnimatePresence mode="wait">
      {stage === "loading" && (
        <motion.div key="loading" className="app" aria-busy="true"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      )}
      {stage === MODES.opening && (
        <Opening key="opening" quick={gate.seenOpening} onDone={finishOpening} />
      )}
      {stage === MODES.firstRun && (
        <FirstRun key="first-run" onDone={finishFirstRun} />
      )}
      {stage === MODES.app && (
    <motion.div key="app" className="app"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Suspense fallback={null}>
      <motion.div
        className="tabs-layer"
        animate={reduced ? { opacity: covered ? 0.6 : 1 } : { x: covered ? "-22%" : 0, opacity: covered ? 0.85 : 1 }}
        transition={SPRING}
        inert={covered || undefined}
      >
        {nav.visited.map((id) => (
          <TabScreen key={`${id}-${profileVersion}`} id={id} active={id === nav.tab}
            scrollTopTick={id === nav.tab ? nav.scrollTopTick : 0}
            onScrolled={setScrolled} profile={profile} onOpenProfile={() => open("profile")}
            home={home} onOpenMessage={setMessage} onOpenSermon={setSermon} onOpenEvent={setEvent}
            announcements={announcements} readMarks={readMarks} onOpenAnnouncement={openAnnouncement} onOpenCollection={setCollection}
            favs={favs} onToggleFav={toggleFavHandler} onSelectTab={choose}
            onPullRefresh={id === "home" ? home.pullRefresh : undefined}
            refreshing={id === "home" && home.status === "refreshing"} />
        ))}
        <TopBar
          title={TABS.find((t) => t.id === nav.tab).label}
          scrolled={scrolled}
          initial={initialOf(profile.name)}
          onProfile={() => open("profile")}
          onFavourites={() => open("favourites")}
          onSettings={() => open("settings")}
        />
        <TabBar active={nav.tab} onSelect={choose} badges={{ announcements: unread }} />
      </motion.div>

      <AnimatePresence>
        {page === "profile" && <ProfilePage key="profile" onBack={close} profile={profile} onSave={saveProfile} />}
        {page === "favourites" && (
          <FavouritesPage key="favourites" onBack={close} favs={favs} onToggleFav={toggleFavHandler}
            onOpenMessage={setMessage} onOpenSermon={setSermon}
            onOpenHymn={setHymn} onOpenVerse={setVerseFav} />
        )}
        {page === "settings" && (
          <SettingsPage key="settings" onBack={close} theme={theme} onOpen={open}
            reduceMotion={reduceMotion} onToggleReduceMotion={onToggleReduceMotion}
            onDeleteMyInfo={deleteMyInfo} />
        )}
        {page === "motion-lab" && <MotionLab key="motion-lab" onBack={close} />}
        {message && <MessagePage key="message" message={message} onBack={() => setMessage(null)} />}
        {sermon && <SermonPage key="sermon" sermon={sermon} onBack={() => setSermon(null)} favs={favs} onToggleFav={toggleFavHandler} />}
        {collection && (
          <HymnCollectionPage key="hymn-collection" collection={collection.key} label={collection.label}
            onBack={() => setCollection(null)} onOpenHymn={setHymn} />
        )}
        {hymn && <HymnPage key="hymn" hymn={hymn} onBack={() => setHymn(null)} favs={favs} onToggleFav={toggleFavHandler} collectionLabel={collection?.label} />}
      </AnimatePresence>

      <Sheet open={Boolean(event)} onClose={() => setEvent(null)} title={event?.title ?? "Event"} titleLayoutId={event ? `event-title-${event.id}` : undefined}>
        {event && <EventBody event={event} branchSlug={profile.branchSlug} />}
      </Sheet>
      <Sheet open={Boolean(announcement)} onClose={() => setAnnouncement(null)} title={announcement?.title ?? "Announcement"} titleLayoutId={announcement ? `announcement-title-${announcement.id}` : undefined}>
        {announcement && <AnnouncementBody announcement={announcement} />}
      </Sheet>
      <Sheet open={Boolean(verseFav)} onClose={() => setVerseFav(null)} title={verseFav?.ref || "Daily verse"}>
        {verseFav && (
          <article className="message-article selectable">
            <p className="t-body">{verseFav.text}</p>
            <p className="t-caption message-ref">{verseFav.ref}</p>
          </article>
        )}
      </Sheet>
      </Suspense>
    </motion.div>
      )}
    </AnimatePresence>
    </Suspense>
  );
}
