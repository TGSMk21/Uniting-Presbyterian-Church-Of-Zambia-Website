// The one shared "offline / saved / waking up" line under a screen's heading.
// Renders one caption line, or nothing at all.
export default function SavedNote({ entry, onRetry }) {
  if (!entry) return null;
  if (entry.status === "loading" && entry.error === "slow") {
    return (
      <p className="t-caption offline-note">
        The church's server is waking up. This can take up to a minute the first time.
      </p>
    );
  }
  if (entry.source === "cache" && entry.error === "unreachable") {
    return (
      <p className="t-caption offline-note">
        Couldn't reach the church's server. Showing what was saved on this phone.
      </p>
    );
  }
  if (entry.source === "offline") {
    return (
      <p className="t-caption offline-note">
        Couldn't reach the church's server, and nothing is saved on this phone yet.{" "}
        {onRetry && (
          <button type="button" className="button button-quiet notice-action" onClick={onRetry}>Try again</button>
        )}
      </p>
    );
  }
  return null;
}
