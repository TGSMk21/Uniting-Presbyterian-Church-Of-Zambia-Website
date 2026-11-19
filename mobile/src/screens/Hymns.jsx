import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { TextAa } from "@phosphor-icons/react/dist/csr/TextAa";
import Page from "./Page.jsx";
import { filterHymns, loadHymnCollections, loadHymns, sortHymns } from "../lib/hymns.js";
import { useContentData } from "../lib/useContent.js";
import { getPrefs, readJSON, writeJSON } from "../lib/storage.js";
import { useKeepAwake } from "../lib/keepAwake.js";
import { SPRING_SNAPPY } from "../lib/motion.js";
import HeartButton from "../components/HeartButton.jsx";
import { hymnFavItem, isFaved } from "../lib/favourites.js";
import { useDeviceTilt } from "../lib/tilt.js";
import { isLowEnd } from "../lib/device.js";
import { useReducedMotion } from "motion/react";

const TEXT_SCALES = [0.9, 1, 1.15, 1.3];
const TEXT_SIZE_KEY = "upcz.textSize";

export default function HymnsTab({ onOpenCollection }) {
  const loadCb = useCallback((opts) => loadHymnCollections(opts), []);
  const collections = useContentData(loadCb, undefined);
  const reduced = useReducedMotion();
  const tilt = useDeviceTilt(!reduced && !isLowEnd());
  const rows = collections.data?.collections ?? [];
  const loading = collections.status === "loading" && !collections.data;

  return (
    <>
      <header className="screen-intro">
        <h1 className="t-display">Hymns</h1>
        <p className="t-callout screen-lede">The church's hymn collections. They download once and work offline.</p>
      </header>
      {collections.source === "cache" && <p className="t-caption offline-note">You're offline — showing what was saved on this phone.</p>}
      {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
      {!loading && rows.length === 0 && (
        <div className="card empty-card">
          <p className="t-callout">{collections.source === "offline" ? "No internet right now, and no hymns saved yet." : "No hymns yet. They appear here when the church adds them."}</p>
        </div>
      )}
      <div className="collection-cards">
        {rows.map(({ collection, label, count }) => (
          <motion.button key={collection} type="button" className="card collection-card"
            whileTap={{ scale: 0.97 }} transition={SPRING_SNAPPY}
            style={tilt ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformPerspective: 900 } : undefined}
            onClick={() => onOpenCollection({ key: collection, label, count })}>
            <span className="t-headline">{label}</span>
            <span className="t-caption">{count === 0 ? "No hymns yet" : `${count} hymn${count === 1 ? "" : "s"}`}</span>
            <CaretRight size={20} className="chev" />
          </motion.button>
        ))}
      </div>
    </>
  );
}

export function HymnCollectionPage({ collection, label, onBack, onOpenHymn }) {
  const [q, setQ] = useState("");
  const loadCb = useCallback((opts) => loadHymns({ ...opts, collection }), [collection]);
  const data = useContentData(loadCb, collection);
  const rows = sortHymns(filterHymns(data.data?.hymns ?? [], q));
  const loading = data.status === "loading" && !data.data;

  return (
    <Page title={label} onBack={onBack}>
      <label className="field search-field">
        <span className="search-box">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input className="input search-input" type="search" placeholder="Search by title or number"
            value={q} onChange={(event) => setQ(event.target.value)} aria-label={`Search ${label}`} />
        </span>
      </label>
      {data.source === "cache" && <p className="t-caption offline-note">You're offline — searching what was saved on this phone.</p>}
      {loading && <div className="card home-card skeleton sk-card" aria-hidden="true" />}
      {!loading && rows.length === 0 && (
        <div className="card empty-card">
          <p className="t-callout">{q ? `No hymns match “${q.trim()}”.` : "No hymns in this collection yet."}</p>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <ul className="list">
          {rows.map((hymn, i) => (
            <motion.li key={hymn.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: Math.min(i * 0.04, 0.3) }}>
              <button type="button" className="list-row" onClick={() => onOpenHymn(hymn)}>
                <span className="hymn-number t-caption" aria-hidden="true">{hymn.number}</span>
                <span className="grow">
                  <motion.span layoutId={`hymn-title-${hymn.id}`} className="t-body block">{hymn.title}</motion.span>
                  <span className="t-caption block">{(hymn.verses ?? []).length} verse{(hymn.verses ?? []).length === 1 ? "" : "s"}{hymn.chorus ? " · chorus" : ""}</span>
                </span>
                <CaretRight size={18} className="chev" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </Page>
  );
}

export function HymnPage({ hymn, onBack, favs, onToggleFav, collectionLabel }) {
  const [prefs] = useState(() => getPrefs());
  const [sizeIndex, setSizeIndex] = useState(1);
  useEffect(() => {
    readJSON(prefs, TEXT_SIZE_KEY, 1).then((v) => {
      if (Number.isInteger(v)) setSizeIndex(Math.max(0, Math.min(TEXT_SCALES.length - 1, v)));
    });
  }, [prefs]);
  useKeepAwake(true);

  const changeSize = (delta) => {
    setSizeIndex((current) => {
      const next = Math.max(0, Math.min(TEXT_SCALES.length - 1, current + delta));
      writeJSON(prefs, TEXT_SIZE_KEY, next);
      return next;
    });
  };
  const scale = TEXT_SCALES[sizeIndex];

  return (
    <Page title={`${hymn.number}. ${hymn.title}`} onBack={onBack}>
      <div className="reader-tools">
        <span className="t-caption" aria-hidden="true"><TextAa size={16} /></span>
        <button type="button" className="icon-button text-size-button" aria-label="Smaller text" onClick={() => changeSize(-1)} disabled={sizeIndex === 0}>A−</button>
        <button type="button" className="icon-button text-size-button" aria-label="Larger text" onClick={() => changeSize(1)} disabled={sizeIndex === TEXT_SCALES.length - 1}>A+</button>
      </div>
      <article className="hymn-reader selectable" style={{ fontSize: `calc(1.25rem * ${scale})` }}>
        <div className="card-head">
          <motion.h2 layoutId={`hymn-title-${hymn.id}`} className="t-title hymn-title">{hymn.title}</motion.h2>
          <HeartButton active={isFaved(favs, "hymns", hymn.id)} onToggle={() => onToggleFav("hymns", hymnFavItem(hymn, collectionLabel))} label="Save this hymn" />
        </div>
        {hymn.notes && <p className="t-caption">{hymn.notes}</p>}
        {(hymn.verses ?? []).map((verse, i) => (
          <div key={i} className="hymn-verse">
            <span className="hymn-verse-number" aria-hidden="true">{i + 1}</span>
            <p>{verse}</p>
          </div>
        ))}
        {hymn.chorus && (
          <div className="hymn-chorus">
            <p className="t-overline">Chorus</p>
            <p>{hymn.chorus}</p>
          </div>
        )}
      </article>
    </Page>
  );
}
