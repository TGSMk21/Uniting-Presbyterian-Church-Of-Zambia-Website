// The Phase 0 smoothness test (MOBILE_APP_PLAN.md): the owner runs this on the lowest-end
// phone in use. It plays the opening crest, a bottom sheet and the 3D tilt, and counts how
// many frames were drawn on time.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Page from "./Page.jsx";
import Crest from "../components/Crest.jsx";
import Sheet from "../components/Sheet.jsx";
import { summarizeFrames, verdict } from "../lib/frames.js";
import { isLowEnd } from "../lib/device.js";

// Counts frame times while something is moving.
function useFrameMeter() {
  const [result, setResult] = useState(null);
  const running = useRef(false);
  const measure = useCallback((seconds = 2.4) => {
    if (running.current) return;
    running.current = true;
    setResult(null);
    const times = [];
    let last = performance.now();
    const end = last + seconds * 1000;
    const step = (now) => {
      times.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(step);
      else {
        running.current = false;
        const summary = summarizeFrames(times.slice(1));
        globalThis.__upczFrames = summary;
        setResult(summary);
      }
    };
    requestAnimationFrame(step);
  }, []);
  return [result, measure];
}

// The crest tilts toward the finger, or with the phone, and catches a little light.
function TiltCrest() {
  const reduced = useReducedMotion();
  const off = reduced || isLowEnd();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-1, 1], [10, -10]), { stiffness: 180, damping: 22 });
  const ry = useSpring(useTransform(px, [-1, 1], [-14, 14]), { stiffness: 180, damping: 22 });
  const glareX = useTransform(px, [-1, 1], ["20%", "80%"]);
  const glareY = useTransform(py, [-1, 1], ["15%", "85%"]);
  const glare = useTransform([glareX, glareY], ([x, y]) =>
    `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.35), transparent 55%)`);

  useEffect(() => {
    if (off) return undefined;
    const tilt = (event) => {
      if (event.beta == null || event.gamma == null) return;
      px.set(Math.max(-1, Math.min(1, event.gamma / 30)));
      py.set(Math.max(-1, Math.min(1, (event.beta - 45) / 30)));
    };
    window.addEventListener("deviceorientation", tilt);
    return () => window.removeEventListener("deviceorientation", tilt);
  }, [off, px, py]);

  const follow = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    px.set(((event.clientX - box.left) / box.width) * 2 - 1);
    py.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };

  return (
    <div className="tilt-stage" onPointerMove={off ? undefined : follow}
      onPointerLeave={() => { px.set(0); py.set(0); }}>
      <motion.div className="tilt-card" style={off ? undefined : { rotateX: rx, rotateY: ry }}>
        <Crest height={150} />
        {!off && <motion.div className="tilt-glare" style={{ backgroundImage: glare }} aria-hidden="true" />}
      </motion.div>
      <p className="t-caption tilt-note">
        {off ? "Tilt is off: this phone asks for less motion, or is a lighter phone." : "Move your finger over the crest, or tilt the phone."}
      </p>
    </div>
  );
}

function Result({ result }) {
  if (!result) return <p className="t-caption lab-result">Measuring…</p>;
  return (
    <p className="t-caption lab-result" data-verdict={verdict(result)}>
      <strong>{verdict(result)}</strong> · {Math.round(result.smoothShare * 100)}% of frames on time ·
      slowest {Math.round(result.worst)} ms · about {result.fps} frames a second
    </p>
  );
}

export default function MotionLab({ onBack }) {
  const [crestRun, setCrestRun] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [crestResult, measureCrest] = useFrameMeter();
  const [sheetResult, measureSheet] = useFrameMeter();

  const replay = () => {
    setCrestRun((n) => n + 1);
    measureCrest(2.2);
  };
  const openSheet = () => {
    setSheet(true);
    measureSheet(1.4);
  };

  return (
    <Page title="Smoothness test" onBack={onBack}>
      <p className="t-callout">Try each one on this phone. Every result should read "smooth".</p>

      <h2 className="t-overline section-label">1. The opening crest</h2>
      <div className="card lab-card">
        <div className="lab-crest">{crestRun > 0 ? <Crest key={crestRun} draw height={168} /> : <Crest height={168} />}</div>
        <button type="button" className="button button-primary press" onClick={replay}>Play the opening</button>
        {crestRun > 0 && <Result result={crestResult} />}
      </div>

      <h2 className="t-overline section-label">2. A details sheet</h2>
      <div className="card lab-card">
        <button type="button" className="button button-primary press" onClick={openSheet}>Open a sheet</button>
        {sheetResult !== null || sheet ? <Result result={sheetResult} /> : null}
        <p className="t-caption">Drag it down to close, or flick it. Grab it while it moves.</p>
      </div>

      <h2 className="t-overline section-label">3. Depth</h2>
      <div className="card lab-card"><TiltCrest /></div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Youth Camp">
        <p className="t-caption">Friday 18 December · 08:00 to 17:00 · Church grounds</p>
        <p className="t-body sheet-para">
          Three days of worship, teaching and games for young people aged 12 to 25. Bring a sleeping bag,
          a Bible and a warm jacket for the evenings.
        </p>
        <button type="button" className="button button-quiet press">Add to my calendar</button>
      </Sheet>
    </Page>
  );
}
