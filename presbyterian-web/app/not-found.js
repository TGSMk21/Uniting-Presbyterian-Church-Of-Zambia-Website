import Link from "next/link";

export default function NotFound() {
  return (
    <main className="nat-notfound">
      <div className="nat-notfound-inner">
        <span className="nat-eyebrow">404</span>
        <h1 className="nat-h1" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
          We couldn&apos;t find <em>that page.</em>
        </h1>
        <p className="nat-lede">
          The branch or page you&apos;re looking for doesn&apos;t exist — but
          you&apos;re always welcome at one of our homes.
        </p>
        <div className="nat-hero-actions" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/find-a-branch" className="nat-link-quiet">
            Find a branch <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
