// types/schema.ts
// Complete data model for the script analyzer
// Optimised for Gemini API calls, email generation, calendar events, callsheet export

// ─── Primitives ────────────────────────────────────────────────────────────────────────────

export type SceneSetting = "INT" | "EXT" | "INT/EXT" | "EXT/INT" | "?";
export type FilmFormat = "feature" | "short" | "series" | "commercial" | "unknown";
export type TeamRole =
  | "Director" | "Producer" | "Executive Producer"
  | "Director of Photography" | "1st AD" | "2nd AD"
  | "Production Designer" | "Costume Designer" | "Hair & Makeup"
  | "Sound" | "Editor" | "VFX" | "Script Supervisor"
  | "Location Manager" | "Casting Director" | "Other";

// ─── Film metadata ───────────────────────────────────────────────────────────────────────────────

export interface FilmProject {
  id: string;
  title: string;
  author: string;
  format: FilmFormat;
  logline?: string;
  totalScenes: number;
  totalDuration: number;    // seconds
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
}

// ─── Character ─────────────────────────────────────────────────────────────────────────────────

export interface Character {
  id: string;                 // slugified canonical name, e.g. "mark"
  canonicalName: string;      // display name, e.g. "MARK"
  aliases: string[];          // other names that map here: ["MARKY", "MARK V.O."]
  actorName?: string;
  actorEmail?: string;
  actorPhone?: string;
  notes?: string;
  // computed from scenes
  sceneCount: number;
  dialogueCount: number;
  scenes: number[];           // scene numbers
}

// ─── Location ─────────────────────────────────────────────────────────────────────────────────

export interface Location {
  id: string;                 // slugified
  scriptName: string;         // as written in the script: "CAFE DE FLORE"
  displayName?: string;       // corrected/preferred display name
  realWorldAddress?: string;  // for Google Maps / callsheets
  coordinates?: { lat: number; lon: number };
  notes?: string;
  sceneCount: number;
  sceneNumbers: number[];
}

// ─── Scene ───────────────────────────────────────────────────────────────────────────────────

export interface SceneData {
  id: string;                 // e.g. "scene-1"
  sceneNumber: number;
  heading: string;            // raw heading from script
  setting: SceneSetting;
  locationId: string;         // references Location.id
  locationName: string;       // denormalised for display
  time: string;               // "NIGHT", "DAY", "TARDE", etc.
  characterIds: string[];     // references Character.id (canonical)
  duration: number;           // seconds (estimated)
  // Production scheduling
  shootingDates: string[];    // ISO date strings
  callTime?: string;          // "HH:MM"
  wrapTime?: string;          // computed from callTime + duration
  // Notes & corrections
  notes?: string;
  geminiNotes?: string;       // AI-generated production notes
}

// ─── Team member (crew not in script) ──────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole | string;
  email?: string;
  phone?: string;
  notes?: string;
}

// ─── Full project state ──────────────────────────────────────────────────────────────────────────

export interface ProjectState {
  film: FilmProject;
  scenes: SceneData[];
  characters: Character[];
  locations: Location[];
  team: TeamMember[];
}

// ─── Reducer actions ──────────────────────────────────────────────────────────────────────────────

export type ProjectAction =
  // Load
  | { type: "LOAD_PROJECT"; project: ProjectState }
  // Film
  | { type: "UPDATE_FILM"; patch: Partial<FilmProject> }
  // Characters
  | { type: "UPDATE_CHARACTER"; id: string; patch: Partial<Character> }
  | { type: "MERGE_CHARACTERS"; keepId: string; mergeIds: string[] }
  | { type: "ADD_CHARACTER_ALIAS"; id: string; alias: string }
  | { type: "REMOVE_CHARACTER_ALIAS"; id: string; alias: string }
  // Locations
  | { type: "UPDATE_LOCATION"; id: string; patch: Partial<Location> }
  // Scenes
  | { type: "UPDATE_SCENE"; id: string; patch: Partial<SceneData> }
  // Team
  | { type: "ADD_TEAM_MEMBER"; member: TeamMember }
  | { type: "UPDATE_TEAM_MEMBER"; id: string; patch: Partial<TeamMember> }
  | { type: "REMOVE_TEAM_MEMBER"; id: string };

// ─── Callsheet export shape ──────────────────────────────────────────────────────────────────────────
// Used for Gemini prompt context, email generation, Google Calendar events

export interface CallsheetScene {
  sceneNumber: number;
  heading: string;
  location: string;
  realWorldAddress?: string;
  time: string;
  duration: number;
  callTime?: string;
  cast: Array<{ character: string; actor?: string; email?: string }>;
  notes?: string;
}

export interface Callsheet {
  film: Pick<FilmProject, "title" | "author">;
  shootDate?: string;
  crew: TeamMember[];
  scenes: CallsheetScene[];
  generatedAt: string;
}
