import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import BranchPicker from "../components/BranchPicker.jsx";
import { loadBranches } from "../lib/api.js";
import { emptyProfile, profileErrors, profileFromForm } from "../lib/profile.js";
import { FADE, SPRING } from "../lib/motion.js";
import { getPrefs } from "../lib/storage.js";

export default function FirstRun({ onDone }) {
  const reduced = useReducedMotion();
  const prefs = useRef(getPrefs()).current;
  const [branchState, setBranchState] = useState({ status: "loading", branches: [], source: "api" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branchSlug, setBranchSlug] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const result = await loadBranches({ prefs });
    setBranchState({ status: "ready", ...result });
  }, [prefs]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = () => {
    const profile = profileFromForm({ name, branchSlug, email });
    const errors = profileErrors(profile);
    if (errors.email) {
      setError(errors.email);
      return;
    }
    onDone(profile);
  };

  const skip = () => onDone(emptyProfile());

  return (
    <motion.main
      className="first-run"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
      transition={reduced ? FADE : SPRING}
    >
      <header className="screen-intro">
        <p className="t-overline">Welcome</p>
        <h1 className="t-display">Welcome to the UPCZ app.</h1>
        <p className="t-callout screen-lede">
          Tell us your name and your congregation, and the app will show your church's news, sermons and events.
        </p>
      </header>

      <div className="form">
        <label className="field">
          <span className="field-label">Your name</span>
          <input className="input" type="text" autoComplete="name" placeholder="e.g. Mary Banda"
            value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <BranchPicker
          status={branchState.status}
          branches={branchState.branches}
          source={branchState.source}
          onRetry={load}
          value={branchSlug}
          onChange={setBranchSlug}
        />

        <label className="field">
          <span className="field-label">Email <span className="field-optional">(optional)</span></span>
          <input className="input" type="email" autoComplete="email" placeholder="you@example.org"
            value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} />
          <span className="field-hint">So the church can send you news, if you want. It stays on this phone — nothing is sent anywhere.</span>
          {error && <span className="field-error" role="alert">{error}</span>}
        </label>
      </div>

      <div className="form-actions">
        <button type="button" className="button button-primary form-continue" onClick={submit}>Continue</button>
        <button type="button" className="button button-quiet" onClick={skip}>Skip for now</button>
        <p className="t-caption form-skip-note">You can set all of this later, any time, from your profile.</p>
      </div>
    </motion.main>
  );
}
