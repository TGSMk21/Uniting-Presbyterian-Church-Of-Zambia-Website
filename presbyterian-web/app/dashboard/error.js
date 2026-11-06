"use client";

// A full reload, because Next's reset() only re-renders and wouldn't ask the API again.
export default function DashboardError() {
  return (
    <main className="dash-center">
      <div className="dash-card" role="alert">
        <h1 className="dash-title">We can&apos;t reach the dashboard right now</h1>
        <p className="dash-text">
          You haven&apos;t been signed out and nothing has been lost. Please try again in a moment.
        </p>
        <button type="button" className="btn-primary dash-submit" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </main>
  );
}
