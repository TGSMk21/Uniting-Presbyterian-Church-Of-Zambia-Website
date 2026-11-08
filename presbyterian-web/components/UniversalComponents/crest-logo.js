// The church's crest with its motto underneath (owner's request, 2026-11-08).
// The motto is real text rather than part of the picture, so it stays sharp and
// readable at any size and takes the theme's colour. A branch that uploads its
// own logo sees that instead.

import { MOTTO, isOwnLogo } from "@/Utilities/crest.mjs";

export default function CrestLogo({ src, className = "", motto = true }) {
  if (isOwnLogo(src)) {
    return <img src={src} alt="Church logo" className={`crest-own ${className}`.trim()} />;
  }
  return (
    <span className={`crest ${className}`.trim()} role="img" aria-label={motto ? `Church crest: ${MOTTO}` : "Church crest"}>
      <img src="/crest.png" alt="" width="191" height="264" />
      {motto && (
        <span className="crest-motto" aria-hidden="true">
          <span>Nec tamen</span> <span>consumebatur</span>
        </span>
      )}
    </span>
  );
}
