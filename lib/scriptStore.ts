// lib/scriptStore.ts
// Reducer + helpers for the ProjectState data model

import { useReducer, useCallback } from "react";
import type {
  ProjectState, ProjectAction, FilmProject,
  Character, Location, SceneData, TeamMember,
} from "@/types/schema";
import type { Scene, CharacterStats } from "@/components/ScriptDisplay";

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Build ProjectState from parsed output ────────────────────────────────────────────────

export function buildProjectFromParsed(
  parsedScenes: Scene[],
  parsedChars: CharacterStats[],
  title: string,
): ProjectState {
  const locationMap = new Map<string, Location>();
  for (const s of parsedScenes) {
    const key = slug(s.location || "unknown");
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        id: key,
        scriptName: s.location || "Unknown",
        sceneCount: 0,
        sceneNumbers: [],
      });
    }
    const loc = locationMap.get(key)!;
    loc.sceneCount += 1;
    loc.sceneNumbers.push(s.sceneNumber);
  }

  const characters: Character[] = parsedChars.map((c) => ({
    id: slug(c.name),
    canonicalName: c.name,
    aliases: [],
    sceneCount: c.sceneCount,
    dialogueCount: c.dialogueCount,
    scenes: c.scenes,
  }));

  const charByName = new Map<string, Character>();
  for (const c of characters) {
    charByName.set(c.canonicalName, c);
    for (const a of c.aliases) charByName.set(a, c);
  }

  const scenes: SceneData[] = parsedScenes.map((s) => ({
    id: `scene-${s.sceneNumber}`,
    sceneNumber: s.sceneNumber,
    heading: s.heading,
    setting: s.setting as SceneData["setting"],
    locationId: slug(s.location || "unknown"),
    locationName: s.location || "Unknown",
    time: s.time || "",
    characterIds: s.characters
      .map((name) => charByName.get(name)?.id)
      .filter((id): id is string => !!id),
    duration: s.duration ?? 0,
    shootingDates: [],
    assignedCrew: [],
  }));

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return {
    film: {
      id: uid(),
      title,
      author: "",
      format: "unknown",
      totalScenes: scenes.length,
      totalDuration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    scenes,
    characters,
    locations: Array.from(locationMap.values()),
    team: [],
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────────────────────

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  const now = new Date().toISOString();

  switch (action.type) {
    case "LOAD_PROJECT":
      return action.project;

    case "UPDATE_FILM":
      return { ...state, film: { ...state.film, ...action.patch, updatedAt: now } };

    case "UPDATE_CHARACTER":
      return {
        ...state,
        characters: state.characters.map((c) => c.id === action.id ? { ...c, ...action.patch } : c),
        film: { ...state.film, updatedAt: now },
      };

    case "ADD_CHARACTER_ALIAS":
      return {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.id && !c.aliases.includes(action.alias)
            ? { ...c, aliases: [...c.aliases, action.alias] } : c
        ),
      };

    case "REMOVE_CHARACTER_ALIAS":
      return {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.id ? { ...c, aliases: c.aliases.filter((a) => a !== action.alias) } : c
        ),
      };

    case "MERGE_CHARACTERS": {
      const keep = state.characters.find((c) => c.id === action.keepId);
      if (!keep) return state;
      const toMerge = state.characters.filter((c) => action.mergeIds.includes(c.id));
      const mergedAliases = Array.from(new Set([
        ...keep.aliases,
        ...toMerge.map((c) => c.canonicalName),
        ...toMerge.flatMap((c) => c.aliases),
      ]));
      const mergedScenes = Array.from(new Set([
        ...keep.scenes, ...toMerge.flatMap((c) => c.scenes),
      ])).sort((a, b) => a - b);
      const merged: Character = {
        ...keep, aliases: mergedAliases, sceneCount: mergedScenes.length,
        dialogueCount: keep.dialogueCount + toMerge.reduce((s, c) => s + c.dialogueCount, 0),
        scenes: mergedScenes,
      };
      const mergeIdSet = new Set(action.mergeIds);
      return {
        ...state,
        characters: [merged, ...state.characters.filter((c) => c.id !== action.keepId && !mergeIdSet.has(c.id))],
        scenes: state.scenes.map((s) => ({
          ...s,
          characterIds: Array.from(new Set(s.characterIds.map((id) => mergeIdSet.has(id) ? action.keepId : id))),
        })),
        film: { ...state.film, updatedAt: now },
      };
    }

    case "UPDATE_LOCATION":
      return { ...state, locations: state.locations.map((l) => l.id === action.id ? { ...l, ...action.patch } : l) };

    case "UPDATE_SCENE":
      return {
        ...state,
        scenes: state.scenes.map((s) => s.id === action.id ? { ...s, ...action.patch } : s),
        film: { ...state.film, updatedAt: now },
      };

    case "ADD_TEAM_MEMBER":
      return { ...state, team: [...state.team, action.member] };

    case "UPDATE_TEAM_MEMBER":
      return { ...state, team: state.team.map((m) => m.id === action.id ? { ...m, ...action.patch } : m) };

    case "REMOVE_TEAM_MEMBER":
      return { ...state, team: state.team.filter((m) => m.id !== action.id) };

    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────────────────────

const EMPTY_PROJECT: ProjectState = {
  film: { id: "", title: "", author: "", format: "unknown", totalScenes: 0, totalDuration: 0, createdAt: "", updatedAt: "" },
  scenes: [], characters: [], locations: [], team: [],
};

export function useProjectStore() {
  const [project, dispatch] = useReducer(projectReducer, EMPTY_PROJECT);

  const load = useCallback((p: ProjectState) => dispatch({ type: "LOAD_PROJECT", project: p }), []);
  const updateFilm = useCallback((patch: Partial<FilmProject>) => dispatch({ type: "UPDATE_FILM", patch }), []);
  const updateCharacter = useCallback((id: string, patch: Partial<Character>) => dispatch({ type: "UPDATE_CHARACTER", id, patch }), []);
  const addAlias = useCallback((id: string, alias: string) => dispatch({ type: "ADD_CHARACTER_ALIAS", id, alias }), []);
  const mergeCharacters = useCallback((keepId: string, mergeIds: string[]) => dispatch({ type: "MERGE_CHARACTERS", keepId, mergeIds }), []);
  const updateLocation = useCallback((id: string, patch: Partial<Location>) => dispatch({ type: "UPDATE_LOCATION", id, patch }), []);
  const updateScene = useCallback((id: string, patch: Partial<SceneData>) => dispatch({ type: "UPDATE_SCENE", id, patch }), []);
  const addTeamMember = useCallback((member: TeamMember) => dispatch({ type: "ADD_TEAM_MEMBER", member }), []);
  const updateTeamMember = useCallback((id: string, patch: Partial<TeamMember>) => dispatch({ type: "UPDATE_TEAM_MEMBER", id, patch }), []);
  const removeTeamMember = useCallback((id: string) => dispatch({ type: "REMOVE_TEAM_MEMBER", id }), []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.film.title || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const importJSON = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json) as ProjectState;
      if (!data.film || !data.scenes) return false;
      dispatch({ type: "LOAD_PROJECT", project: data });
      return true;
    } catch { return false; }
  }, []);

  return {
    project, dispatch, load,
    updateFilm, updateCharacter, addAlias, mergeCharacters,
    updateLocation, updateScene,
    addTeamMember, updateTeamMember, removeTeamMember,
    exportJSON, importJSON,
  };
}
