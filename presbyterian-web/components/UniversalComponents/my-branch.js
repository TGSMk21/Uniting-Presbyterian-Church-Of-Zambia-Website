"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, House, X } from "lucide-react";
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

// A small chip on a branch's card in Find a Branch.
export function MakeMyBranch({ slug, name }) {
  const mine = useChosenBranch();
  if (mine === undefined) return null;
  if (mine === slug) {
    return <span className="mybranch-chip" data-mine><Check size={14} strokeWidth={2.5} aria-hidden="true" /> My branch</span>;
  }
  return (
    <button type="button" className="mybranch-chip" onClick={() => choose(slug)} aria-label={`Set ${name} as my branch`}>
      <House size={14} strokeWidth={2} aria-hidden="true" /> Set as my branch
    </button>
  );
}

function PromptCard({ title, children }) {
  return (
    <aside className="mybranch-prompt" aria-label="Choose your branch">
      <button type="button" className="mybranch-close" onClick={dismiss} aria-label="Not now"><X size={16} aria-hidden="true" /></button>
      <p className="mybranch-prompt-title">{title}</p>
      <p className="mybranch-prompt-text">We&apos;ll open it for you next time.</p>
      {children}
    </aside>
  );
}

// On a branch's page, for someone who hasn't chosen a branch yet.
export function MyBranchPrompt({ slug, name }) {
  const mine = useChosenBranch();
  const dismissed = useDismissed();
  if (mine !== null || dismissed) return null;
  return (
    <PromptCard title={<>Is <strong>{name}</strong> your branch?</>}>
      <div className="mybranch-prompt-actions">
        <button type="button" className="mybranch-yes" onClick={() => choose(slug)}>Yes, it&apos;s mine</button>
        <button type="button" className="mybranch-later" onClick={dismiss}>Not now</button>
      </div>
    </PromptCard>
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
          <span className="mybranch-bar-mine"><Check size={14} strokeWidth={2.5} aria-hidden="true" /> Your branch</span>
          <Link href="/find-a-branch">Change branch</Link>
          <Link href="/?all=1" prefetch={false}>Church-wide site</Link>
        </p>
      ) : (
        <p>
          <MakeMyBranch slug={slug} name={name} />
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
    <PromptCard title="Which branch are you from?">
      <form
        className="mybranch-pick"
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
          <ChevronDown size={16} aria-hidden="true" className="mybranch-select-arrow" />
        </label>
        <button type="submit" className="mybranch-go" disabled={!picked} aria-label="Take me there">
          <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </form>
    </PromptCard>
  );
}
