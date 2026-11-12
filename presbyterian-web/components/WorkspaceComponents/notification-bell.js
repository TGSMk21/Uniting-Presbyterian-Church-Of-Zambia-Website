import Link from "next/link";
import { Bell } from "lucide-react";
import { bellLabel } from "@/Utilities/workspace.mjs";

// The bell (Task 8.2): a link to the notifications page, with the unread count.
export default function NotificationBell({ unread = 0, onClick, className = "" }) {
  return (
    <Link href="/dashboard/notifications" className={`ws-bell ${className}`.trim()} prefetch={false}
      aria-label={bellLabel(unread)} onClick={onClick}>
      <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
      {unread > 0 && <span className="ws-bell-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
