import { useCallback, useEffect, useState } from "react";
import { KEYS, getPrefs, readFlag, writeFlag } from "./storage.js";

export function useReduceMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    readFlag(getPrefs(), KEYS.reduceMotion).then((value) => {
      if (alive) setOn(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  const set = useCallback((value) => {
    writeFlag(getPrefs(), KEYS.reduceMotion, value);
    setOn(value);
  }, []);
  return [on, set];
}
