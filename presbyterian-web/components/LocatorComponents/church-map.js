'use client';

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { hasLocation } from "@/Utilities/churchLocator";

const ZAMBIA_CENTRE = [-14.5, 28];
const NAVY = "#182868";
const RED = "#c62828";

// Popup content is built from DOM nodes so branch names can't inject markup.
function popupContent(branch) {
  const box = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = branch.name;
  box.append(name);
  if (!branch.location_confirmed) {
    const note = document.createElement("div");
    note.textContent = "Approximate area";
    box.append(note);
  }
  const link = document.createElement("a");
  link.href = `/${branch.slug}`;
  link.textContent = "Visit this branch";
  link.style.display = "block";
  box.append(link);
  return box;
}

export default function ChurchMap({ branches, selectedSlug, userLocation, nearestSlug, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef({});
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  function drawMarkers() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (layerRef.current) layerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;
    markersRef.current = {};

    const points = [];
    branches.filter(hasLocation).forEach((branch) => {
      const point = [Number(branch.latitude), Number(branch.longitude)];
      points.push(point);
      const isNearest = branch.slug === nearestSlug;
      const marker = L.circleMarker(point, {
        radius: isNearest ? 12 : 9, color: "#fff", weight: isNearest ? 3 : 2, fillColor: isNearest ? RED : NAVY, fillOpacity: 1,
      }).addTo(layer);
      marker.bindPopup(popupContent(branch));
      marker.on("click", () => onSelectRef.current?.(branch.slug));
      markersRef.current[branch.slug] = marker;
    });
    if (userLocation) {
      const point = [userLocation.lat, userLocation.lng];
      points.push(point);
      L.circleMarker(point, { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
        .bindTooltip("You are here")
        .addTo(layer);
    }
    // Found: frame just the visitor and the nearest branch, and open its label.
    const nearest = nearestSlug && markersRef.current[nearestSlug];
    if (userLocation && nearest) {
      map.fitBounds([[userLocation.lat, userLocation.lng], nearest.getLatLng()], { padding: [60, 60], maxZoom: 14 });
      nearest.openPopup();
    } else if (points.length) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
    }
  }

  // Leaflet needs `window`, so it can only be loaded in the browser.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || mapRef.current || !containerRef.current) return;
      leafletRef.current = L;
      // Scrolling the page past the map shouldn't zoom it. Once someone clicks
      // the map to use it, the mouse wheel zooms until they click away.
      // Panning stays on, even on phones: this map is for looking around.
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(ZAMBIA_CENTRE, 6);
      mapRef.current = map;
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());
      mapRef.current.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
      drawMarkers();
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, userLocation, nearestSlug]);

  useEffect(() => {
    const marker = markersRef.current[selectedSlug];
    if (!marker || !mapRef.current) return;
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 12));
    marker.openPopup();
  }, [selectedSlug]);

  return <div ref={containerRef} className="loc-map" role="region" aria-label="Map of church branches" />;
}
