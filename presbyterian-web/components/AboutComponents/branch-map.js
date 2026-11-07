"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

const NAVY = "#142850";
const APPROXIMATE_RADIUS_M = 600;

// The branch's own map on its About page. `view` comes from branchMapView().
export default function BranchMap({ name, view, directionsHref }) {
  const containerRef = useRef(null);

  // Leaflet needs `window`, so it can only be loaded in the browser.
  useEffect(() => {
    let map;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      // Scrolling or swiping down the page shouldn't get caught by the map.
      map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
        tap: false,
      }).setView(view.centre, view.zoom);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      if (view.exact) {
        L.circleMarker(view.centre, { radius: 11, color: "#fff", weight: 3, fillColor: NAVY, fillOpacity: 1 })
          .bindTooltip(name, { permanent: true, direction: "top", offset: [0, -12] })
          .addTo(map);
      } else {
        L.circle(view.centre, {
          radius: APPROXIMATE_RADIUS_M, color: NAVY, weight: 2, fillColor: NAVY, fillOpacity: 0.15,
        }).addTo(map);
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [name, view.centre[0], view.centre[1], view.zoom, view.exact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="branch-map">
      <div
        ref={containerRef}
        className="branch-map-canvas"
        role="region"
        aria-label={view.exact ? `Map showing where ${name} is` : `Map showing the area around ${name}`}
      />
      <div className="branch-map-bar">
        {!view.exact && <span className="branch-map-note">Approximate area</span>}
        <a href={directionsHref} target="_blank" rel="noopener noreferrer" className="branch-map-button">
          Get directions
        </a>
      </div>
    </div>
  );
}
