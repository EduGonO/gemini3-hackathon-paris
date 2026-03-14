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

// --- Stop words — never treated as character names ---
const STOP_WORDS = new Set([
  "INT", "EXT", "INT/EXT", "EXT/INT",
  "CUT", "CUT TO", "SMASH CUT", "MATCH CUT", "JUMP CUT",
  "FADE", "FADE IN", "FADE OUT", "FADE TO", "DISSOLVE", "DISSOLVE TO",
  "TITLE", "TITLES", "SUPER", "SUBTITLE", "CAPTION",
  "THE", "END", "CONTINUED", "CONT", "MORE",
  "DAY", "NIGHT", "DUSK", "DAWN", "MORNING", "EVENING", "LATER",
  "CONTINUOUS", "MOMENTS LATER", "SIMULTANEOUSLY",
  "INTERCUT", "INTERCUT WITH",
  "POV", "INSERT", "BACK TO SCENE",
  "OVER", "OVER BLACK", "BLACK",
  "A", "AN", "AND", "OR", "TO", "IN", "ON", "AT", "BY",
  "INT.", "EXT.", "V.O.", "O.S.", "O.C.",
]);

// --- cleanCharacterName ---
// Strips parentheticals like (V.O.), (O.S.), (CONT'D), trailing punctuation, normalizes to uppercase
export function cleanCharacterName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\s*\([^)]*\)/g, "")      // remove (V.O.), (O.S.), (CONT'D), etc.
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// --- isCharacterCue ---
// A character cue must be ENTIRELY uppercase (trimmed === trimmed.toUpperCase()).
// This is the key discriminator between character names and direction text.
function isCharacterCue(trimmed: string): boolean {
  if (!trimmed) return false;

  // CRITICAL: must be entirely uppercase — mixed case = direction text
  if (trimmed !== trimmed.toUpperCase()) return false;

  // Strip parentheticals for further checks
  const cleaned = cleanCharacterName(trimmed);
  if (!cleaned) return false;

  // Must not be a stop word
  if (STOP_WORDS.has(cleaned)) return false;

  // Must not end with a colon (rules out "TITLE:", "NOTE:", transitions)
  if (trimmed.endsWith(":")) return false;

  // Must not look like a scene heading fragment
  if (/^(INT|EXT)\.?[\s/]/.test(trimmed)) return false;

  // Must not be a transition line ("CUT TO:", "FADE OUT.", etc.)
  if (/\bTO:$/.test(trimmed)) return false;
  if (/^(FADE|CUT|DISSOLVE|SMASH|MATCH|JUMP)/.test(cleaned) && cleaned.length < 30) return false;

  // Must not be purely numeric or punctuation
  if (/^[\d\s.,\-–—]+$/.test(cleaned)) return false;

  // Length guard — character names are short
  if (cleaned.length > 40) return false;

  // Must contain at least one sequence of 2+ letters
  if (!/[A-Z]{2,}/.test(cleaned)) return false;

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

// --- Character line regex ---
// Matches lines that could be character cues: optionally indented, letters/numbers/spaces/apostrophes
const CHAR_LINE_REGEX = /^\s{0,20}([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9\s'().-]+)$/;

// --- highlightDirectionText ---
// Returns typed segments marking known character names in direction text
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
  const map = new Map<string, { dialogueCount: number; scenes: Set<number> }>();

  for (const scene of scenes) {
    const seenInScene = new Set<string>();
    for (const part of scene.parts) {
      if (part.type === "dialogue") {
        const name = part.character;
        if (!map.has(name)) map.set(name, { dialogueCount: 0, scenes: new Set() });
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
    .filter((c) => c.dialogueCount > 0)
    .sort((a, b) => b.dialogueCount - a.dialogueCount);
}

// --- parseScenesFallback ---
// Line-by-line state machine. Strictly requires ALL-CAPS lines for character cues.
export function parseScenesFallback(text: string): { scenes: Scene[]; characters: CharacterStats[] } {
  const scenes: Scene[] = [];
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

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(HEADING_REGEX);

    if (headingMatch) {
      finalizeScene();
      parts = [];
      currentDialogue = null;
      directionLines = [];

      const afterSetting = headingMatch[4]?.trim() ?? "";
      // Strip trailing scene number if present (e.g. "CAFE DE FLORE - NIGHT 12")
      const trailing = afterSetting.match(/(.*?)(\s*\d+)$/);
      const cleanedAfter = trailing ? trailing[1].trim() : afterSetting;
      const dashIdx = cleanedAfter.lastIndexOf(" - ");
      const location = dashIdx !== -1 ? cleanedAfter.slice(0, dashIdx).trim() : cleanedAfter;
      const time = dashIdx !== -1 ? cleanedAfter.slice(dashIdx + 3).trim() : "";

      current = {
        sceneNumber: scenes.length + 1,
        heading: `${headingMatch[3]} ${cleanedAfter}`.trim(),
        setting: headingMatch[3].replace(/\.$/, "").toUpperCase(),
        location,
        time,
        duration: undefined,
      };
      continue;
    }

    if (!current) continue;

    const trimmed = line.trim();

    // Blank line — flush dialogue if open, reset dialogue state
    if (!trimmed) {
      flushDialogue();
      continue;
    }

    // Check for character cue: CHAR_LINE_REGEX match + isCharacterCue
    const charMatch = trimmed.match(CHAR_LINE_REGEX);
    if (charMatch && isCharacterCue(trimmed)) {
      flushDialogue();
      flushDirection();
      const name = cleanCharacterName(charMatch[1].trim());
      if (name) {
        currentDialogue = { character: name, lines: [] };
      }
      continue;
    }

    // If we're in a dialogue block, accumulate dialogue
    if (currentDialogue) {
      currentDialogue.lines.push(trimmed);
      continue;
    }

    // Otherwise it's direction
    directionLines.push(trimmed);
  }

  finalizeScene();

  const characters = buildCharacterStats(scenes);
  return { scenes, characters };
}
