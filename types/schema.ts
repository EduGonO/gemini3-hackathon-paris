// types/schema.ts
// Complete data model for the script analyzer

export type SceneSetting = "INT" | "EXT" | "INT/EXT" | "EXT/INT" | "?";
export type FilmFormat = "feature" | "short" | "series" | "commercial" | "unknown";
export type TeamRole =
  | "Director" | "Producer" | "Executive Producer" | "Line Producer" | "Production Assistant"
  | "Director of Photography" | "Camera Operator" | "Focus Puller" | "Gaffer" | "Best Boy Electric"
  | "Electrician" | "Sound Engineer" | "Boom Operator"
  | "Production Designer" | "Set Decorator" | "Props"
  | "Costume Designer" | "Wardrobe" | "Makeup Artist" | "Hair & Makeup"
  | "1st AD" | "2nd AD" | "Script Supervisor"
  | "Editor" | "VFX" | "Colorist"
  | "Location Manager" | "Transportation" | "Catering" | "Cleaning Staff"
  | "Casting Director" | "Other";

// ─── Film metadata ──────────────────────────────────────────────────────────────────────────────

export interface ShootingDateRange {
  startDate: string;   // ISO date "YYYY-MM-DD"
  endDate: string;     // ISO date "YYYY-MM-DD"
}

export interface GeneralLocation {
  city: string;
  address?: string;
  coordinates?: { lat: number; lon: number };
}

export interface FilmProject {
  id: string;
  title: string;
  author: string;
  format: FilmFormat;
  logline?: string;
  totalScenes: number;
  totalDuration: number;        // seconds
  // Global production settings
  shootingDateRange?: ShootingDateRange;
  generalLocation?: GeneralLocation;
  defaultCallTime?: string;     // "HH:MM"
  createdAt: string;
  updatedAt: string;
}

// ─── Character ────────────────────────────────────────────────────────────────────────────────

export interface Character {
  id: string;
  canonicalName: string;
  aliases: string[];
  actorName?: string;
  actorEmail?: string;
  actorPhone?: string;
  notes?: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: number[];
}

// ─── Location ────────────────────────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  scriptName: string;
  displayName?: string;
  realWorldAddress?: string;
  coordinates?: { lat: number; lon: number };
  notes?: string;
  sceneCount: number;
  sceneNumbers: number[];
}

// ─── Scene ───────────────────────────────────────────────────────────────────────────────────

export interface SceneData {
  id: string;
  sceneNumber: number;
  heading: string;
  setting: SceneSetting;
  locationId: string;
  locationName: string;
  time: string;
  characterIds: string[];
  duration: number;             // seconds
  // Scene-specific overrides (override project defaults when set)
  shootingDate?: string;        // "YYYY-MM-DD" — specific date for this scene
  callTime?: string;            // "HH:MM" — overrides project defaultCallTime
  locationOverride?: string;    // overrides generalLocation for this scene
  assignedCrew?: string[];      // TeamMember.id[] for this scene
  // General
  shootingDates: string[];      // legacy multi-date support
  notes?: string;
  geminiNotes?: string;
}

// ─── Team ───────────────────────────────────────────────────────────────────────────────────

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
  | { type: "LOAD_PROJECT"; project: ProjectState }
  | { type: "UPDATE_FILM"; patch: Partial<FilmProject> }
  | { type: "UPDATE_CHARACTER"; id: string; patch: Partial<Character> }
  | { type: "MERGE_CHARACTERS"; keepId: string; mergeIds: string[] }
  | { type: "ADD_CHARACTER_ALIAS"; id: string; alias: string }
  | { type: "REMOVE_CHARACTER_ALIAS"; id: string; alias: string }
  | { type: "UPDATE_LOCATION"; id: string; patch: Partial<Location> }
  | { type: "UPDATE_SCENE"; id: string; patch: Partial<SceneData> }
  | { type: "ADD_TEAM_MEMBER"; member: TeamMember }
  | { type: "UPDATE_TEAM_MEMBER"; id: string; patch: Partial<TeamMember> }
  | { type: "REMOVE_TEAM_MEMBER"; id: string };

// ─── Callsheet export ──────────────────────────────────────────────────────────────────────────

export interface CallsheetScene {
  sceneNumber: number;
  heading: string;
  location: string;
  realWorldAddress?: string;
  time: string;
  duration: number;
  shootingDate?: string;
  callTime?: string;
  cast: Array<{ character: string; actor?: string; email?: string }>;
  crew: Array<{ name: string; role: string; email?: string }>;
  notes?: string;
}

export interface Callsheet {
  film: Pick<FilmProject, "title" | "author">;
  shootDate?: string;
  generalLocation?: GeneralLocation;
  crew: TeamMember[];
  scenes: CallsheetScene[];
  generatedAt: string;
}
