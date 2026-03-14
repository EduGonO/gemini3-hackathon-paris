"use client";

import { useState } from "react";

// --- Types ---

export type ScenePart =
  | { type: "dialogue"; character: string; text: string }
  | { type: "direction"; text: string };

export interface Scene {
  sceneNumber: number;
  heading: string;
  setting: string;
  location: string;
  time: string;
  characters: string[];
  parts: ScenePart[];
  rawText: string;
  duration?: number;
}

export interface CharacterStats {
  name: string;
  sceneCount: number;
  scenes: number[];
}

interface Props {
  scenes: Scene[];
  characters: CharacterStats[];
  title?: string;
}

// Assign a consistent color to each character
const CHAR_COLORS = [
  "bg-red-100 text-red-800",
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-yellow-100 text-yellow-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
];

function useCharColorMap(characters: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  characters.forEach((c, i) => { map[c] = CHAR_COLORS[i % CHAR_COLORS.length]; });
  return map;
}

export default function ScriptDisplay({ scenes, characters, title }: Props) {
  const [activeScene, setActiveScene] = useState(0);

  // Collect all unique character names across scenes for color mapping
  const allChars = Array.from(new Set(scenes.flatMap((s) => s.characters)));
  const colorMap = useCharColorMap(allChars);

  if (!scenes.length) return null;

  const scene = scenes[activeScene];

  return (
    <div className="flex h-full min-h-0 gap-4">

      {/* LEFT — Scene list */}
      <aside className="w-48 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {title && (
          <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
            {title}
          </div>
        )}
        {scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveScene(i)}
            className={`block w-full border-b px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
              activeScene === i ? "bg-gray-100 font-semibold" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="rounded bg-gray-200 px-1 text-[10px] font-bold text-gray-600">
                {s.setting}
              </span>
              <span className="text-gray-400">{s.sceneNumber}</span>
            </div>
            <div className="mt-0.5 truncate text-gray-700">{s.location}</div>
            {s.time && <div className="text-[10px] text-gray-400">{s.time}</div>}
          </button>
        ))}
      </aside>

      {/* CENTER — Script reader */}
      <main className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {scene ? (
          <>
            {/* Scene heading */}
            <div className="mb-6 rounded bg-gray-100 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-600">
              {scene.heading}
            </div>

            {/* Script parts */}
            <div className="space-y-3 font-mono text-sm">
              {scene.parts.map((part, i) => {
                if (part.type === "dialogue") {
                  const charColor = colorMap[part.character] ?? "bg-gray-100 text-gray-800";
                  return (
                    <div key={i} className="flex flex-col items-center text-center px-8">
                      {/* Character name */}
                      <span className={`mb-1 rounded px-2 py-0.5 text-xs font-bold ${charColor}`}>
                        {part.character}
                      </span>
                      {/* Dialogue text */}
                      <p className="text-gray-800 leading-relaxed max-w-sm">
                        {part.text}
                      </p>
                    </div>
                  );
                }
                // Direction
                return (
                  <p key={i} className="text-gray-600 leading-relaxed">
                    {part.text}
                  </p>
                );
              })}

              {/* Fallback if no parts parsed */}
              {scene.parts.length === 0 && (
                <pre className="whitespace-pre-wrap text-gray-500 text-xs">{scene.rawText}</pre>
              )}
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-sm">Select a scene</div>
        )}
      </main>

      {/* RIGHT — Scene info */}
      <aside className="hidden w-64 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:block">
        {scene && (
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Duration</h3>
              <p className="mt-1 text-gray-600">
                {scene.duration
                  ? `${Math.floor(scene.duration / 60)}m ${scene.duration % 60}s`
                  : "—"}
              </p>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Characters</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {scene.characters.length ? (
                  scene.characters.map((c) => (
                    <span key={c} className={`rounded px-2 py-0.5 text-xs font-bold ${colorMap[c] ?? "bg-gray-100 text-gray-700"}`}>
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">None detected</span>
                )}
              </div>
            </div>
            <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-400">
              📅 Shooting dates — coming soon
            </div>
            <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-400">
              📍 Location map — coming soon
            </div>
            <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-400">
              🌤 Weather — coming soon
            </div>
          </div>
        )}
      </aside>

    </div>
  );
}
