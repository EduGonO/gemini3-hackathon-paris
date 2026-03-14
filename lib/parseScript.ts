// lib/parseScript.ts
// Script parsing utility — integrates with Gemini API

import type { Scene, ScenePart, CharacterStats } from "@/components/ScriptDisplay";

// --- Types ---

export interface ParseResult {
  title: string;
  author: string;
  scenes: Scene[];
  characters: CharacterStats[];
}

export interface ParseDebugEntry {
  lineNumber: number;
  line: string;
  matched: "structural" | "fuzzy" | null;
  setting?: string;
  location?: string;
  time?: string;
}

// --- Time-of-day markers (multi-language) ---
// Used for fuzzy scene heading detection and time extraction
const TIME_MARKERS: string[] = [
  // English
  "DAY", "NIGHT", "MORNING", "AFTERNOON", "EVENING",
  "DAWN", "DUSK", "SUNSET", "SUNRISE", "MIDNIGHT", "NOON",
  "CONTINUOUS", "CONT.", "LATER", "MOMENTS LATER", "SAME TIME",
  "EARLIER", "GOLDEN HOUR", "MAGIC HOUR", "PRE-DAWN",
  // Spanish
  "DÍA", "DIA", "NOCHE", "TARDE", "MAÑANA", "MANANA",
  "MADRUGADA", "CONTINUO", "CONTINUA",
  "ANOCHECER", "AMANECER", "ATARDECER",
  "MÁS TARDE", "MAS TARDE",
  "MOMENTOS DESPUÉS", "MOMENTOS DESPUES",
  "MISMO TIEMPO", "INSTANTES DESPUÉS",
  // French
  "JOUR", "NUIT", "MATIN", "SOIR", "APRÈS-MIDI", "APRES-MIDI",
  "CONTINU", "CONTINUE", "AUBE", "CRÉPUSCULE", "CREPUSCULE",
  "PLUS TARD", "EN CONTINU",
  // Portuguese
  "DIA", "NOITE", "MANHÃ", "MANHA", "TARDE", "ENTARDECER",
  "CONTÍNUO", "CONTINUO",
];

// Sort longest first so multi-word markers match before single words
const TIME_MARKERS_SORTED = [...TIME_MARKERS].sort((a, b) => b.length - a.length);

// Build a regex that matches any time marker at or near the end of a line
// Handles separators: " - ", " -- ", " / ", or just trailing after last separator
const TIME_MARKER_REGEX = new RegExp(
  `(?:[-–—/\\s]+|^)(${TIME_MARKERS_SORTED.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*$`,
  "i"
);

// --- INT/EXT structural pattern ---
// Matches all common INT/EXT variants (with period, dash, slash, or bare),
// including French/Spanish INTÉRIEUR/EXTÉRIEUR
const INT_EXT_REGEX =
  /^[\s\d.]*\b(INT\.\/EXT\.|EXT\.\/INT\.|I\.?\/E\.?|E\.?\/I\.?|INT\.?|EXT\.?|INTÉRIEUR|EXTÉRIEUR|INTERIOR|EXTERIOR)\b\s*[-./]?\s*/i;

// --- Stop words ---
const STOP_WORDS = new Set([
  "INT", "EXT", "INT/EXT", "EXT/INT",
  "CUT", "CUT TO", "SMASH CUT", "MATCH CUT", "JUMP CUT",
  "FADE", "FADE IN", "FADE OUT", "FADE TO", "DISSOLVE", "DISSOLVE TO",
  "TITLE", "TITLES", "SUPER", "SUBTITLE", "CAPTION",
  "ALL", "THE", "END", "CONTINUED", "CONT", "MORE",
  "DAY", "NIGHT", "DUSK", "DAWN", "MORNING", "EVENING", "LATER",
  "CONTINUOUS", "MOMENTS LATER", "SIMULTANEOUSLY",
  "INTERCUT", "INTERCUT WITH",
  "POV", "INSERT", "BACK TO SCENE", "BACK TO",
  "OVER", "OVER BLACK", "BLACK",
  "A", "AN", "AND", "OR", "TO", "IN", "ON", "AT", "BY",
  "INT.", "EXT.", "V.O.", "O.S.", "O.C.",
  "ROLL", "ROLL MAIN TITLE", "MAIN TITLE", "MAIN TITLES", "ROLL TITLES",
  "SCENE", "SERIES OF SHOTS", "WE SEE", "WE HEAR", "SAME",
  "CLOSE ON", "CLOSE UP", "WIDE ON", "PULL BACK", "PUSH IN",
  "ANGLE ON", "NEW ANGLE", "ANOTHER ANGLE",
]);

