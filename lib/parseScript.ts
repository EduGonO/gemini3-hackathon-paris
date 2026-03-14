// lib/parseScript.ts
// Script parsing utility — integrates with Gemini API
// Status: skeleton / in progress

import type { Scene, CharacterStats } from "@/components/ScriptDisplay";

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
 *
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
 *
 * TODO: implement in /app/api/ocr/route.ts
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

// --- Metadata extraction ---

/**
 * Extract title and author from the first page of raw screenplay text.
 * Looks for "by <name>" line after the title.
 */
export function extractMetadata(text: string): { title: string; author: string } {
  const firstPage = text.split("\f")[0] ?? "";
  const lines = firstPage.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines[0] ?? "Untitled";
  const authorLine = lines.find((l) => /^by\s+/i.test(l));
  const author = authorLine ? authorLine.replace(/^by\s+/i, "") : "Unknown";
  return { title, author };
}

// --- Fallback: client-side regex parser ---
// Used when Gemini API is unavailable (dev/offline mode)

const HEADING_REGEX =
  /^(\s*)(\d+\.?\s*)?(INT\.\/EXT\.|EXT\/INT\.|INT\/EXT|EXT\/INT|INT\.|EXT\.)\s*(.*)$/i;

/**
 * Minimal regex-based scene splitter.
 * Does NOT extract characters or dialogue — just splits on scene headings.
 * Good enough for a loading preview while Gemini processes.
 */
export function parseScenesFallback(text: string): Scene[] {
  const scenes: Scene[] = [];
  let current: Partial<Scene> | null = null;
  let buffer: string[] = [];

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const match = rawLine.match(HEADING_REGEX);
    if (match) {
      if (current) {
        scenes.push({ ...current, rawText: buffer.join("\n").trim() } as Scene);
      }
      const afterSetting = match[4]?.trim() ?? "";
      const dashIdx = afterSetting.lastIndexOf(" - ");
      const location = dashIdx !== -1 ? afterSetting.slice(0, dashIdx).trim() : afterSetting;
      const time = dashIdx !== -1 ? afterSetting.slice(dashIdx + 3).trim() : "";
      current = {
        sceneNumber: scenes.length + 1,
        heading: `${match[3]} ${afterSetting}`.trim(),
        setting: match[3].replace(/\.$/,  "").toUpperCase(),
        location,
        time,
        characters: [],  // TODO: populated by Gemini
        duration: undefined,
      };
      buffer = [];
    } else if (current) {
      buffer.push(rawLine);
    }
  }

  if (current) {
    scenes.push({ ...current, rawText: buffer.join("\n").trim() } as Scene);
  }

  return scenes;
}
