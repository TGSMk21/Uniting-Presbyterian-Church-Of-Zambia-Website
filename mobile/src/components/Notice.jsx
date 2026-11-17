export default function Notice({ kind = "info", children, action }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <p className="t-callout">{children}</p>
      {action}
    </div>
  );
}
