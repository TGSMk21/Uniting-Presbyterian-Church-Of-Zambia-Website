"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { ZAMBIA_CENTRE, roundPosition } from "@/Utilities/branchDetails.mjs";

const NAVY = "#182868";

// A map to click where the church is. `position` is { latitude, longitude } or null.
export default function PositionMap({ position, onPick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  function showPin(centre) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const point = [position.latitude, position.longitude];
    if (markerRef.current) markerRef.current.setLatLng(point);
    else {
      markerRef.current = L.circleMarker(point, {
        radius: 10, color: "#fff", weight: 3, fillColor: NAVY, fillOpacity: 1,
      }).addTo(map);
    }
    // A click is always in view; a typed or saved position may not be.
    if (centre || !map.getBounds().contains(point)) map.setView(point, Math.max(map.getZoom(), 16));
  }

  // Leaflet needs `window`, so it can only be loaded in the browser.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || mapRef.current || !containerRef.current) return;
      leafletRef.current = L;
      // Scrolling the form over the map should scroll the page, not zoom the map.
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(ZAMBIA_CENTRE, 6);
      mapRef.current = map;
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      map.on("click", (event) => {
        onPickRef.current?.({
          latitude: roundPosition(event.latlng.lat),
          longitude: roundPosition(event.latlng.lng),
        });
      });
      showPin(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    showPin(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  return <div ref={containerRef} className="dash-map" role="region" aria-label="Map: click where the church is" />;
}
