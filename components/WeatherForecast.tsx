"use client";

import { useEffect, useState } from "react";

interface WeatherData {
  tempMax: number;
  tempMin: number;
  cloudcover: number;      // %
  precipitation: number;   // % probability
  visibility: number;      // meters
  windspeed: number;       // km/h
  weathercode: number;
  sunrise: string;         // ISO datetime
  sunset: string;          // ISO datetime
}

interface Props {
  location?: string;       // place name to geocode
  date?: string;           // YYYY-MM-DD
}

// WMO weather code → label + emoji
function describeCode(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear sky", emoji: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code <= 48) return { label: "Foggy", emoji: "🌫️" };
  if (code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code <= 77) return { label: "Snow", emoji: "❄️" };
  if (code <= 82) return { label: "Rain showers", emoji: "🌦️" };
  return { label: "Storm", emoji: "⛈️" };
}

// Filming condition rating
function filmingRating(code: number, clouds: number, precip: number): {
  label: string; color: string; bg: string;
} {
  if (precip > 60 || code >= 51) return { label: "Poor", color: "text-red-600", bg: "bg-red-50" };
  if (precip > 30 || code === 45 || code === 48) return { label: "Fair", color: "text-amber-600", bg: "bg-amber-50" };
  if (code === 3 && clouds > 80) return { label: "Soft light", color: "text-blue-600", bg: "bg-blue-50" };
  if (code <= 2) return { label: "Ideal", color: "text-green-600", bg: "bg-green-50" };
  return { label: "Good", color: "text-emerald-600", bg: "bg-emerald-50" };
}

function addMinutes(iso: string, mins: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function visibilityLabel(meters: number): string {
  const km = meters / 1000;
  if (km >= 20) return "Excellent";
  if (km >= 10) return "Good";
  if (km >= 5) return "Fair";
  return "Low";
}

export default function WeatherForecast({ location, date }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolvedLocation, setResolvedLocation] = useState("");

  useEffect(() => {
    if (!location || !date) { setWeather(null); return; }
    let cancelled = false;
    setLoading(true);
    setError("");

    async function fetch_weather() {
      try {
        // 1. Geocode
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location!)}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();
        const place = geoData.results?.[0];
        if (!place) throw new Error(`Location not found: ${location}`);
        if (cancelled) return;
        setResolvedLocation(`${place.name}${place.country ? `, ${place.country}` : ""}`);

        // 2. Forecast
        const params = new URLSearchParams({
          latitude: String(place.latitude),
          longitude: String(place.longitude),
          daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,cloudcover_mean,visibility_mean,windspeed_10m_max,weathercode,sunrise,sunset",
          timezone: "auto",
          start_date: date!,
          end_date: date!,
        });
        const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        const wxData = await wxRes.json();
        const d = wxData.daily;
        if (!d || !d.temperature_2m_max?.[0]) throw new Error("No forecast data");
        if (cancelled) return;

        setWeather({
          tempMax: Math.round(d.temperature_2m_max[0]),
          tempMin: Math.round(d.temperature_2m_min[0]),
          cloudcover: Math.round(d.cloudcover_mean[0] ?? 0),
          precipitation: Math.round(d.precipitation_probability_max[0] ?? 0),
          visibility: Math.round(d.visibility_mean[0] ?? 10000),
          windspeed: Math.round(d.windspeed_10m_max[0] ?? 0),
          weathercode: d.weathercode[0] ?? 0,
          sunrise: d.sunrise[0],
          sunset: d.sunset[0],
        });
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load forecast");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch_weather();
    return () => { cancelled = true; };
  }, [location, date]);

  if (!location || !date) return (
    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-[10px] text-gray-400">
      Set a shooting date and location to see the forecast
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center text-[10px] text-gray-400 animate-pulse">
      Loading forecast for {location}…
    </div>
  );

  if (error || !weather) return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-400">
      {error || "No forecast available"}
    </div>
  );

  const { label: condLabel, emoji } = describeCode(weather.weathercode);
  const rating = filmingRating(weather.weathercode, weather.cloudcover, weather.precipitation);
  const firstLight = addMinutes(weather.sunrise, -30);
  const goldenMorn = addMinutes(weather.sunrise, 30);
  const goldenEvn = addMinutes(weather.sunset, -45);
  const lastLight = addMinutes(weather.sunset, 30);
  const vis = weather.visibility / 1000;

  // Card gradient based on conditions
  const cardBg =
    weather.weathercode === 0 ? "from-sky-50 to-blue-50"
    : weather.weathercode <= 2 ? "from-sky-50 to-gray-50"
    : weather.weathercode === 3 ? "from-gray-50 to-slate-100"
    : weather.weathercode <= 48 ? "from-slate-100 to-gray-100"
    : "from-gray-50 to-gray-100";

  return (
    <div className={`rounded-xl border border-gray-200 bg-gradient-to-br ${cardBg} overflow-hidden text-xs`}>
      {/* Header row */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2">
        <div>
          <div className="text-base font-light text-gray-800">{emoji} {weather.tempMax}° / {weather.tempMin}°</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{condLabel} · {resolvedLocation}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rating.color} ${rating.bg}`}>
          {rating.label}
        </span>
      </div>

      {/* Condition bars */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-3 text-[10px]">
        <div>
          <div className="flex justify-between text-gray-500 mb-0.5">
            <span>☁️ Clouds</span><span className="text-gray-700 font-medium">{weather.cloudcover}%</span>
          </div>
          <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-gray-400" style={{ width: `${weather.cloudcover}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-gray-500 mb-0.5">
            <span>🌧 Rain</span><span className="text-gray-700 font-medium">{weather.precipitation}%</span>
          </div>
          <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full rounded-full ${weather.precipitation > 50 ? "bg-blue-400" : "bg-blue-300"}`}
              style={{ width: `${weather.precipitation}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>👁 Visibility</span>
          <span className={`font-medium ${vis < 5 ? "text-amber-600" : "text-gray-700"}`}>
            {vis.toFixed(0)} km · {visibilityLabel(weather.visibility)}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>💨 Wind</span>
          <span className={`font-medium ${weather.windspeed > 40 ? "text-amber-600" : "text-gray-700"}`}>
            {weather.windspeed} km/h
          </span>
        </div>
      </div>

      {/* Filmmaker light timeline */}
      <div className="border-t border-gray-200/60 px-3 py-2 bg-black/[0.02]">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Light schedule</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-400">First light</span>
            <span className="font-medium text-gray-700">{firstLight}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-500">🌅 Golden (am)</span>
            <span className="font-medium text-gray-700">{toTime(weather.sunrise)} – {goldenMorn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-500">🌇 Golden (pm)</span>
            <span className="font-medium text-gray-700">{goldenEvn} – {toTime(weather.sunset)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Last light</span>
            <span className="font-medium text-gray-700">{lastLight}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
