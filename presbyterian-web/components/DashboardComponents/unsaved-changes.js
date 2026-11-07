"use client";

import { useEffect, useRef } from "react";

// Asks before closing or reloading the tab while a form has unsaved typing (Task 7.3).
// Spread the returned handlers onto the <form>.
export function useUnsavedChanges() {
  const dirty = useRef(false);
  useEffect(() => {
    function warn(event) {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return {
    onInput: () => { dirty.current = true; },
    onChange: () => { dirty.current = true; },
    onSubmit: () => { dirty.current = false; },
  };
}
