"use client";

import { useState, useCallback } from "react";
import ScriptDisplay, { Scene, CharacterStats } from "@/components/ScriptDisplay";
import DebugPanel, { DebugInfo } from "@/components/DebugPanel";
import ScriptSelector from "@/components/ScriptSelector";
import type { ScriptMeta } from "@/components/ScriptSelector";
import { parseScenesFallback } from "@/lib/parseScript";

type AppState = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterStats[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>({ log: [] });
  const [currentScript, setCurrentScript] = useState<string | undefined>();

  function log(msg: string) {
    setDebug((prev) => ({ ...prev, log: [...prev.log, `${new Date().toLocaleTimeString()} ${msg}`] }));
  }

  function titleFromFilename(filename: string): string {
    return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  }

  async function processText(text: string, sourceName: string, sourceSize?: number) {
    log(`parsing "${sourceName}"...`);
    setDebug((prev) => ({ ...prev, parseStatus: "pending" }));

    const { scenes: parsedScenes, characters: parsedChars, debugLog } = parseScenesFallback(text);

    log(`parsed ${parsedScenes.length} scenes, ${parsedChars.length} characters`);
    setDebug((prev) => ({
      ...prev,
      parseStatus: "ok",
      sceneCount: parsedScenes.length,
      scenes: parsedScenes,
      characters: parsedChars,
      debugLog,
    }));

    setScenes(parsedScenes);
    setCharacters(parsedChars);
    setTitle(titleFromFilename(sourceName));
    setState("ready");
  }

  async function processFile(file: File) {
    setState("loading");
    setError("");
    setCurrentScript(undefined);
    setDebug({ fileName: file.name, fileSize: file.size, fileType: file.type || "unknown", log: [] });
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

      await processText(text, file.name, file.size);
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

  async function loadDemoScript(script: ScriptMeta) {
    setState("loading");
    setError("");
    setCurrentScript(script.name);
    setDebug({ fileName: script.filename, fileType: "demo script", log: [] });
    log(`loading demo script: ${script.filename}`);

    try {
      const res = await fetch(script.path);
      if (!res.ok) throw new Error(`Failed to fetch ${script.path}: ${res.status}`);

      const blob = await res.blob();
      log(`fetched ${(blob.size / 1024).toFixed(1)} KB`);
      setDebug((prev) => ({ ...prev, fileSize: blob.size }));

      let text = "";

      if (script.filename.endsWith(".pdf")) {
        log("running OCR on demo PDF...");
        setDebug((prev) => ({ ...prev, ocrStatus: "pending" }));
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const ocrRes = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: base64 }),
        });
        if (!ocrRes.ok) throw new Error(`OCR failed: ${ocrRes.status}`);
        const data = await ocrRes.json();
        text = data.text ?? "";
        log(`OCR ok — ${text.length} chars, ${data.pages} pages`);
        setDebug((prev) => ({
          ...prev,
          ocrStatus: "ok",
          rawTextLength: text.length,
          rawTextPreview: text.slice(0, 400),
        }));
      } else {
        text = await blob.text();
        setDebug((prev) => ({
          ...prev,
          ocrStatus: "ok (plaintext)",
          rawTextLength: text.length,
          rawTextPreview: text.slice(0, 400),
        }));
      }

      await processText(text, script.filename);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      log(`ERROR: ${msg}`);
      setDebug((prev) => ({ ...prev, error: msg }));
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
          gemini3 hackathon paris - edu
        </h1>
        <div className="flex items-center gap-2">
          <ScriptSelector onLoad={loadDemoScript} currentScript={currentScript} />
          {state === "ready" && (
            <button
              onClick={() => {
                setState("idle");
                setScenes([]);
                setTitle("");
                setCharacters([]);
                setCurrentScript(undefined);
              }}
              className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-300"
            >
              new script
            </button>
          )}
          <button
            onClick={() => setShowDebug((v) => !v)}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              showDebug ? "bg-gray-800 text-green-400" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
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
            <p className="text-xs text-gray-500">{scenes.length} scenes · {characters.length} characters</p>
          </div>
          <div className="flex-1 min-h-0">
            <ScriptDisplay scenes={scenes} characters={characters} title={title} />
          </div>
        </div>
      )}

      {/* Debug panel */}
      {showDebug && <DebugPanel info={debug} onClose={() => setShowDebug(false)} />}
    </main>
  );
}
