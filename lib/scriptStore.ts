// lib/scriptStore.ts
// Reducer + helpers for the ProjectState data model

import { useReducer, useCallback } from "react";
import type {
  ProjectState, ProjectAction, FilmProject,
  Character, Location, SceneData, TeamMember,
} from "@/types/schema";
import type { Scene, CharacterStats } from "@/components/ScriptDisplay";

// ─── Slug helper ────────────────────────────────────────────────────────────────────────────

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

// ─── Build ProjectState from parsed output ──────────────────────────────────────────────────────────

export function buildProjectFromParsed(
  parsedScenes: Scene[],
  parsedChars: CharacterStats[],
  title: string,
): ProjectState {
  // Deduplicate locations
  const locationMap = new Map<string, Location>();
  for (const s of parsedScenes) {
    const key = slug(s.location || "unknown");
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        id: key,
        scriptName: s.location || "Unknown",
        displayName: undefined,
        realWorldAddress: undefined,
        coordinates: undefined,
        notes: undefined,
        sceneCount: 0,
        sceneNumbers: [],
      });
    }
    const loc = locationMap.get(key)!;
    loc.sceneCount += 1;
    loc.sceneNumbers.push(s.sceneNumber);
  }

  // Build characters
  const characters: Character[] = parsedChars.map((c) => ({
    id: slug(c.canonicalName ?? c.name),
    canonicalName: c.canonicalName ?? c.name,
    aliases: [],
    actorName: c.actorName,
    actorEmail: c.actorEmail,
    actorPhone: undefined,
    notes: undefined,
    sceneCount: c.sceneCount,
    dialogueCount: c.dialogueCount,
    scenes: c.scenes,
  }));

  // Build scenes — map character names to IDs
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
    callTime: undefined,
    wrapTime: undefined,
    notes: undefined,
    geminiNotes: undefined,
  }));

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  const film: FilmProject = {
    id: uid(),
    title,
    author: "",
    format: "unknown",
    totalScenes: scenes.length,
    totalDuration,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    film,
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

    case "UPDATE_CHARACTER": {
      return {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
        film: { ...state.film, updatedAt: now },
      };
    }

    case "ADD_CHARACTER_ALIAS": {
      return {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.id && !c.aliases.includes(action.alias)
            ? { ...c, aliases: [...c.aliases, action.alias] }
            : c
        ),
      };
    }

    case "REMOVE_CHARACTER_ALIAS": {
      return {
        ...state,
        characters: state.characters.map((c) =>
          c.id === action.id
            ? { ...c, aliases: c.aliases.filter((a) => a !== action.alias) }
            : c
        ),
      };
    }

    case "MERGE_CHARACTERS": {
      const keep = state.characters.find((c) => c.id === action.keepId);
      if (!keep) return state;
      const toMerge = state.characters.filter((c) => action.mergeIds.includes(c.id));
      const mergedAliases = Array.from(new Set([
        ...keep.aliases,
        ...toMerge.map((c) => c.canonicalName),
        ...toMerge.flatMap((c) => c.aliases),
      ]));
      const mergedScenes = Array.from(new Set([...keep.scenes, ...toMerge.flatMap((c) => c.scenes)])).sort((a, b) => a - b);
      const merged: Character = {
        ...keep,
        aliases: mergedAliases,
        sceneCount: mergedScenes.length,
        dialogueCount: keep.dialogueCount + toMerge.reduce((s, c) => s + c.dialogueCount, 0),
        scenes: mergedScenes,
      };
      // Update scenes to replace merged character IDs
      const mergeIdSet = new Set(action.mergeIds);
      const updatedScenes = state.scenes.map((s) => ({
        ...s,
        characterIds: Array.from(new Set(
          s.characterIds.map((id) => mergeIdSet.has(id) ? action.keepId : id)
        )),
      }));
      return {
        ...state,
        characters: [
          merged,
          ...state.characters.filter((c) => c.id !== action.keepId && !mergeIdSet.has(c.id)),
        ],
        scenes: updatedScenes,
        film: { ...state.film, updatedAt: now },
      };
    }

    case "UPDATE_LOCATION":
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.id ? { ...l, ...action.patch } : l
        ),
      };

    case "UPDATE_SCENE":
      return {
        ...state,
        scenes: state.scenes.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s
        ),
        film: { ...state.film, updatedAt: now },
      };

    case "ADD_TEAM_MEMBER":
      return { ...state, team: [...state.team, action.member] };

    case "UPDATE_TEAM_MEMBER":
      return {
        ...state,
        team: state.team.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m
        ),
      };

    case "REMOVE_TEAM_MEMBER":
      return { ...state, team: state.team.filter((m) => m.id !== action.id) };

    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────────────────────

