"use client";

import { useState } from "react";
import type { Scene, CharacterStats } from "@/components/ScriptDisplay";

export interface DebugInfo {
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
  // parsed data
  scenes?: Scene[];
  characters?: CharacterStats[];
}

interface Props {
  info: DebugInfo;
  onClose: () => void;
}

function formatDuration(secs?: number): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function totalDuration(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);
}

export default function DebugPanel({ info, onClose }: Props) {
  const [tab, setTab] = useState<"debug" | "data">("debug");

  const uniqueLocations = info.scenes
    ? Array.from(new Set(info.scenes.map((s) => s.location).filter(Boolean))).sort()
    : [];

  const intCount = info.scenes?.filter((s) => s.setting === "INT").length ?? 0;
  const extCount = info.scenes?.filter((s) => s.setting === "EXT").length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-gray-700 bg-gray-950 text-green-400 shadow-2xl font-mono text-xs">

        {/* Header + tabs */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
          <div className="flex gap-3">
            <button
              onClick={() => setTab("debug")}
              className={`text-xs font-bold transition-colors ${tab === "debug" ? "text-green-300" : "text-gray-500 hover:text-gray-300"}`}
            >
              debug
            </button>
            <button
              onClick={() => setTab("data")}
              className={`text-xs font-bold transition-colors ${tab === "data" ? "text-green-300" : "text-gray-500 hover:text-gray-300"}`}
            >
              data {info.scenes ? `(${info.scenes.length} scenes)` : ""}
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </div>

        {/* DEBUG TAB */}
        {tab === "debug" && (
          <div className="max-h-80 overflow-y-auto p-4 space-y-3">
            {info.fileName && (
              <section>
                <div className="text-gray-500 mb-1">— file —</div>
                <div>name: <span className="text-white">{info.fileName}</span></div>
                {info.fileSize !== undefined && (
                  <div>size: <span className="text-white">{(info.fileSize / 1024).toFixed(1)} KB</span></div>
                )}
                {info.fileType && (
                  <div>type: <span className="text-white">{info.fileType}</span></div>
                )}
              </section>
            )}

            <section>
              <div className="text-gray-500 mb-1">— pipeline —</div>
              <div>
                ocr:{" "}
                <span className={info.ocrStatus === "ok" || info.ocrStatus?.startsWith("ok") ? "text-green-300" : info.ocrStatus === "error" ? "text-red-400" : "text-gray-500"}>
                  {info.ocrStatus ?? "idle"}
                </span>
              </div>
              <div>
                parse:{" "}
                <span className={info.parseStatus === "ok" ? "text-green-300" : info.parseStatus === "error" ? "text-red-400" : "text-gray-500"}>
                  {info.parseStatus ?? "idle"}
                </span>
              </div>
              {info.rawTextLength !== undefined && (
                <div>text: <span className="text-white">{info.rawTextLength.toLocaleString()} chars</span></div>
              )}
              {info.sceneCount !== undefined && (
                <div>scenes: <span className="text-white">{info.sceneCount}</span></div>
              )}
            </section>

            {info.error && (
              <section>
                <div className="text-red-400 mb-1">— error —</div>
                <div className="text-red-300 whitespace-pre-wrap">{info.error}</div>
              </section>
            )}

            {info.rawTextPreview && (
              <section>
                <div className="text-gray-500 mb-1">— raw text preview —</div>
                <pre className="text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {info.rawTextPreview}
                </pre>
              </section>
            )}

            {info.log.length > 0 && (
              <section>
                <div className="text-gray-500 mb-1">— log —</div>
                {info.log.map((entry, i) => (
                  <div key={i} className="text-gray-400">{entry}</div>
                ))}
              </section>
            )}
          </div>
        )}

        {/* DATA TAB */}
        {tab === "data" && (
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {!info.scenes ? (
              <div className="text-gray-500">No parsed data yet. Upload a script first.</div>
            ) : (
              <>
                {/* Summary */}
                <section>
                  <div className="text-gray-500 mb-1">— summary —</div>
                  <div>scenes: <span className="text-white">{info.scenes.length}</span>
                    <span className="text-gray-500 ml-2">INT:{intCount} EXT:{extCount}</span>
                  </div>
                  <div>characters: <span className="text-white">{info.characters?.length ?? 0}</span></div>
                  <div>locations: <span className="text-white">{uniqueLocations.length}</span></div>
                  <div>total duration: <span className="text-white">{formatDuration(totalDuration(info.scenes))}</span></div>
                </section>

                {/* Characters */}
                {info.characters && info.characters.length > 0 && (
                  <section>
                    <div className="text-gray-500 mb-1">— characters —</div>
                    <table className="w-full">
                      <thead>
                        <tr className="text-gray-600">
                          <th className="text-left pr-3">name</th>
                          <th className="text-right pr-3">lines</th>
                          <th className="text-right pr-3">scenes</th>
                          <th className="text-left text-[10px]">scene list</th>
                        </tr>
                      </thead>
                      <tbody>
                        {info.characters.map((c) => (
                          <tr key={c.name} className="border-t border-gray-800">
                            <td className="pr-3 text-green-300 py-0.5">{c.name}</td>
                            <td className="text-right pr-3 text-white">{c.dialogueCount}</td>
                            <td className="text-right pr-3 text-white">{c.sceneCount}</td>
                            <td className="text-gray-500 text-[10px] truncate max-w-[120px]">
                              {c.scenes.slice(0, 8).join(", ")}{c.scenes.length > 8 ? "…" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

                {/* Locations */}
                {uniqueLocations.length > 0 && (
                  <section>
                    <div className="text-gray-500 mb-1">— locations ({uniqueLocations.length}) —</div>
                    <div className="flex flex-wrap gap-1">
                      {uniqueLocations.map((loc) => (
                        <span key={loc} className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                          {loc}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Scene durations */}
                <section>
                  <div className="text-gray-500 mb-1">— scene durations —</div>
                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                    {info.scenes.map((s) => (
                      <div key={s.sceneNumber} className="flex items-center gap-2">
                        <span className="text-gray-600 w-5 text-right">{s.sceneNumber}</span>
                        <span className="text-gray-500 text-[10px] w-8">{s.setting}</span>
                        <span className="text-gray-400 flex-1 truncate text-[10px]">{s.location}</span>
                        <span className="text-white text-right">{formatDuration(s.duration)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
