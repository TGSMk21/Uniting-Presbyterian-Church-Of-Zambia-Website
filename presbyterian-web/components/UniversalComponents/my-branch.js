"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { branchCookie, isBranchSlug, readBranchCookie } from "@/Utilities/myBranch.mjs";

// "My branch" (owner's request, 2026-11-08): a member picks their branch once, it is
// kept in their own browser, and the main link then opens it. See Utilities/myBranch.mjs.
const CHANGED = "upcz-branch-change";
const DISMISSED = "upcz-branch-dismissed";

function subscribe(onChange) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

function useChosenBranch() {
  return useSyncExternalStore(subscribe, () => readBranchCookie(document.cookie), () => undefined);
}

function useDismissed() {
  return useSyncExternalStore(
    subscribe,
    () => { try { return window.sessionStorage.getItem(DISMISSED) === "1"; } catch { return false; } },
    () => true,
  );
}

function choose(slug) {
  if (!isBranchSlug(slug)) return;
  document.cookie = branchCookie(slug, { secure: window.location.protocol === "https:" });
  window.dispatchEvent(new Event(CHANGED));
}

function dismiss() {
  try { window.sessionStorage.setItem(DISMISSED, "1"); } catch { /* it comes back next time */ }
  window.dispatchEvent(new Event(CHANGED));
}

// A button on a branch's card in Find a Branch.
export function MakeMyBranch({ slug, name }) {
  const mine = useChosenBranch();
  if (mine === undefined) return null;
  if (mine === slug) return <span className="mybranch-mine">Your branch ✓</span>;
  return (
    <button type="button" className="mybranch-button" onClick={() => choose(slug)}>
      Make {name} my branch
    </button>
  );
}

// On a branch's page, for someone who hasn't chosen a branch yet.
export function MyBranchPrompt({ slug, name }) {
  const mine = useChosenBranch();
  const dismissed = useDismissed();
  if (mine !== null || dismissed) return null;
  return (
    <aside className="mybranch-prompt" aria-label="Choose your branch">
      <p>Is <strong>{name}</strong> your branch? We&apos;ll open it for you next time.</p>
      <div className="mybranch-prompt-actions">
        <button type="button" className="mybranch-yes" onClick={() => choose(slug)}>Yes, make it my branch</button>
        <button type="button" className="mybranch-close" onClick={dismiss} aria-label="Not now"><X size={16} aria-hidden="true" /></button>
      </div>
    </aside>
  );
}

// The thin bar at the foot of every branch page.
export function MyBranchBar({ slug, name }) {
  const mine = useChosenBranch();
  if (mine === undefined) return null;
  return (
    <div className="mybranch-bar">
      {mine === slug ? (
        <p>
          <span>{name} is your branch.</span>
          <Link href="/find-a-branch">Change branch</Link>
          <Link href="/?all=1" prefetch={false}>Church-wide site</Link>
        </p>
      ) : (
        <p>
          <button type="button" className="mybranch-button" onClick={() => choose(slug)}>Make {name} my branch</button>
          <Link href="/?all=1" prefetch={false}>Church-wide site</Link>
        </p>
      )}
    </div>
  );
}

// On the church-wide pages, for someone who hasn't chosen a branch yet.
export function BranchPicker({ branches }) {
  const mine = useChosenBranch();
  const dismissed = useDismissed();
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState("");
  if (mine !== null || dismissed || !branches?.length || pathname === "/find-a-branch") return null;
  return (
    <aside className="mybranch-prompt" aria-label="Choose your branch">
      <p>Which branch are you from? We&apos;ll open it for you next time.</p>
      <form
        className="mybranch-prompt-actions"
        onSubmit={(event) => {
          event.preventDefault();
          if (!picked) return;
          choose(picked);
          router.push(`/${picked}`);
        }}
      >
        <label className="mybranch-select">
          <span className="sr-only">Your branch</span>
          <select value={picked} onChange={(event) => setPicked(event.target.value)}>
            <option value="">Choose a branch</option>
            {branches.map((branch) => <option key={branch.slug} value={branch.slug}>{branch.name}</option>)}
          </select>
        </label>
        <button type="submit" className="mybranch-yes" disabled={!picked}>Take me there</button>
        <button type="button" className="mybranch-close" onClick={dismiss} aria-label="Not now"><X size={16} aria-hidden="true" /></button>
      </form>
    </aside>
  );
}
