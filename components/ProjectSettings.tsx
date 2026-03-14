"use client";

import { useState, useRef, useEffect } from "react";
import type { FilmProject, GeneralLocation, ShootingDateRange } from "@/types/schema";

interface Props {
  film: FilmProject;
  onUpdate: (patch: Partial<FilmProject>) => void;
}

// Popover for editing a single field
function SettingPopover({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-xl border border-gray-200 bg-white shadow-xl p-3 min-w-[200px]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// Compact chip button
function Chip({ icon, label, placeholder }: { icon: string; label?: string; placeholder: string }) {
  return (
    <div className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-gray-400 cursor-pointer select-none ${
      label ? "border-gray-300 bg-white text-gray-700" : "border-gray-200 bg-gray-50 text-gray-400"
    }`}>
      <span>{icon}</span>
      <span className="max-w-[120px] truncate">{label || placeholder}</span>
    </div>
  );
}

export default function ProjectSettings({ film, onUpdate }: Props) {
  const range = film.shootingDateRange;
  const loc = film.generalLocation;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">

      {/* Date range */}
      <SettingPopover
        trigger={
          <Chip
            icon="📅"
            label={range?.startDate && range?.endDate ? `${range.startDate} → ${range.endDate}` : undefined}
            placeholder="shooting dates"
          />
        }
      >
        {(close) => (
          <div className="space-y-2 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Shooting dates</div>
            <label className="block">
              <div className="text-[10px] text-gray-500 mb-0.5">Start</div>
              <input type="date" defaultValue={range?.startDate}
                onChange={(e) => onUpdate({ shootingDateRange: { startDate: e.target.value, endDate: range?.endDate ?? e.target.value } })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="block">
              <div className="text-[10px] text-gray-500 mb-0.5">End</div>
              <input type="date" defaultValue={range?.endDate}
                onChange={(e) => onUpdate({ shootingDateRange: { startDate: range?.startDate ?? e.target.value, endDate: e.target.value } })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            </label>
            <button onClick={close} className="w-full rounded bg-gray-900 px-2 py-1 text-[11px] text-white hover:bg-gray-700">done</button>
          </div>
        )}
      </SettingPopover>

      {/* Location */}
      <SettingPopover
        trigger={
          <Chip
            icon="📍"
            label={loc?.city ? `${loc.city}${loc.address ? `, ${loc.address}` : ""}` : undefined}
            placeholder="location"
          />
        }
      >
        {(close) => (
          <div className="space-y-2 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">General location</div>
            <label className="block">
              <div className="text-[10px] text-gray-500 mb-0.5">City</div>
              <input type="text" defaultValue={loc?.city} placeholder="Paris"
                onBlur={(e) => onUpdate({ generalLocation: { city: e.target.value, address: loc?.address } as GeneralLocation })}
                onKeyDown={(e) => { if (e.key === "Enter") { onUpdate({ generalLocation: { city: (e.target as HTMLInputElement).value, address: loc?.address } as GeneralLocation }); close(); } }}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="block">
              <div className="text-[10px] text-gray-500 mb-0.5">Address</div>
              <input type="text" defaultValue={loc?.address} placeholder="optional"
                onBlur={(e) => onUpdate({ generalLocation: { city: loc?.city ?? "", address: e.target.value } })}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            </label>
            <button onClick={close} className="w-full rounded bg-gray-900 px-2 py-1 text-[11px] text-white hover:bg-gray-700">done</button>
          </div>
        )}
      </SettingPopover>

      {/* Call time */}
      <SettingPopover
        trigger={
          <Chip
            icon="⏰"
            label={film.defaultCallTime ? `call ${film.defaultCallTime}` : undefined}
            placeholder="call time"
          />
        }
      >
        {(close) => (
          <div className="space-y-2 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Default call time</div>
            <input type="time" defaultValue={film.defaultCallTime}
              onChange={(e) => onUpdate({ defaultCallTime: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
            <button onClick={close} className="w-full rounded bg-gray-900 px-2 py-1 text-[11px] text-white hover:bg-gray-700">done</button>
          </div>
        )}
      </SettingPopover>

    </div>
  );
}
