'use client';

import { useState } from "react";
import Link from "next/link";
import ChurchMap from "./church-map";
import {
  directionsUrl,
  filterBranches,
  hasLocation,
  sortByDistance,
  towns,
} from "@/Utilities/churchLocator";
import { formatTime } from "@/Utilities/timeFormat";

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

  // The position stays in this browser: it is only used to sort the list.
  function findNearest() {
    if (!navigator.geolocation) {
      setLocationError("Your browser can't share its location. Try searching by town instead.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("We couldn't get your location. Try searching by town instead.");
        setLocating(false);
      },
      { timeout: 10000 },
    );
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
            <li key={branch.id} className={`loc-card${branch.slug === selectedSlug ? " selected" : ""}`}>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
