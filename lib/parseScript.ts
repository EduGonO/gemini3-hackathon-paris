// lib/parseScript.ts
// Script parsing utility — integrates with Gemini API
// Status: skeleton / in progress

import type { Scene, ScenePart, CharacterStats } from "@/components/ScriptDisplay";

// --- Types ---

export interface ParseResult {
  title: string;
  author: string;
  scenes: Scene[];
  characters: CharacterStats[];
}

// --- Stop words — never treated as character names ---
const STOP_WORDS = new Set([
  "INT", "EXT", "INT/EXT", "EXT/INT", "CUT", "CUT TO", "SMASH CUT",
  "FADE", "FADE IN", "FADE OUT", "FADE TO", "DISSOLVE", "DISSOLVE TO",
  "TITLE", "TITLES", "SUPER", "SUBTITLE", "CAPTION",
  "THE", "END", "CONTINUED", "CONT", "MORE",
  "DAY", "NIGHT", "DUSK", "DAWN", "MORNING", "EVENING", "LATER",
  "CONTINUOUS", "MOMENTS LATER", "SIMULTANEOUSLY",
  "INTERCUT", "INTERCUT WITH",
  "POV", "INSERT", "BACK TO SCENE",
  "OVER", "OVER BLACK", "BLACK",
  "A", "AN", "AND", "OR", "THE", "TO", "IN", "ON", "AT", "BY",
]);

// --- cleanCharacterName ---
// Strips parentheticals like (V.O.), (O.S.), (CONT'D), (cont'd), trailing punctuation
export function cleanCharacterName(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)/g, "")   // remove (V.O.), (O.S.), (CONT'D), etc.
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// --- isCharacterCue ---
// Returns true if a line looks like a character cue (all-caps, not a stop word, etc.)
function isCharacterCue(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false;

  // Must not end with a colon (rules out "TITLE:", "NOTE:", "EXT.", etc.)
  if (raw.endsWith(":")) return false;

  // Strip parentheticals for the purpose of detection
  const stripped = cleanCharacterName(raw);
  if (!stripped) return false;

  // Must be all uppercase after stripping
  if (stripped !== stripped.toUpperCase()) return false;

  // Length guard — character names are short
  if (stripped.length > 40) return false;

  // Must start with a letter
  if (!/^[A-Z]/.test(stripped)) return false;

  // Must not be a stop word
  if (STOP_WORDS.has(stripped)) return false;

  // Must not look like a scene transition (ends with "TO:" pattern)
  if (/\bTO:$/.test(raw)) return false;

  // Must not be a slug line fragment
  if (/^(INT|EXT)\.?[\s/]/.test(raw)) return false;

  // Must not be all numbers or punctuation
  if (/^[\d\s.,-]+$/.test(stripped)) return false;

  // Must have at least one letter-only word of length > 1
  if (!/[A-Z]{2,}/.test(stripped)) return false;

  return true;
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

// --- Heading regex ---
const HEADING_REGEX =
  /^(\s*)(\d+\.?\s*)?(INT\.\/EXT\.|EXT\/INT\.|INT\/EXT|EXT\/INT|INT\.|EXT\.)\s*(.*)$/i;

// --- highlightDirectionText ---
// Returns an array of segments for direction text, marking known character names.
// Used by ScriptDisplay to render highlighted spans.
export function highlightDirectionText(
  text: string,
  knownChars: Set<string>
): Array<{ text: string; isCharacter: boolean; character?: string }> {
  if (knownChars.size === 0) return [{ text, isCharacter: false }];

  // Build a regex from known character names, longest first to avoid partial matches
  const sorted = Array.from(knownChars).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

  const segments: Array<{ text: string; isCharacter: boolean; character?: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), isCharacter: false });
    }
    const raw = match[0];
    const cleaned = cleanCharacterName(raw);
    segments.push({ text: raw, isCharacter: true, character: cleaned });
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isCharacter: false });
  }

  return segments.length > 0 ? segments : [{ text, isCharacter: false }];
}

// --- buildCharacterStats ---
export function buildCharacterStats(scenes: Scene[]): CharacterStats[] {
  const map = new Map<string, { sceneCount: number; dialogueCount: number; scenes: Set<number> }>();

  for (const scene of scenes) {
    const seenInScene = new Set<string>();
    for (const part of scene.parts) {
      if (part.type === "dialogue") {
        const name = part.character;
        if (!map.has(name)) map.set(name, { sceneCount: 0, dialogueCount: 0, scenes: new Set() });
        const entry = map.get(name)!;
        entry.dialogueCount += 1;
        if (!seenInScene.has(name)) {
          seenInScene.add(name);
          entry.scenes.add(scene.sceneNumber);
        }
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
    .sort((a, b) => b.dialogueCount - a.dialogueCount);
}

// --- parseScenesFallback ---
export function parseScenesFallback(text: string): { scenes: Scene[]; characters: CharacterStats[] } {
  const scenes: Scene[] = [];
  let current: Partial<Scene> | null = null;
  let parts: ScenePart[] = [];
  let directionBuffer: string[] = [];
  let inDialogue = false;
  let currentChar = "";
  let dialogueBuffer: string[] = [];

  function flushDirection() {
    const t = directionBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (t) parts.push({ type: "direction", text: t });
    directionBuffer = [];
  }

  function flushDialogue() {
    const t = dialogueBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (t && currentChar) parts.push({ type: "dialogue", character: currentChar, text: t });
    dialogueBuffer = [];
    currentChar = "";
    inDialogue = false;
  }

  function finalizeScene() {
    if (!current) return;
    flushDialogue();
    flushDirection();
    const chars = Array.from(
      new Set(
        parts
          .filter((p): p is Extract<ScenePart, { type: "dialogue" }> => p.type === "dialogue")
          .map((p) => p.character)
      )
    );
    scenes.push({
      ...(current as Scene),
      parts,
      characters: chars,
      rawText: parts
        .map((p) => (p.type === "dialogue" ? `${p.character}\n${p.text}` : p.text))
        .join("\n"),
    });
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(HEADING_REGEX);

    if (headingMatch) {
      finalizeScene();
      parts = [];
      inDialogue = false;
      currentChar = "";
      directionBuffer = [];
      dialogueBuffer = [];

      const afterSetting = headingMatch[4]?.trim() ?? "";
      const dashIdx = afterSetting.lastIndexOf(" - ");
      const location = dashIdx !== -1 ? afterSetting.slice(0, dashIdx).trim() : afterSetting;
      const time = dashIdx !== -1 ? afterSetting.slice(dashIdx + 3).trim() : "";

      current = {
        sceneNumber: scenes.length + 1,
        heading: `${headingMatch[3]} ${afterSetting}`.trim(),
        setting: headingMatch[3].replace(/\.$/, "").toUpperCase(),
        location,
        time,
        duration: undefined,
      };
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();
    if (!trimmed) {
      if (inDialogue) flushDialogue();
      continue;
    }

    if (isCharacterCue(trimmed)) {
      flushDialogue();
      flushDirection();
      inDialogue = true;
      currentChar = cleanCharacterName(trimmed);
      dialogueBuffer = [];
      continue;
    }

    if (inDialogue) {
      dialogueBuffer.push(trimmed);
    } else {
      directionBuffer.push(trimmed);
    }
  }

  finalizeScene();

  const characters = buildCharacterStats(scenes);
  return { scenes, characters };
}