const EMPTY_PROJECT: ProjectState = {
  film: { id: "", title: "", author: "", format: "unknown", totalScenes: 0, totalDuration: 0, createdAt: "", updatedAt: "" },
  scenes: [],
  characters: [],
  locations: [],
  team: [],
};

export function useProjectStore() {
  const [project, dispatch] = useReducer(projectReducer, EMPTY_PROJECT);

  const load = useCallback((p: ProjectState) => dispatch({ type: "LOAD_PROJECT", project: p }), []);
  const updateFilm = useCallback((patch: Partial<FilmProject>) => dispatch({ type: "UPDATE_FILM", patch }), []);
  const updateCharacter = useCallback((id: string, patch: Partial<Character>) => dispatch({ type: "UPDATE_CHARACTER", id, patch }), []);
  const addAlias = useCallback((id: string, alias: string) => dispatch({ type: "ADD_CHARACTER_ALIAS", id, alias }), []);
  const removeAlias = useCallback((id: string, alias: string) => dispatch({ type: "REMOVE_CHARACTER_ALIAS", id, alias }), []);
  const mergeCharacters = useCallback((keepId: string, mergeIds: string[]) => dispatch({ type: "MERGE_CHARACTERS", keepId, mergeIds }), []);
  const updateLocation = useCallback((id: string, patch: Partial<Location>) => dispatch({ type: "UPDATE_LOCATION", id, patch }), []);
  const updateScene = useCallback((id: string, patch: Partial<SceneData>) => dispatch({ type: "UPDATE_SCENE", id, patch }), []);
  const addTeamMember = useCallback((member: TeamMember) => dispatch({ type: "ADD_TEAM_MEMBER", member }), []);
  const updateTeamMember = useCallback((id: string, patch: Partial<TeamMember>) => dispatch({ type: "UPDATE_TEAM_MEMBER", id, patch }), []);
  const removeTeamMember = useCallback((id: string) => dispatch({ type: "REMOVE_TEAM_MEMBER", id }), []);

  // Callsheet export helper
  const toCallsheet = useCallback(() => {
    const { film, scenes, characters, locations, team } = project;
    const charMap = new Map(characters.map((c) => [c.id, c]));
    const locMap = new Map(locations.map((l) => [l.id, l]));
    return {
      film: { title: film.title, author: film.author },
      crew: team,
      scenes: scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        heading: s.heading,
        location: locMap.get(s.locationId)?.displayName ?? s.locationName,
        realWorldAddress: locMap.get(s.locationId)?.realWorldAddress,
        time: s.time,
        duration: s.duration,
        callTime: s.callTime,
        cast: s.characterIds.map((id) => {
          const c = charMap.get(id);
          return { character: c?.canonicalName ?? id, actor: c?.actorName, email: c?.actorEmail };
        }),
        notes: s.notes,
      })),
      generatedAt: new Date().toISOString(),
    };
  }, [project]);

  return { project, dispatch, load, updateFilm, updateCharacter, addAlias, removeAlias, mergeCharacters, updateLocation, updateScene, addTeamMember, updateTeamMember, removeTeamMember, toCallsheet };
}
