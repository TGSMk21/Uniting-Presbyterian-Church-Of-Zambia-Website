"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, Building2, FileText, History, Image as ImageIcon, KeyRound, Layers, LayoutDashboard,
  CalendarDays, LogOut, Megaphone, Menu, MessageSquareText, Network, UserPlus, Users, X,
} from "lucide-react";
import ThemeToggle from "@/components/UniversalComponents/theme-toggle";
import CrestLogo from "@/components/UniversalComponents/crest-logo";
import NotificationBell from "@/components/WorkspaceComponents/notification-bell";
import { activeHref } from "@/Utilities/dashboardNav.mjs";

const ICONS = {
  meetings: CalendarDays,
  structure: Network,
  overview: LayoutDashboard, messages: MessageSquareText, announcements: Megaphone, writings: BookOpen, content: Layers, media: ImageIcon,
  pages: FileText, staff: Users, requests: UserPlus, branches: Building2, history: History,
};

// The sidebar on computers, and a menu that slides in on phones (Task 7.3).
// The server decides which links each person gets; this only draws them.
export default function DashboardShell({ groups, person, signOut, notifications = null, children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = activeHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href)));

  // The phone menu closes when a link in it is chosen.
  const close = () => setOpen(false);

  return (
    <div className="dash-shell">
      <div className="dash-topbar">
        <Link href="/dashboard" className="dash-brand" prefetch={false}>
          <CrestLogo className="dash-crest" motto={false} />
          <span>UPCZ Staff</span>
        </Link>
        {notifications && <NotificationBell unread={notifications.unread} className="ws-bell-top" />}
        <button type="button" className="dash-menu-button" aria-expanded={open} aria-controls="dash-sidebar"
          onClick={() => setOpen((value) => !value)}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </div>

      <aside id="dash-sidebar" className="dash-sidebar" data-open={open || undefined}>
        <div className="ws-sidebar-head">
          <Link href="/dashboard" className="dash-brand dash-brand-side" prefetch={false} onClick={close}>
            <CrestLogo className="dash-crest" motto={false} />
            <span>
              <strong>UPCZ Staff</strong>
              <small>{person.place}</small>
            </span>
          </Link>
          {notifications && <NotificationBell unread={notifications.unread} className="ws-bell-side" onClick={close} />}
        </div>
        <nav aria-label="Dashboard" className="dash-sidenav">
          {groups.map((group) => (
            <div key={group.label || "main"} className="dash-sidenav-group">
              {group.label && <p className="dash-sidenav-label">{group.label}</p>}
              <ul>
                {group.items.map(({ href, label, icon }) => {
                  const Icon = ICONS[icon];
                  return (
                    <li key={href}>
                      <Link href={href} prefetch={false} aria-current={href === active ? "page" : undefined} onClick={close}>
                        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="dash-sidebar-account">
          <p className="dash-sidebar-person">
            <strong>{person.name}</strong>
            <small>{person.role}</small>
          </p>
          <Link href="/dashboard/change-password" className="dash-sidebar-action" prefetch={false} onClick={close}>
            <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" /> Change password
          </Link>
          <ThemeToggle className="dash-sidebar-action" withLabel iconSize={16} />
          <form action={signOut}>
            <button type="submit" className="dash-sidebar-action">
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      {open && <button type="button" className="dash-scrim" aria-label="Close the menu" onClick={close} />}

      <div className="dash-content">{children}</div>
    </div>
  );
}
