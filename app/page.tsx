"use client";

import { useState, useCallback } from "react";
import ScriptDisplay, { Scene, CharacterStats } from "@/components/ScriptDisplay";
import { extractTextFromPdf, parseScenesFallback, extractMetadata } from "@/lib/parseScript";

type AppState = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterStats[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  async function processFile(file: File) {
    if (!file.name.endsWith(".pdf") && !file.name.endsWith(".txt") && !file.name.endsWith(".fountain")) {
      setError("Upload a .pdf, .txt, or .fountain file");
      setState("error");
      return;
    }

    setState("loading");
    setError("");

    try {
      let text = "";

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        text = await extractTextFromPdf(file);
      } else {
        text = await file.text();
      }

      const { title: scriptTitle } = extractMetadata(text);

      // TODO: replace parseScenesFallback with parseWithGemini(text)
      const parsedScenes = parseScenesFallback(text);

      setTitle(scriptTitle);
      setScenes(parsedScenes);
      setCharacters([]); // TODO: populated by Gemini
      setState("ready");
    } catch (err) {
      console.error(err);
      setError("Failed to process file. Try again.");
      setState("error");
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-gray-50 px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight text-gray-800">
          gemini filmmaker
        </h1>
        {state === "ready" && (
          <button
            onClick={() => { setState("idle"); setScenes([]); setTitle(""); }}
            className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-300"
          >
            New script
          </button>
        )}
      </div>

      {/* Upload screen */}
      {(state === "idle" || state === "error") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <h2 className="text-2xl font-light text-gray-800">Upload a screenplay</h2>
          <p className="text-sm text-gray-500">PDF, .fountain, or plain text</p>

          <label
            htmlFor="file"
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`flex w-80 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 bg-white hover:border-gray-400"
            }`}
          >
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 19v-2.5M16.5 12L12 7.5 7.5 12M12 7.5v9" />
            </svg>
            <span className="mt-3 text-sm text-gray-500">Drop file or click to browse</span>
            <input
              id="file"
              type="file"
              accept=".pdf,.txt,.fountain"
              onChange={onInputChange}
              className="hidden"
            />
          </label>

          {state === "error" && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>
      )}

      {/* Loading screen */}
      {state === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-gray-500">Parsing screenplay…</p>
        </div>
      )}

      {/* Script viewer */}
      {state === "ready" && scenes.length > 0 && (
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="mb-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500">{scenes.length} scenes detected</p>
          </div>
          <div className="flex-1 min-h-0">
            <ScriptDisplay scenes={scenes} characters={characters} title={title} />
          </div>
        </div>
      )}
    </main>
  );
}
