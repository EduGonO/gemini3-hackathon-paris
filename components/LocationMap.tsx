"use client";

import { useState, useEffect } from "react";

interface Coords { lat: number; lon: number; }

interface Props {
  address?: string;         // place name or full address to display + geocode
  fallbackCity?: string;    // project-level city fallback
}

async function geocode(query: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
    );
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude };
  } catch { return null; }
}

export default function LocationMap({ address, fallbackCity }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState("");
  const [loading, setLoading] = useState(false);

  const query = address || fallbackCity;

  useEffect(() => {
    if (!query) { setCoords(null); return; }
    let cancelled = false;
    setLoading(true);

    geocode(query).then((c) => {
      if (cancelled) return;
      setCoords(c);
      setResolvedLabel(query);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [query]);

  if (!query) return (
    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[10px] text-gray-400">
      Set a location to see the map
    </div>
  );

  const mapSrc = coords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.015},${coords.lat - 0.01},${coords.lon + 0.015},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lon}`
    : null;

  const osmUrl = coords
    ? `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lon}#map=16/${coords.lat}/${coords.lon}`
    : null;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Map iframe */}
      <div className="relative bg-gray-100" style={{ height: 160 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 animate-pulse bg-gray-100">
            Loading map…
          </div>
        )}
        {mapSrc && !loading && (
          <iframe
            src={mapSrc}
            className="w-full h-full border-0"
            loading="lazy"
            title={`Map of ${resolvedLabel}`}
          />
        )}
        {!mapSrc && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
            Location not found
          </div>
        )}
      </div>

      {/* Address row */}
      <div className="flex items-center justify-between px-3 py-2 bg-white text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-400">📍</span>
          <span className="text-gray-700 truncate">{resolvedLabel || query}</span>
        </div>
        {osmUrl && (
          <a href={osmUrl} target="_blank" rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-500 flex-shrink-0 ml-2 transition-colors text-[9px] uppercase tracking-wider">
            open ↗
          </a>
        )}
      </div>
    </div>
  );
}
