"use client";

import { useState, useMemo } from "react";
import { highlightDirectionText } from "@/lib/parseScript";
import SceneInfoPanel from "@/components/SceneInfoPanel";
import type { ProjectState, Character as ProjectCharacter, Location, SceneData, TeamMember } from "@/types/schema";

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
  project?: ProjectState;
  onUpdateCharacter?: (id: string, patch: Partial<ProjectCharacter>) => void;
  onMergeCharacters?: (keepId: string, mergeIds: string[]) => void;
  onUpdateLocation?: (id: string, patch: Partial<Location>) => void;
  onUpdateScene?: (id: string, patch: Partial<SceneData>) => void;
  onUpdateSceneById?: (id: string, patch: Partial<SceneData>) => void;
  onAddTeamMember?: (m: TeamMember) => void;
  onUpdateTeamMember?: (id: string, patch: Partial<TeamMember>) => void;
  onRemoveTeamMember?: (id: string) => void;
  onGenerateCallsheet?: () => void;
  generatingCallsheet?: boolean;
  callsheetUrl?: string;
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

export default function ScriptDisplay({ scenes, characters, title, project, onUpdateCharacter, onMergeCharacters, onUpdateLocation, onUpdateScene, onUpdateSceneById, onAddTeamMember, onUpdateTeamMember, onRemoveTeamMember, onGenerateCallsheet, generatingCallsheet, callsheetUrl }: Props) {
  const [activeScene, setActiveScene] = useState(0);

  // Build color map from all known characters (sorted by dialogue count — most prominent first)
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    characters.forEach((c, i) => { map[c.name] = CHAR_COLORS[i % CHAR_COLORS.length]; });
    return map;
  }, [characters]);

  // Resolve project-level data for the active scene
  const activeSceneData = project?.scenes[activeScene];
  const activeSceneChars = activeSceneData
    ? project!.characters.filter((c) => activeSceneData.characterIds.includes(c.id))
    : [];
  const activeLocation = activeSceneData
    ? project!.locations.find((l) => l.id === activeSceneData.locationId)
    : undefined;

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
      <aside className="w-40 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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

      {/* RIGHT — Scene info panel */}
      <aside className="hidden w-64 flex-shrink-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:block">
        {scene && project && activeSceneData ? (
          <SceneInfoPanel
            scene={activeSceneData}
            characters={activeSceneChars}
            allCharacters={project.characters}
            location={activeLocation}
            team={project.team}
            film={project.film}
            allScenes={project.scenes}
            project={project!}
            onUpdateScene={(patch) => onUpdateScene?.(activeSceneData.id, patch)}
            onUpdateCharacter={(id, patch) => onUpdateCharacter?.(id, patch)}
            onMergeCharacters={(keepId, mergeIds) => onMergeCharacters?.(keepId, mergeIds)}
            onUpdateLocation={(id, patch) => onUpdateLocation?.(id, patch)}
            onAddTeamMember={(m) => onAddTeamMember?.(m)}
            onUpdateTeamMember={(id, patch) => onUpdateTeamMember?.(id, patch)}
            onRemoveTeamMember={(id) => onRemoveTeamMember?.(id)}
            onUpdateSceneById={(id, patch) => onUpdateSceneById?.(id, patch)}
            onGenerateCallsheet={() => onGenerateCallsheet?.()}
            generatingCallsheet={generatingCallsheet ?? false}
            callsheetUrl={callsheetUrl}
          />
        ) : scene ? (
          // Fallback when no project state yet
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Characters</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {scene.characters.length ? scene.characters.map((c) => (
                  <span key={c} className={`rounded px-2 py-0.5 text-xs font-bold ${colorMap[c] ?? "bg-gray-100 text-gray-700"}`}>{c}</span>
                )) : <span className="text-xs text-gray-400">None</span>}
              </div>
            </div>
          </div>
        ) : null}
      </aside>

    </div>
  );
}
