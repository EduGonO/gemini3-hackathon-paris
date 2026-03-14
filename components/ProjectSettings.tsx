"use client";

import { useState } from "react";
import type { FilmProject, GeneralLocation, ShootingDateRange } from "@/types/schema";

interface Props {
  film: FilmProject;
  onUpdate: (patch: Partial<FilmProject>) => void;
}

function InlineInput({
  value, placeholder, type = "text", onSave,
}: {
  value?: string;
  placeholder?: string;
  type?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) return (
    <input
      autoFocus
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onSave(draft); setEditing(false); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { onSave(draft); setEditing(false); } }}
      className="rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs outline-none w-28"
    />
  );

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors group"
    >
      {value
        ? <span>{value}</span>
        : <span className="text-gray-400 italic">{placeholder}</span>
      }
    </button>
  );
}

export default function ProjectSettings({ film, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);

  const range = film.shootingDateRange;
  const loc = film.generalLocation;
  const hasSettings = !!(range?.startDate || loc?.city || film.defaultCallTime);

  return (
    <div className="mb-2">
      {/* Compact summary row */}
      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
        {range?.startDate && range?.endDate && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">
            📅 {range.startDate} → {range.endDate}
          </span>
        )}
        {loc?.city && (
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-600">
            📍 {loc.city}{loc.address ? `, ${loc.address}` : ""}
          </span>
        )}
        {film.defaultCallTime && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600">
            ⏰ call {film.defaultCallTime}
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? "hide settings ▲" : (hasSettings ? "edit ✎" : "+ settings")}
        </button>
      </div>

      {/* Expanded settings form */}
      {expanded && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">

            {/* Shooting dates */}
            <div className="col-span-2">
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">Shooting date range</div>
              <div className="flex items-center gap-2">
                <InlineInput
                  type="date"
                  value={range?.startDate}
                  placeholder="start date"
                  onSave={(v) => onUpdate({ shootingDateRange: { startDate: v, endDate: range?.endDate ?? v } })}
                />
                <span className="text-gray-400">→</span>
                <InlineInput
                  type="date"
                  value={range?.endDate}
                  placeholder="end date"
                  onSave={(v) => onUpdate({ shootingDateRange: { startDate: range?.startDate ?? v, endDate: v } })}
                />
              </div>
            </div>

            {/* General location */}
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">City</div>
              <InlineInput
                value={loc?.city}
                placeholder="Paris"
                onSave={(v) => onUpdate({ generalLocation: { ...loc, city: v } as GeneralLocation })}
              />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">Address</div>
              <InlineInput
                value={loc?.address}
                placeholder="optional address"
                onSave={(v) => onUpdate({ generalLocation: { city: loc?.city ?? "", ...loc, address: v } })}
              />
            </div>

            {/* Default call time */}
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">Default call time</div>
              <InlineInput
                type="time"
                value={film.defaultCallTime}
                placeholder="07:00"
                onSave={(v) => onUpdate({ defaultCallTime: v })}
              />
            </div>

            {/* Author */}
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-1">Author</div>
              <InlineInput
                value={film.author || undefined}
                placeholder="writer name"
                onSave={(v) => onUpdate({ author: v })}
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
