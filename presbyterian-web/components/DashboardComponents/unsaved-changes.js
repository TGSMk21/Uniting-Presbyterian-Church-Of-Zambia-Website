"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "./confirm-dialog";

// Asks before leaving a form with unsaved typing (Task 7.3): closing or reloading the
// tab (the browser's own question), and following a link inside the site (ours).
// Spread `handlers` onto the <form> and render `dialog`.
export function useUnsavedChanges() {
  const dirty = useRef(false);
  const router = useRouter();
  const [confirm, dialog] = useConfirm();

  useEffect(() => {
    function warn(event) {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    async function onClick(event) {
      if (!dirty.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      const leave = await confirm({
        title: "Leave without saving?", message: "What you've typed on this page hasn't been saved.",
        confirmLabel: "Leave", danger: true,
      });
      if (leave) {
        dirty.current = false;
        router.push(to.pathname + to.search + to.hash);
      }
    }
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [confirm, router]);

  return {
    handlers: {
      onInput: () => { dirty.current = true; },
      onChange: () => { dirty.current = true; },
      onSubmit: () => { dirty.current = false; },
    },
    dialog,
  };
}
