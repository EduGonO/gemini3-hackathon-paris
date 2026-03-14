"use client";

import { useState, useMemo } from "react";
import { highlightDirectionText } from "@/lib/parseScript";

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
  dialogueCount: number;
  scenes: number[];
  actorName?: string;
  actorEmail?: string;
}

interface Props {
  scenes: Scene[];
  characters: CharacterStats[];
  title?: string;
}

// 9-color palette for character badges
const CHAR_COLORS = [
  "bg-red-100 text-red-800",
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-amber-100 text-amber-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
];

export default function ScriptDisplay({ scenes, characters, title }: Props) {
  const [activeScene, setActiveScene] = useState(0);

  // Build color map from all known characters (sorted by dialogue count — most prominent first)
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    characters.forEach((c, i) => { map[c.name] = CHAR_COLORS[i % CHAR_COLORS.length]; });
    return map;
  }, [characters]);

  // Set of known character names for direction highlighting
  const knownChars = useMemo(
    () => new Set(characters.map((c) => c.name)),
    [characters]
  );

  if (!scenes.length) return null;

  const scene = scenes[activeScene];

  return (
    <div className="flex h-full min-h-0 gap-4">

      {/* LEFT — Scene list */}
      <aside className="w-48 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {title && (
          <div className="border-b px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">
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
              <div className="flex gap-1">
                <span className="rounded bg-gray-200 px-1 text-[10px] font-bold text-gray-600">
                  {s.setting}
                </span>
                {s.time && (
                  <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">
                    {s.time}
                  </span>
                )}
              </div>
              <span className="text-gray-400 text-[10px]">{s.sceneNumber}</span>
            </div>
            <div className="mt-0.5 truncate text-gray-700">{s.location}</div>
            {s.characters.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-0.5">
                {s.characters.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className={`rounded px-1 text-[9px] font-bold ${colorMap[c] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {c.split(" ")[0]}
                  </span>
                ))}
                {s.characters.length > 3 && (
                  <span className="text-[9px] text-gray-400">+{s.characters.length - 3}</span>
                )}
              </div>
            )}
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
            <div className="space-y-4 font-mono text-sm leading-relaxed">
              {scene.parts.map((part, i) => {
                if (part.type === "dialogue") {
                  const color = colorMap[part.character] ?? "bg-gray-100 text-gray-800";
                  return (
                    <div key={i} className="flex flex-col items-center text-center px-8">
                      <span className={`mb-1 rounded px-2 py-0.5 text-xs font-bold ${color}`}>
                        {part.character}
                      </span>
                      <p className="text-gray-800 max-w-sm">{part.text}</p>
                    </div>
                  );
                }

                // Direction — highlight known character names inline
                const segments = highlightDirectionText(part.text, knownChars);
                return (
                  <p key={i} className="text-gray-600">
                    {segments.map((seg, j) =>
                      seg.isCharacter ? (
                        <span
                          key={j}
                          className={`rounded px-1 font-bold ${colorMap[seg.character!] ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={j}>{seg.text}</span>
                      )
                    )}
                  </p>
                );
              })}

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
          <div className="space-y-5 text-sm">

            {/* Scene metadata */}
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Scene</h3>
              <div className="space-y-1 text-xs text-gray-600">
                <div><span className="text-gray-400">Setting </span>{scene.setting}</div>
                <div><span className="text-gray-400">Location </span>{scene.location}</div>
                {scene.time && <div><span className="text-gray-400">Time </span>{scene.time}</div>}
                <div>
                  <span className="text-gray-400">Duration </span>
                  {scene.duration
                    ? `${Math.floor(scene.duration / 60)}m ${scene.duration % 60}s`
                    : "—"}
                </div>
              </div>
            </div>

            {/* Characters in this scene */}
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Cast ({scene.characters.length})
              </h3>
              {scene.characters.length ? (
                <div className="space-y-2">
                  {scene.characters.map((name) => {
                    const stats = characters.find((c) => c.name === name);
                    return (
                      <div key={name} className="flex items-start justify-between gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${colorMap[name] ?? "bg-gray-100 text-gray-700"}`}>
                          {name}
                        </span>
                        {stats && (
                          <span className="text-[10px] text-gray-400 text-right">
                            {stats.dialogueCount} lines · {stats.sceneCount} scenes
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-gray-400">None detected</span>
              )}
            </div>

            {/* Stretch placeholders */}
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
