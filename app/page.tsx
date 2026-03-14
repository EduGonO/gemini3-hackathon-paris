"use client";

import { useState, useCallback } from "react";
import ScriptDisplay, { Scene, CharacterStats } from "@/components/ScriptDisplay";
import DebugPanel from "@/components/DebugPanel";
import { parseScenesFallback } from "@/lib/parseScript";

type AppState = "idle" | "loading" | "ready" | "error";

interface DebugInfo {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  rawTextLength?: number;
  rawTextPreview?: string;
  sceneCount?: number;
  ocrStatus?: string;
  parseStatus?: string;
  error?: string;
  log: string[];
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterStats[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>({ log: [] });

  function log(msg: string) {
    setDebug((prev) => ({ ...prev, log: [...prev.log, `${new Date().toLocaleTimeString()} ${msg}`] }));
  }

  // Extract clean title from filename (strip extension)
  function titleFromFilename(filename: string): string {
    return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  }

  async function processFile(file: File) {
    setState("loading");
    setError("");
    const fileTitle = titleFromFilename(file.name);
    setTitle(fileTitle);
    setDebug({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "unknown",
      log: [],
    });

    log(`processing ${file.name}`);

    try {
      let text = "";

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        log("reading PDF as base64...");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        log("calling /api/ocr...");
        setDebug((prev) => ({ ...prev, ocrStatus: "pending" }));

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64 }),
        });

        if (!res.ok) {
          const err = await res.text();
          setDebug((prev) => ({ ...prev, ocrStatus: "error", error: err }));
          throw new Error(`OCR failed: ${res.status} ${err}`);
        }

        const data = await res.json();
        text = data.text ?? "";
        log(`OCR ok — ${text.length} chars, ${data.pages} pages`);
        setDebug((prev) => ({
          ...prev,
          ocrStatus: "ok",
          rawTextLength: text.length,
          rawTextPreview: text.slice(0, 400),
        }));
      } else {
        log("reading as plain text...");
        text = await file.text();
        setDebug((prev) => ({
          ...prev,
          ocrStatus: "ok (plaintext)",
          rawTextLength: text.length,
          rawTextPreview: text.slice(0, 400),
        }));
      }

      log("parsing scenes (fallback regex)...");
      setDebug((prev) => ({ ...prev, parseStatus: "pending" }));

      // TODO: swap for parseWithGemini(text) once /api/parse is ready
      const parsedScenes = parseScenesFallback(text);

      log(`parsed ${parsedScenes.length} scenes`);
      setDebug((prev) => ({
        ...prev,
        parseStatus: "ok",
        sceneCount: parsedScenes.length,
      }));

      setScenes(parsedScenes);
      setCharacters([]);
      setState("ready");
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      log(`ERROR: ${msg}`);
      setDebug((prev) => ({
        ...prev,
        error: msg,
        ocrStatus: prev.ocrStatus === "pending" ? "error" : prev.ocrStatus,
        parseStatus: prev.parseStatus === "pending" ? "error" : prev.parseStatus,
      }));
      setError(msg);
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
        <div className="flex gap-2">
          {state === "ready" && (
            <button
              onClick={() => { setState("idle"); setScenes([]); setTitle(""); }}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-300"
            >
              New script
            </button>
          )}
          <button
            onClick={() => setShowDebug((v) => !v)}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              showDebug
                ? "bg-gray-800 text-green-400"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            debug
          </button>
        </div>
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
              isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
            }`}
          >
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 19v-2.5M16.5 12L12 7.5 7.5 12M12 7.5v9" />
            </svg>
            <span className="mt-3 text-sm text-gray-500">Drop file or click to browse</span>
            <input id="file" type="file" accept=".pdf,.txt,.fountain" onChange={onInputChange} className="hidden" />
          </label>
          {state === "error" && (
            <p className="max-w-sm text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      )}

      {/* Loading */}
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
            <h2 className="text-lg font-semibold text-gray-900 capitalize">{title}</h2>
            <p className="text-xs text-gray-500">{scenes.length} scenes detected</p>
          </div>
          <div className="flex-1 min-h-0">
            <ScriptDisplay scenes={scenes} characters={characters} title={title} />
          </div>
        </div>
      )}

      {/* Debug panel */}
      {showDebug && (
        <DebugPanel info={debug} onClose={() => setShowDebug(false)} />
      )}
    </main>
  );
}