// --- cleanCharacterName ---
export function cleanCharacterName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// --- detectSceneHeading ---
// Two-pass fuzzy detector. Returns null if line is not a scene heading.
export function detectSceneHeading(line: string): {
  setting: string;
  location: string;
  time: string;
  matched: "structural" | "fuzzy";
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Normalise for matching (NFC, remove soft hyphens)
  const normalised = trimmed.normalize("NFC");

  // --- Pass 1: Structural match (starts with INT/EXT variant) ---
  const structMatch = normalised.match(INT_EXT_REGEX);
  if (structMatch) {
    const setting = structMatch[1].replace(/\.$/, "").trim().toUpperCase();
    const rest = normalised.slice(structMatch[0].length).trim();
    const { location, time } = extractLocationTime(rest);
    return { setting, location, time, matched: "structural" };
  }

  // --- Pass 2: Fuzzy match (all-caps line that contains a time marker) ---
  // Must be entirely uppercase (character names are also all-caps, but they're short and
  // handled separately; scene headings tend to be longer with location text)
  if (normalised !== normalised.toUpperCase()) return null;
  if (normalised.length < 5) return null;

  // Must contain a time marker
  const timeMatch = normalised.match(TIME_MARKER_REGEX);
  if (!timeMatch) return null;

  // Must not be a stop word or character cue shape
  const cleaned = cleanCharacterName(normalised);
  if (STOP_WORDS.has(cleaned)) return null;
  if (normalised.endsWith(":")) return null;
  // Fuzzy headings should have some location content (not just a time marker alone)
  const timeStr = timeMatch[1].trim().toUpperCase();
  const beforeTime = normalised.slice(0, timeMatch.index).trim();
  if (!beforeTime || beforeTime.length < 2) return null;

  const { location, time } = extractLocationTime(normalised);
  return { setting: "?", location, time, matched: "fuzzy" };
}

// --- extractLocationTime ---
// Extracts location and time from the remainder of a heading after the INT/EXT prefix,
// or from a full fuzzy-matched heading line.
// Separator priority: " -- " > " - " > time marker at end
function extractLocationTime(text: string): { location: string; time: string } {
  // Strip trailing scene numbers
  const cleaned = text.replace(/\s*\d+\s*$/, "").trim();

  // Try double-dash separator (Spanish: "SALA - TEPEJI 21 -- TARDE")
  const doubleDash = cleaned.lastIndexOf(" -- ");
  if (doubleDash !== -1) {
    return {
      location: cleaned.slice(0, doubleDash).trim(),
      time: cleaned.slice(doubleDash + 4).trim(),
    };
  }

  // Try time marker regex match at end
  const timeMatch = cleaned.match(TIME_MARKER_REGEX);
  if (timeMatch && timeMatch.index !== undefined) {
    const separator = cleaned.slice(timeMatch.index, timeMatch.index + (cleaned.length - cleaned.trimStart().length + timeMatch.index));
    const timePart = timeMatch[1].trim();
    // Find where the time marker starts (accounting for separator)
    const markerStart = cleaned.lastIndexOf(timePart);
    if (markerStart > 0) {
      const loc = cleaned.slice(0, markerStart).replace(/[\s\-–—/]+$/, "").trim();
      if (loc) return { location: loc, time: timePart };
    }
  }

  // Try single-dash separator as fallback
  const singleDash = cleaned.lastIndexOf(" - ");
  if (singleDash !== -1) {
    return {
      location: cleaned.slice(0, singleDash).trim(),
      time: cleaned.slice(singleDash + 3).trim(),
    };
  }

  // No separator found — entire text is location
  return { location: cleaned, time: "" };
}

