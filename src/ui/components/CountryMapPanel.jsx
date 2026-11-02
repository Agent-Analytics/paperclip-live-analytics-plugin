import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';

import { MAP_CONFIG } from '../../shared/map-config.js';
import { buildCountryMapItems, getMapFocus } from '../../shared/map-model.js';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildBubbleIcon(item, isHot) {
  return L.divIcon({
    className: '',
    iconSize: [item.bubbleSize + 32, item.bubbleSize + 16],
    iconAnchor: [(item.bubbleSize + 32) / 2, (item.bubbleSize + 16) / 2],
    html: `
      <div class="aa-map-bubble${isHot ? ' aa-map-bubble-hot' : ''}" title="${escapeHtml(item.name)}">
        <span class="aa-map-bubble-code">${escapeHtml(item.code)}</span>
        <strong class="aa-map-bubble-count">${item.displayCount}</strong>
      </div>
    `,
  });
}

function FallbackCountrySummary({ countries, message }) {
  return (
    <div className="aa-map-fallback">
      <strong>{message}</strong>
      {countries.length > 0 ? (
        <div className="aa-map-fallback-list">
          {countries.map((country) => (
            <div className="aa-map-fallback-row" key={country.country}>
              <span>{country.country}</span>
              <span>{country.visitors} visitors</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CountryMapPanel({ countries, hotCountryCode, updatedAt, overlay = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const tileLayerRef = useRef(null);
  const failedTilesRef = useRef(0);
  const [mapFailed, setMapFailed] = useState(false);

  const items = useMemo(() => buildCountryMapItems(countries), [countries]);
  const focus = useMemo(() => getMapFocus(items, hotCountryCode), [items, hotCountryCode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mapFailed) return undefined;

    try {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
        worldCopyJump: false,
      });
      mapRef.current = map;
      map.setView(MAP_CONFIG.worldCenter, MAP_CONFIG.worldZoom);

      markersRef.current = L.layerGroup().addTo(map);

      const tileLayer = L.tileLayer(MAP_CONFIG.tileUrl, {
        attribution: MAP_CONFIG.attributionHtml,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
      });
      tileLayer.on('tileerror', () => {
        failedTilesRef.current += 1;
        if (failedTilesRef.current >= 6) {
          setMapFailed(true);
        }
      });
      tileLayer.on('load', () => {
        failedTilesRef.current = 0;
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      setTimeout(() => {
        map.invalidateSize(false);
      }, 0);

      return () => {
        map.remove();
        mapRef.current = null;
        markersRef.current = null;
        tileLayerRef.current = null;
      };
    } catch {
      setMapFailed(true);
      return undefined;
    }
  }, [mapFailed]);

  useEffect(() => {
    if (mapFailed || !mapRef.current || !markersRef.current) return;

    const map = mapRef.current;
    const layerGroup = markersRef.current;
    layerGroup.clearLayers();

    for (const item of items) {
      const marker = L.marker([item.latitude, item.longitude], {
        icon: buildBubbleIcon(item, item.code === focus.countryCode),
        keyboard: false,
      });
      marker.bindTooltip(`${item.name}: ${item.displayCount} active`, {
        direction: 'top',
        opacity: 0.92,
      });
      layerGroup.addLayer(marker);
    }

    map.invalidateSize(false);

    if (focus.mode === 'world') {
      map.setView(MAP_CONFIG.worldCenter, MAP_CONFIG.worldZoom, { animate: false });
      return;
    }

    map.flyTo(focus.center, focus.zoom, {
      duration: 0.75,
      animate: true,
    });
  }, [focus, items, mapFailed]);

  if (mapFailed) {
    return <FallbackCountrySummary countries={countries} message="Map tiles did not load. Showing the country summary instead." />;
  }

  return (
    <div className="aa-map-panel">
      <div className="aa-map-frame">
        <div ref={containerRef} className="aa-leaflet-map" />
        {overlay ? (
          <div className={`aa-map-empty-overlay${overlay.blocked ? ' aa-map-empty-overlay-blocked' : ''}`}>
            <strong>{overlay.title}</strong>
            <span>{overlay.description}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="aa-map-empty-overlay">
            <strong>No country activity in the current live window yet.</strong>
            <span>The map stays live and will zoom into the first active country when traffic appears.</span>
          </div>
        ) : null}
      </div>
      <div className="aa-map-footer">
        <span>{updatedAt}</span>
      </div>
    </div>
  );
}
