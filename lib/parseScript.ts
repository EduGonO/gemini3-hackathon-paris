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

// --- Gemini-powered parser (TODO) ---

/**
 * Send raw screenplay text to Gemini and get back structured scene data.
 * Uses responseMimeType: "application/json" for deterministic output.
 * TODO: implement in /app/api/parse/route.ts
 */
export async function parseWithGemini(text: string): Promise<ParseResult> {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Gemini parse failed");
  const data = await res.json();
  return data as ParseResult;
}

// --- PDF text extraction ---

/**
 * Extract raw text from a PDF file via /api/ocr.
 * Uses pdf-parse on the server side.
 */
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

// --- Fallback: client-side regex parser ---
// Splits screenplay text into structured scenes with dialogue and direction parts.

const HEADING_REGEX =
  /^(\s*)(\d+\.?\s*)?(INT\.\/EXT\.|EXT\/INT\.|INT\/EXT|EXT\/INT|INT\.|EXT\.)\s*(.*)$/i;

// A character cue: all-caps, short, trimmed — no lowercase letters
function isCharacterCue(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t !== t.toUpperCase()) return false;        // must be all caps
  if (t.length > 40) return false;               // character names are short
  if (/^(INT|EXT|CUT|FADE|THE|END)/.test(t)) return false; // exclude headings/directions
  if (/[.]{2,}/.test(t)) return false;           // exclude "CONTINUED..." etc
  return /^[A-Z]/.test(t);
}

/**
 * Regex-based scene and part splitter.
 * Returns scenes with structured parts (dialogue vs direction).
 * Good enough for a loading preview while Gemini is not yet wired up.
 */
export function parseScenesFallback(text: string): Scene[] {
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
    // collect unique characters from dialogue parts
    const chars = Array.from(
      new Set(parts.filter((p): p is Extract<ScenePart, { type: "dialogue" }> => p.type === "dialogue").map((p) => p.character))
    );
    scenes.push({
      ...(current as Scene),
      parts,
      characters: chars,
      rawText: parts.map((p) => p.type === "dialogue" ? `${p.character}\n${p.text}` : p.text).join("\n"),
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
      // blank line — flush dialogue if open
      if (inDialogue) flushDialogue();
      continue;
    }

    if (isCharacterCue(trimmed)) {
      flushDialogue();
      flushDirection();
      inDialogue = true;
      currentChar = trimmed;
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
  return scenes;
}
