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
  "MAIN TITLE", "MAIN TITLES", "ROLL", "ROLL MAIN TITLE", "ROLL TITLES",
  "THE", "END", "CONTINUED", "CONT", "MORE", "ALL",
  "DAY", "NIGHT", "DUSK", "DAWN", "MORNING", "EVENING", "LATER",
  "CONTINUOUS", "MOMENTS LATER", "SIMULTANEOUSLY",
  "INTERCUT", "INTERCUT WITH",
  "POV", "INSERT", "BACK TO SCENE", "BACK TO",
  "SCENE", "SERIES OF SHOTS",
  "OVER", "OVER BLACK", "BLACK",
  "WE SEE", "WE HEAR",
  "CLOSE ON", "CLOSE UP", "WIDE ON", "PULL BACK", "PUSH IN",
  "ANGLE ON", "NEW ANGLE", "ANOTHER ANGLE", "SAME",
  "A", "AN", "AND", "OR", "TO", "IN", "ON", "AT", "BY",
  "INT.", "EXT.", "V.O.", "O.S.", "O.C.",
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

// --- isCharacterCue ---
function isCharacterCue(trimmed: string): boolean {
  if (!trimmed) return false;
  if (trimmed !== trimmed.toUpperCase()) return false;
  const cleaned = cleanCharacterName(trimmed);
  if (!cleaned) return false;
  if (STOP_WORDS.has(cleaned)) return false;
  if (trimmed.endsWith(":")) return false;
  if (/^(INT|EXT)\.?[\s/]/.test(trimmed)) return false;
  if (/\bTO:$/.test(trimmed)) return false;
  if (/^(FADE|CUT|DISSOLVE|SMASH|MATCH|JUMP)/.test(cleaned) && cleaned.length < 30) return false;
  if (/^[\d\s.,\-–—]+$/.test(cleaned)) return false;
  if (cleaned.length > 40) return false;
  if (!/[A-Z]{2,}/.test(cleaned)) return false;
  return true;
}

// --- estimateSceneDuration ---
// Formula:
//   dialogue words  → 2.5 words/sec (natural speaking pace)
//   direction words → 1.5 words/sec (visual action plays slower than prose reads)
//   per dialogue exchange (character switch) → +0.8s pause/blocking
//   minimum per scene → 3 seconds
//
// Scene type adjustments:
//   action-heavy (few/no dialogue parts, long direction) → direction pace slows to 1.0 w/s
//   dialogue-heavy (>70% dialogue words) → slight speed-up: dialogue at 2.8 w/s
//   montage keyword detected → direction at 0.5 w/s (montages play fast visually)
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
      if (part.character !== prevChar) {
        exchanges += 1;
        prevChar = part.character;
      }
    } else {
      directionWords += words;
      if (/montage|quick cuts|series of shots/i.test(part.text)) {
        isMontage = true;
      }
    }
  }

  const totalWords = dialogueWords + directionWords;
  const dialogueRatio = totalWords > 0 ? dialogueWords / totalWords : 0;

  // Tune pace based on scene type
  let dialoguePace = 2.5;   // words per second
  let directionPace = 1.5;  // words per second

  if (isMontage) {
    directionPace = 0.5;
  } else if (dialogueRatio < 0.2 && directionWords > 20) {
    // Action-heavy scene
    directionPace = 1.0;
  } else if (dialogueRatio > 0.7) {
    // Dialogue-heavy scene
    dialoguePace = 2.8;
  }

  const dialogueTime = dialogueWords / dialoguePace;
  const directionTime = directionWords / directionPace;
  const pauseTime = exchanges * 0.8;

  const total = dialogueTime + directionTime + pauseTime;
  return Math.max(3, Math.round(total));
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
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), isCharacter: false });
    }
    segments.push({ text: match[0], isCharacter: true, character: cleanCharacterName(match[0]) });
    lastIndex = start + match[0].length;
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
    const sceneObj: Scene = {
      ...(current as Scene),
      parts,
      characters: chars,
      rawText: parts
        .map((p) => (p.type === "dialogue" ? `${p.character}\n${p.text}` : p.text))
        .join("\n"),
    };
    // Estimate duration immediately after building scene
    sceneObj.duration = estimateSceneDuration(sceneObj);
    scenes.push(sceneObj);
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(HEADING_REGEX);

    if (headingMatch) {
      finalizeScene();
      parts = [];
      currentDialogue = null;
      directionLines = [];

      const afterSetting = headingMatch[4]?.trim() ?? "";
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
    if (!trimmed) {
      flushDialogue();
      continue;
    }

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

    if (currentDialogue) {
      currentDialogue.lines.push(trimmed);
    } else {
      directionLines.push(trimmed);
    }
  }

  finalizeScene();

  const characters = buildCharacterStats(scenes);
  return { scenes, characters };
}
