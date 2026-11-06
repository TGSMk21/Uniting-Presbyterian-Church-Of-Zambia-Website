import "./dashboard.css";

export const metadata = {
  title: "Staff Dashboard — Uniting Presbyterian Church In Zambia",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }) {
  return <div className="dash">{children}</div>;
}
