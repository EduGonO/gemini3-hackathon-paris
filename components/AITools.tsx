"use client";

import { useState, useEffect } from "react";
import GeminiChat from "@/components/GeminiChat";
import CallsheetFallback from "@/components/CallsheetFallback";
import type { ProjectState } from "@/types/schema";

interface Props {
  project: ProjectState;
  onGenerateCallsheet: () => Promise<void>;
  generatingCallsheet: boolean;
  callsheetUrl?: string;
  callsheetError?: string;
}

function CallsheetPanel({ project, onGenerate, generating, url }: {
  project: ProjectState;
  onGenerate: () => void;
  generating: boolean;
  url?: string;
}) {
  const { film, scenes, characters, team } = project;
  const scheduled = scenes.filter((s) => s.shootingDate).length;
  const withActors = characters.filter((c) => c.actorName).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Project summary</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            [scenes.length, "scenes"],
            [characters.length, "characters"],
            [`${withActors}/${characters.length}`, "actors assigned"],
            [`${scheduled}/${scenes.length}`, "scenes scheduled"],
            [team.length, "crew members"],
          ].map(([val, label]) => (
            <div key={String(label)} className={`rounded-lg bg-gray-50 p-2.5 ${String(label) === "crew members" ? "col-span-2" : ""}`}>
              <div className="text-lg font-light text-gray-900">{val}</div>
              <div className="text-[10px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Callsheet readiness</div>
          {[
            { label: "Shooting dates set", ok: !!film.shootingDateRange?.startDate },
            { label: "General location set", ok: !!film.generalLocation?.city },
            { label: "Default call time set", ok: !!film.defaultCallTime },
            { label: "At least one actor assigned", ok: withActors > 0 },
            { label: "At least one crew member", ok: team.length > 0 },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className={ok ? "text-green-500" : "text-gray-300"}>{ok ? "✓" : "○"}</span>
              <span className={ok ? "text-gray-700" : "text-gray-400"}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Generating…
          </>
        ) : "📄 Generate Callsheet"}
      </button>

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 hover:bg-green-100 transition-colors">
          <span className="text-lg">✓</span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Callsheet ready</div>
            <div className="text-[11px] text-green-600 truncate">{url}</div>
          </div>
          <span className="ml-auto text-green-600 flex-shrink-0">↗</span>
        </a>
      )}
    </div>
  );
}

type AITab = "chat" | "callsheet";

export default function AITools({
  project, onGenerateCallsheet, generatingCallsheet, callsheetUrl, callsheetError,
}: Props) {
  const [tab, setTab] = useState<AITab>("chat");
  const [showFallback, setShowFallback] = useState(false);

  // Silently open browser callsheet whenever Google Docs generation fails
  useEffect(() => {
    if (callsheetError) {
      setShowFallback(true);
    }
  }, [callsheetError]);

  const tabBtn = (t: AITab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
        tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[11px] text-white font-bold flex-shrink-0">G</div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Tools</h2>
            <p className="text-[10px] text-gray-500">{project.film.title}</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {tabBtn("chat", "✶ Chat")}
          {tabBtn("callsheet", "📄 Callsheet")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "chat" && (
          <div className="h-full flex flex-col">
            <p className="text-[11px] text-gray-500 mb-3">
              Ask anything about your script — scene counts, character appearances, scheduling suggestions, or production questions.
            </p>
            <GeminiChat project={project} />
          </div>
        )}
        {tab === "callsheet" && (
          <CallsheetPanel
            project={project}
            onGenerate={onGenerateCallsheet}
            generating={generatingCallsheet}
            url={callsheetUrl}
          />
        )}
      </div>

      {showFallback && (
        <CallsheetFallback project={project} onClose={() => setShowFallback(false)} />
      )}
    </div>
  );
}
