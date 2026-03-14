"use client";

import { useState, useMemo } from "react";
import type { SceneData, FilmProject } from "@/types/schema";

interface Props {
  film: FilmProject;
  scenes: SceneData[];
  onUpdateScene: (id: string, patch: Partial<SceneData>) => void;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

const SETTING_COLORS: Record<string, string> = {
  INT: "bg-indigo-400",
  EXT: "bg-green-400",
  "INT/EXT": "bg-teal-400",
  "EXT/INT": "bg-teal-400",
  "?": "bg-gray-400",
};

export default function ShootingCalendar({ film, scenes, onUpdateScene }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (film.shootingDateRange?.startDate) return parseDate(film.shootingDateRange.startDate);
    return new Date();
  });

  const rangeStart = film.shootingDateRange?.startDate;
  const rangeEnd = film.shootingDateRange?.endDate;

  // Map date → scenes shooting on that day
  const scenesByDate = useMemo(() => {
    const map = new Map<string, SceneData[]>();
    for (const s of scenes) {
      const date = s.shootingDate;
      if (date) {
        if (!map.has(date)) map.set(date, []);
        map.get(date)!.push(s);
      }
    }
    return map;
  }, [scenes]);

  // Build calendar grid for viewMonth
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // All days in the grid (including padding)
  const gridDays: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    gridDays.push(formatDate(new Date(year, month, d)));
  }
  while (gridDays.length % 7 !== 0) gridDays.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) weeks.push(gridDays.slice(i, i + 7));

  function isInRange(date: string): boolean {
    if (!rangeStart || !rangeEnd) return true;
    return date >= rangeStart && date <= rangeEnd;
  }

  function totalDurationForDate(date: string): string {
    const dayScenes = scenesByDate.get(date) ?? [];
    const total = dayScenes.reduce((s, sc) => s + sc.duration, 0);
    if (!total) return "";
    const m = Math.floor(total / 60);
    return `${m}m`;
  }

  const selectedScenes = selectedDate ? (scenesByDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >←</button>
        <span className="text-xs font-medium text-gray-700">
          {viewMonth.toLocaleString("default", { month: "long" })} {year}
        </span>
        <button
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >→</button>
      </div>

      {/* Calendar grid */}
      <div className="w-full">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
            <div key={d} className="text-center text-[9px] font-semibold text-gray-400">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px mb-px">
            {week.map((date, di) => {
              if (!date) return <div key={di} />;
              const inRange = isInRange(date);
              const dayScenes = scenesByDate.get(date) ?? [];
              const isSelected = date === selectedDate;
              const isToday = date === formatDate(new Date());
              return (
                <button
                  key={di}
                  onClick={() => setSelectedDate(date === selectedDate ? null : date)}
                  className={`relative rounded p-1 text-center transition-colors ${
                    isSelected ? "bg-gray-900 text-white"
                    : inRange ? "hover:bg-gray-100 text-gray-700"
                    : "text-gray-300"
                  } ${isToday && !isSelected ? "ring-1 ring-blue-400" : ""}`}
                >
                  <div className={`text-[10px] font-medium ${isSelected ? "text-white" : ""}`}>
                    {parseInt(date.split("-")[2])}
                  </div>
                  {/* Scene dots */}
                  {dayScenes.length > 0 && (
                    <div className="flex justify-center gap-px mt-0.5 flex-wrap">
                      {dayScenes.slice(0, 4).map((s, i) => (
                        <span key={i} className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : (SETTING_COLORS[s.setting] ?? "bg-gray-400")}`} />
                      ))}
                      {dayScenes.length > 4 && <span className={`text-[8px] ${isSelected ? "text-gray-300" : "text-gray-400"}`}>+{dayScenes.length - 4}</span>}
                    </div>
                  )}
                  {/* Duration hint */}
                  {dayScenes.length > 0 && !isSelected && (
                    <div className="text-[8px] text-gray-400 leading-none">{totalDurationForDate(date)}</div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[9px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"/>INT</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>EXT</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block"/>INT/EXT</span>
      </div>

      {/* Selected date scenes */}
      {selectedDate && (
        <div className="border-t border-gray-200 pt-2 space-y-1.5">
          <div className="text-[10px] font-semibold text-gray-500">{selectedDate}</div>
          {selectedScenes.length === 0 ? (
            <div className="text-[10px] text-gray-400 italic">No scenes scheduled. Click a scene in the panel to assign this date.</div>
          ) : (
            selectedScenes.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-[10px]">
                <div>
                  <span className="font-medium text-gray-700">#{s.sceneNumber}</span>
                  <span className="ml-1 text-gray-500">{s.locationName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{s.callTime ?? film.defaultCallTime ?? "—"}</span>
                  <button
                    onClick={() => onUpdateScene(s.id, { shootingDate: undefined })}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                    title="Remove from this date"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary stats */}
      {rangeStart && rangeEnd && (
        <div className="text-[9px] text-gray-400 border-t border-gray-100 pt-2">
          {scenes.filter((s) => s.shootingDate).length}/{scenes.length} scenes scheduled
        </div>
      )}
    </div>
  );
}