// --- isCharacterCue ---
function isCharacterCue(trimmed: string): boolean {
  if (!trimmed) return false;
  if (trimmed !== trimmed.toUpperCase()) return false;
  const cleaned = cleanCharacterName(trimmed);
  if (!cleaned) return false;
  if (STOP_WORDS.has(cleaned)) return false;
  if (trimmed.endsWith(":")) return false;
  if (/^(INT|EXT)\.?[\s/\-]/.test(trimmed)) return false;
  if (/\bTO:$/.test(trimmed)) return false;
  if (/^(FADE|CUT|DISSOLVE|SMASH|MATCH|JUMP)/.test(cleaned) && cleaned.length < 30) return false;
  if (/^[\d\s.,\-–—]+$/.test(cleaned)) return false;
  if (cleaned.length > 40) return false;
  if (!/[A-Z]{2,}/.test(cleaned)) return false;
  // Extra guard: if detectSceneHeading thinks this is a heading, it's not a character
  if (detectSceneHeading(trimmed) !== null) return false;
  return true;
}

// --- estimateSceneDuration ---
export function estimateSceneDuration(scene: Scene): number {
  let dialogueWords = 0;
  let directionWords = 0;
  let exchanges = 0;
  let prevChar = "";
  let isMontage = false;

  for (const part of scene.parts) {
    const words = part.text.trim().split(/\s+/).filter(Boolean).length;
    if (part.type === "dialogue") {
      dialogueWords += words;
      if (part.character !== prevChar) { exchanges += 1; prevChar = part.character; }
    } else {
      directionWords += words;
      if (/montage|quick cuts|series of shots/i.test(part.text)) isMontage = true;
    }
  }

  const totalWords = dialogueWords + directionWords;
  const dialogueRatio = totalWords > 0 ? dialogueWords / totalWords : 0;

  let dialoguePace = 2.5;
  let directionPace = 1.5;
  if (isMontage) directionPace = 0.5;
  else if (dialogueRatio < 0.2 && directionWords > 20) directionPace = 1.0;
  else if (dialogueRatio > 0.7) dialoguePace = 2.8;

  return Math.max(3, Math.round(
    dialogueWords / dialoguePace +
    directionWords / directionPace +
    exchanges * 0.8
  ));
}

// --- Gemini-powered parser (TODO) ---
export async function parseWithGemini(text: string): Promise<ParseResult> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Gemini parse failed");
  return res.json() as Promise<ParseResult>;
}

// --- PDF text extraction ---
export async function extractTextFromPdf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64 }),
      });
      if (!res.ok) { reject(new Error("OCR failed")); return; }
      const { text } = await res.json();
      resolve(text);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Character line regex ---
const CHAR_LINE_REGEX = /^\s{0,20}([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9\s'().-]+)$/;

// --- highlightDirectionText ---
export function highlightDirectionText(
  text: string,
  knownChars: Set<string>
): Array<{ text: string; isCharacter: boolean; character?: string }> {
  if (knownChars.size === 0) return [{ text, isCharacter: false }];

  const sorted = Array.from(knownChars).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

  const segments: Array<{ text: string; isCharacter: boolean; character?: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start), isCharacter: false });
    segments.push({ text: match[0], isCharacter: true, character: cleanCharacterName(match[0]) });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isCharacter: false });
  return segments.length > 0 ? segments : [{ text, isCharacter: false }];
}

