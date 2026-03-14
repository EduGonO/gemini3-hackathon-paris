"use client";

import { useRef } from "react";
import type { ProjectState } from "@/types/schema";

interface Props {
  project: ProjectState;
  onClose: () => void;
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallsheetFallback({ project, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const { film, scenes, characters, locations, team } = project;

  const charMap = new Map(characters.map((c) => [c.id, c]));
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const scheduled = scenes.filter((s) => s.shootingDate).length;

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${film.title} — Callsheet</title>
      <style>
        body { font-family: 'Georgia', serif; max-width: 900px; margin: 40px auto; color: #111; font-size: 12px; line-height: 1.5; }
        h1 { font-size: 22px; font-weight: bold; letter-spacing: -0.5px; margin: 0 0 4px; }
        h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 1px solid #ddd; padding: 4px 8px; }
        td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .scene-card { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
        .scene-heading { font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta { font-size: 10px; color: #666; margin-top: 3px; }
        @media print { body { margin: 20px; } .no-print { display: none; } }
      </style></head><body>${content}</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 no-print">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Callsheet Preview</span>
            <span className="text-xs text-gray-400">Google Docs unavailable — browser render</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              🖳 Print / Save PDF
            </button>
            <button onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Callsheet content */}
        <div ref={printRef} className="px-8 py-8 font-serif text-gray-900">

          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{film.title || "Untitled Production"}</h1>
            <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-4">
              {film.author && <span>Written by {film.author}</span>}
              {film.generalLocation?.city && <span>📍 {film.generalLocation.city}{film.generalLocation.address ? `, ${film.generalLocation.address}` : ""}</span>}
              {film.shootingDateRange && <span>📅 {film.shootingDateRange.startDate} → {film.shootingDateRange.endDate}</span>}
              {film.defaultCallTime && <span>⏰ Default call: {film.defaultCallTime}</span>}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>{film.totalScenes} scenes</span>
              <span>{characters.length} characters</span>
              <span>{team.length} crew</span>
              <span>{scheduled}/{scenes.length} scenes scheduled</span>
              <span>est. {fmt(film.totalDuration)}</span>
            </div>
          </div>

          {/* Cast */}
          {characters.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1 mb-3">Cast</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="text-left pb-2 font-medium">Character</th>
                    <th className="text-left pb-2 font-medium">Actor</th>
                    <th className="text-left pb-2 font-medium">Email</th>
                    <th className="text-right pb-2 font-medium">Lines</th>
                    <th className="text-right pb-2 font-medium">Scenes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {characters.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 font-medium">{c.canonicalName}</td>
                      <td className="py-2 text-gray-600">{c.actorName || <span className="text-gray-300 italic">unassigned</span>}</td>
                      <td className="py-2 text-gray-500 text-xs">{c.actorEmail || "—"}</td>
                      <td className="py-2 text-right text-gray-600">{c.dialogueCount}</td>
                      <td className="py-2 text-right text-gray-600">{c.sceneCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Crew */}
          {team.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1 mb-3">Crew</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="text-left pb-2 font-medium">Role</th>
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-left pb-2 font-medium">Email</th>
                    <th className="text-left pb-2 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {team.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2 text-gray-500 text-xs">{m.role}</td>
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2 text-gray-500 text-xs">{m.email || "—"}</td>
                      <td className="py-2 text-gray-500 text-xs">{m.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Scene breakdown */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1 mb-3">Scene Breakdown</h2>
            <div className="space-y-3">
              {scenes.map((s) => {
                const loc = locMap.get(s.locationId);
                const address = s.locationOverride ?? loc?.realWorldAddress ?? "";
                const castNames = s.characterIds.map((id) => charMap.get(id)?.canonicalName ?? id).filter(Boolean);
                const callTime = s.callTime ?? film.defaultCallTime;
                return (
                  <div key={s.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">{s.setting}</span>
                          {s.time && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{s.time}</span>}
                          <span className="text-[10px] text-gray-400">Scene {s.sceneNumber}</span>
                        </div>
                        <div className="font-semibold text-sm">{s.locationName}</div>
                        {address && <div className="text-xs text-gray-500 mt-0.5">{address}</div>}
                        {castNames.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {castNames.map((n) => (
                              <span key={n} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">{n}</span>
                            ))}
                          </div>
                        )}
                        {s.notes && <div className="mt-1.5 text-xs text-gray-500 italic">{s.notes}</div>}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="text-sm font-medium text-gray-700">{fmt(s.duration)}</div>
                        {s.shootingDate && <div className="text-xs text-blue-600">{s.shootingDate}</div>}
                        {callTime && <div className="text-xs text-gray-500">call {callTime}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 text-right">
            Generated {new Date().toLocaleString()} · gemini3 hackathon paris
          </div>
        </div>
      </div>
    </div>
  );
}
