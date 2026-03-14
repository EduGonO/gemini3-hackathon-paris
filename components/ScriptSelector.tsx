"use client";

import { useState, useEffect, useRef } from "react";

export interface ScriptMeta {
  name: string;
  filename: string;
  path: string;
}

interface Props {
  onLoad: (script: ScriptMeta) => void;
  currentScript?: string;
}

export default function ScriptSelector({ onLoad, currentScript }: Props) {
  const [scripts, setScripts] = useState<ScriptMeta[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then(setScripts)
      .catch(() => setScripts([]));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (scripts.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rounded px-3 py-1 text-xs transition-colors ${
          open
            ? "bg-gray-800 text-white"
            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
        }`}
      >
        {currentScript ? (
          <span className="max-w-[120px] truncate inline-block align-bottom">{currentScript}</span>
        ) : (
          "scripts ▾"
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            demo scripts
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {scripts.map((s) => (
              <li key={s.path}>
                <button
                  onClick={async () => {
                    setOpen(false);
                    setLoading(true);
                    try {
                      onLoad(s);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors ${
                    currentScript === s.name ? "font-semibold text-gray-900 bg-gray-50" : "text-gray-700"
                  }`}
                >
                  <div className="truncate">{s.name}</div>
                  <div className="text-[10px] text-gray-400">{s.filename}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1.5 text-[10px] text-gray-400">
            add files to <code className="bg-gray-100 px-1 rounded">public/scripts/</code>
          </div>
        </div>
      )}
    </div>
  );
}
