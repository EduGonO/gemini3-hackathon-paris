"use client";

import { useState, useCallback } from "react";
import ScriptDisplay, { Scene, CharacterStats } from "@/components/ScriptDisplay";
import DebugPanel, { DebugInfo } from "@/components/DebugPanel";
import ScriptSelector from "@/components/ScriptSelector";
import ProjectSettings from "@/components/ProjectSettings";
import type { ScriptMeta } from "@/components/ScriptSelector";
import { parseScenesFallback } from "@/lib/parseScript";
import { buildProjectFromParsed, useProjectStore } from "@/lib/scriptStore";

type AppState = "idle" | "loading" | "ready" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CharacterStats[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>({ log: [] });
  const [currentScript, setCurrentScript] = useState<string | undefined>();
  const [generatingCallsheet, setGeneratingCallsheet] = useState(false);
  const [callsheetUrl, setCallsheetUrl] = useState<string | undefined>();
  const [callsheetError, setCallsheetError] = useState("");
  const store = useProjectStore();

  function log(msg: string) {
    setDebug((prev) => ({ ...prev, log: [...prev.log, `${new Date().toLocaleTimeString()} ${msg}`] }));
  }

  function titleFromFilename(filename: string): string {
    return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim();
  }

  async function processText(text: string, sourceName: string) {
    log(`parsing "${sourceName}"...`);
    setDebug((prev) => ({ ...prev, parseStatus: "pending" }));
    const { scenes: parsedScenes, characters: parsedChars, debugLog } = parseScenesFallback(text);
    const fileTitle = titleFromFilename(sourceName);
    log(`parsed ${parsedScenes.length} scenes, ${parsedChars.length} characters`);
    const project = buildProjectFromParsed(parsedScenes, parsedChars, fileTitle);
    store.load(project);
    setDebug((prev) => ({ ...prev, parseStatus: "ok", sceneCount: parsedScenes.length, scenes: parsedScenes, characters: parsedChars, debugLog }));
    setScenes(parsedScenes);
    setCharacters(parsedChars);
    setTitle(fileTitle);
    setAppState("ready");
  }

  async function processFile(file: File) {
    setAppState("loading"); setError(""); setCurrentScript(undefined);
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
        const res = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: base64 }) });
        if (!res.ok) { const err = await res.text(); setDebug((prev) => ({ ...prev, ocrStatus: "error", error: err })); throw new Error(`OCR failed: ${res.status} ${err}`); }
        const data = await res.json();
        text = data.text ?? "";
        log(`OCR ok — ${text.length} chars`);
        setDebug((prev) => ({ ...prev, ocrStatus: "ok", rawTextLength: text.length, rawTextPreview: text.slice(0, 400) }));
      } else {
        log("reading as plain text...");
        text = await file.text();
        setDebug((prev) => ({ ...prev, ocrStatus: "ok (plaintext)", rawTextLength: text.length, rawTextPreview: text.slice(0, 400) }));
      }
      await processText(text, file.name);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      log(`ERROR: ${msg}`);
      setDebug((prev) => ({ ...prev, error: msg, ocrStatus: prev.ocrStatus === "pending" ? "error" : prev.ocrStatus, parseStatus: prev.parseStatus === "pending" ? "error" : prev.parseStatus }));
      setError(msg); setAppState("error");
    }
  }

  async function loadDemoScript(script: ScriptMeta) {
    setAppState("loading"); setError(""); setCurrentScript(script.name);
    setDebug({ fileName: script.filename, fileType: "demo script", log: [] });
    log(`loading: ${script.filename}`);
    try {
      const res = await fetch(script.path);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const blob = await res.blob();
      log(`fetched ${(blob.size / 1024).toFixed(1)} KB`);
      setDebug((prev) => ({ ...prev, fileSize: blob.size }));
      let text = "";
      if (script.filename.endsWith(".pdf")) {
        log("OCR...");
        setDebug((prev) => ({ ...prev, ocrStatus: "pending" }));
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const ocrRes = await fetch("/api/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: base64 }) });
        if (!ocrRes.ok) throw new Error(`OCR failed: ${ocrRes.status}`);
        const data = await ocrRes.json();
        text = data.text ?? "";
        log(`OCR ok — ${text.length} chars`);
        setDebug((prev) => ({ ...prev, ocrStatus: "ok", rawTextLength: text.length, rawTextPreview: text.slice(0, 400) }));
      } else {
        text = await blob.text();
        setDebug((prev) => ({ ...prev, ocrStatus: "ok (plaintext)", rawTextLength: text.length, rawTextPreview: text.slice(0, 400) }));
      }
      await processText(text, script.filename);
    } catch (err: any) {
      const msg = err?.message ?? "Unknown error";
      log(`ERROR: ${msg}`);
      setDebug((prev) => ({ ...prev, error: msg }));
      setError(msg); setAppState("error");
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  async function generateCallsheet() {
    if (!store.project.film.title) return;
    setGeneratingCallsheet(true);
    setCallsheetUrl(undefined);
    setCallsheetError("");
    try {
      const res = await fetch("/api/callsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: store.project }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCallsheetUrl(data.docUrl);
    } catch (err: any) {
      setCallsheetError(err.message ?? "Failed to generate callsheet");
    } finally {
      setGeneratingCallsheet(false);
    }
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-gray-50 px-4 py-3">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {appState === "ready" ? (
            <>
              <h1 className="text-sm font-semibold tracking-tight text-gray-900 truncate capitalize flex-shrink-0">{title}</h1>
              <span className="text-[11px] text-gray-400 flex-shrink-0 hidden sm:block">
                {scenes.length} scenes · {store.project.characters.length} chars · {store.project.locations.length} loc
              </span>
            </>
          ) : (
            <h1 className="text-sm font-semibold tracking-tight text-gray-800">gemini3 hackathon paris - edu</h1>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ScriptSelector onLoad={loadDemoScript} currentScript={currentScript} />
          {appState === "ready" && (
            <>
              <button onClick={store.exportJSON}
                className="rounded px-2 py-1 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Export project JSON">↓ json</button>
              <button onClick={() => { setAppState("idle"); setScenes([]); setTitle(""); setCharacters([]); setCurrentScript(undefined); }}
                className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-300">new</button>
            </>
          )}
          <button onClick={() => setShowDebug((v) => !v)}
            className={`rounded px-3 py-1 text-xs transition-colors ${showDebug ? "bg-gray-800 text-green-400" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}>
            debug
          </button>
        </div>
      </div>

      {/* Project settings — always visible chip row when script loaded */}
      {appState === "ready" && (
        <div className="mb-2">
          <ProjectSettings film={store.project.film} onUpdate={store.updateFilm} />
        </div>
      )}

      {/* Upload */}
      {(appState === "idle" || appState === "error") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <h2 className="text-2xl font-light text-gray-800">Upload a screenplay</h2>
          <p className="text-sm text-gray-500">PDF, .fountain, or plain text</p>
          <label htmlFor="file" onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
            className={`flex w-80 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"}`}>
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 19v-2.5M16.5 12L12 7.5 7.5 12M12 7.5v9" />
            </svg>
            <span className="mt-3 text-sm text-gray-500">Drop file or click to browse</span>
            <input id="file" type="file" accept=".pdf,.txt,.fountain" onChange={onInputChange} className="hidden" />
          </label>
          {appState === "error" && <p className="max-w-sm text-center text-sm text-red-500">{error}</p>}
        </div>
      )}

      {appState === "loading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-gray-500">Parsing screenplay…</p>
        </div>
      )}

      {appState === "ready" && scenes.length > 0 && (
        <div className="flex-1 min-h-0">
          <ScriptDisplay
            scenes={scenes}
            characters={characters}
            title={title}
            project={store.project}
            onUpdateCharacter={store.updateCharacter}
            onMergeCharacters={store.mergeCharacters}
            onUpdateLocation={store.updateLocation}
            onUpdateScene={store.updateScene}
            onUpdateSceneById={store.updateScene}
            onAddTeamMember={store.addTeamMember}
            onUpdateTeamMember={store.updateTeamMember}
            onRemoveTeamMember={store.removeTeamMember}
            onGenerateCallsheet={generateCallsheet}
            generatingCallsheet={generatingCallsheet}
            callsheetUrl={callsheetUrl}
          />
        </div>
      )}

      {showDebug && <DebugPanel info={debug} onClose={() => setShowDebug(false)} />}
    </main>
  );
}
