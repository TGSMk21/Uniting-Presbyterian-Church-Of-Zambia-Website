'use client';

import { useEffect, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import Link from "next/link";
import ChurchMap from "./church-map";
import {
  directionsUrl,
  filterBranches,
  hasLocation,
  nearestBranch,
  sortByDistance,
  towns,
} from "@/Utilities/churchLocator";
import { formatTime } from "@/Utilities/timeFormat";
import { locate, locationMessage } from "@/Utilities/locate.mjs";
import { MakeMyBranch } from "@/components/UniversalComponents/my-branch";

export default function ChurchLocator({ branches }) {
  const [query, setQuery] = useState("");
  const [town, setTown] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [selectedSlug, setSelectedSlug] = useState(null);

  const matches = filterBranches(branches, query, town);
  const results = userLocation ? sortByDistance(matches, userLocation) : matches;
  const anyApproximate = results.some((b) => hasLocation(b) && !b.location_confirmed);
  const nearest = nearestBranch(matches, userLocation);
  const nearestRef = useRef(null);
  const [justFound, setJustFound] = useState(0);

  // Once found, the nearest branch comes into view and takes focus, so it's the
  // first thing seen (and read out by screen readers).
  useEffect(() => {
    if (!justFound) return;
    const card = nearestRef.current;
    if (!card) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    nearestRef.current?.focus({ preventScroll: true });
  }, [justFound]);

  // The position stays in this browser: it is only used to sort the list.
  async function findNearest() {
    setLocating(true);
    setLocationError("");
    try {
      setUserLocation(await locate(navigator.geolocation));
      setJustFound((count) => count + 1);
    } catch (error) {
      setLocationError(locationMessage(error?.code));
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="loc-layout">
      <div className="loc-search-area">
        <div className="loc-controls">
          <label className="form-label" htmlFor="loc-search">Search by name or area</label>
          <input
            id="loc-search"
            className="form-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Kabwata or Livingstone"
          />
          <label className="form-label" htmlFor="loc-town">Town</label>
          <select id="loc-town" className="form-input" value={town} onChange={(e) => setTown(e.target.value)}>
            <option value="">All towns</option>
            {towns(branches).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" className="btn-ghost loc-near" onClick={findNearest} disabled={locating}>
            {locating ? "Finding you..." : "Find the nearest to me"}
          </button>
          {locationError && <p className="loc-error" role="alert">{locationError}</p>}
          {userLocation && !nearest && (
            <p className="loc-error" role="status">None of the branches shown have a map location yet. Try searching by town.</p>
          )}
          {nearest && (
            <section key={`${nearest.slug}-${justFound}`} ref={nearestRef} tabIndex={-1} className="loc-nearest" aria-label="Nearest branch to you">
              <p className="loc-nearest-label"><Navigation size={13} strokeWidth={2.5} aria-hidden="true" /> Nearest to you</p>
              <h2 className="loc-nearest-name">{nearest.name}</h2>
              <p className="loc-nearest-meta">
                About {Math.max(1, Math.round(nearest.distanceKm))} km away{nearest.address ? ` · ${nearest.address}` : ""}
              </p>
              <div className="loc-nearest-actions">
                <Link href={`/${nearest.slug}`} className="loc-nearest-visit">Visit this branch</Link>
                <a href={directionsUrl(nearest)} target="_blank" rel="noopener noreferrer">Directions</a>
              </div>
              <MakeMyBranch slug={nearest.slug} name={nearest.name} />
            </section>
          )}
        </div>

        <p className="loc-count" aria-live="polite">
          {results.length} {results.length === 1 ? "branch" : "branches"}
          {userLocation ? ", nearest first" : ""}
        </p>
        {anyApproximate && (
          <p className="loc-note">Pins show the general area until each branch confirms its exact location.</p>
        )}
      </div>

      <div className="loc-map-area">
        <ChurchMap
          branches={results}
          selectedSlug={selectedSlug}
          userLocation={userLocation}
          nearestSlug={nearest?.slug}
          onSelect={setSelectedSlug}
        />
      </div>

      <div className="loc-list-area">
        {results.length === 0 && (
          <p className="nat-index-empty">
            {branches.length === 0 ? "No branches listed yet." : "No branches match your search."}
          </p>
        )}
        <ul className="loc-list">
          {results.map((branch) => (
            <li key={branch.id} className={`loc-card${branch.slug === selectedSlug ? " selected" : ""}`}
              data-nearest={branch.slug === nearest?.slug || undefined}>
              {branch.slug === nearest?.slug && <span className="loc-card-nearest">Nearest</span>}
              <button type="button" className="loc-card-name" onClick={() => setSelectedSlug(branch.slug)}>
                {branch.name}
              </button>
              {branch.address && <p className="loc-card-text">{branch.address}</p>}
              {branch.distanceKm != null && (
                <p className="loc-card-text">About {Math.round(branch.distanceKm)} km away</p>
              )}
              {branch.service_times?.map((s) => (
                <p key={s.id} className="loc-card-text">{s.day} · {formatTime(s.start_time)}</p>
              ))}
              {branch.contact_phone && (
                <p className="loc-card-text">
                  <a href={`tel:${branch.contact_phone.replace(/\s/g, "")}`}>{branch.contact_phone}</a>
                </p>
              )}
              <div className="loc-card-links">
                <Link href={`/${branch.slug}`}>Visit this branch</Link>
                <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer">Directions</a>
              </div>
              <MakeMyBranch slug={branch.slug} name={branch.name} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