// --- buildCharacterStats ---
export function buildCharacterStats(scenes: Scene[]): CharacterStats[] {
  const map = new Map<string, { dialogueCount: number; scenes: Set<number> }>();

  for (const scene of scenes) {
    const seenInScene = new Set<string>();
    for (const part of scene.parts) {
      if (part.type === "dialogue") {
        const name = part.character;
        if (!map.has(name)) map.set(name, { dialogueCount: 0, scenes: new Set() });
        const entry = map.get(name)!;
        entry.dialogueCount += 1;
        if (!seenInScene.has(name)) { seenInScene.add(name); entry.scenes.add(scene.sceneNumber); }
      }
    }
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      sceneCount: data.scenes.size,
      dialogueCount: data.dialogueCount,
      scenes: Array.from(data.scenes).sort((a, b) => a - b),
    }))
    .filter((c) => c.dialogueCount > 0)
    .sort((a, b) => b.dialogueCount - a.dialogueCount);
}

// --- parseScenesFallback ---
export function parseScenesFallback(text: string): {
  scenes: Scene[];
  characters: CharacterStats[];
  debugLog: ParseDebugEntry[];
} {
  const scenes: Scene[] = [];
  const debugLog: ParseDebugEntry[] = [];
  let current: Partial<Scene> | null = null;
  let parts: ScenePart[] = [];
  let currentDialogue: { character: string; lines: string[] } | null = null;
  let directionLines: string[] = [];

  function flushDirection() {
    if (!directionLines.length) return;
    const t = directionLines.join(" ").replace(/\s+/g, " ").trim();
    if (t) parts.push({ type: "direction", text: t });
    directionLines = [];
  }

  function flushDialogue() {
    if (!currentDialogue) return;
    const t = currentDialogue.lines.join(" ").replace(/\s+/g, " ").trim();
    if (t) parts.push({ type: "dialogue", character: currentDialogue.character, text: t });
    currentDialogue = null;
  }

  function finalizeScene() {
    if (!current) return;
    flushDialogue();
    flushDirection();
    const chars = Array.from(new Set(
      parts
        .filter((p): p is Extract<ScenePart, { type: "dialogue" }> => p.type === "dialogue")
        .map((p) => p.character)
    ));
    const sceneObj: Scene = {
      ...(current as Scene),
      parts,
      characters: chars,
      rawText: parts.map((p) => p.type === "dialogue" ? `${p.character}\n${p.text}` : p.text).join("\n"),
    };
    sceneObj.duration = estimateSceneDuration(sceneObj);
    scenes.push(sceneObj);
  }

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    // --- Scene heading detection (fuzzy) ---
    const headingInfo = detectSceneHeading(line);

    if (headingInfo) {
      finalizeScene();
      parts = [];
      currentDialogue = null;
      directionLines = [];

      const { setting, location, time, matched } = headingInfo;

      debugLog.push({
        lineNumber: i + 1,
        line: trimmed,
        matched,
        setting,
        location,
        time,
      });

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[parseScript] ${matched} heading #${scenes.length + 1} (line ${i + 1}): ` +
          `setting="${setting}" location="${location}" time="${time}" | "${trimmed}"`
        );
      }

      current = {
        sceneNumber: scenes.length + 1,
        heading: trimmed,
        setting,
        location,
        time,
        duration: undefined,
      };
      continue;
    }

    if (!current) continue;

    if (!trimmed) {
      flushDialogue();
      continue;
    }

    const charMatch = trimmed.match(CHAR_LINE_REGEX);
    if (charMatch && isCharacterCue(trimmed)) {
      flushDialogue();
      flushDirection();
      const name = cleanCharacterName(charMatch[1].trim());
      if (name) currentDialogue = { character: name, lines: [] };
      continue;
    }

    if (currentDialogue) {
      currentDialogue.lines.push(trimmed);
    } else {
      directionLines.push(trimmed);
    }
  }

  finalizeScene();

  const characters = buildCharacterStats(scenes);
  return { scenes, characters, debugLog };
}
