"use client";

import { useState, useRef, useEffect } from "react";
import type { ProjectState } from "@/types/schema";

interface Message {
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
}

interface Props {
  project?: ProjectState;
}

const SUGGESTIONS = [
  "How many scenes does each character have?",
  "Which scenes are scheduled for outdoor shooting?",
  "List all INT scenes with more than 2 characters",
  "What's the total estimated runtime?",
  "Which characters appear most frequently?",
];

export default function GeminiChat({ project }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    // Build minimal context — don't send full raw text, just structured data
    const context = project ? {
      film: project.film,
      scenes: project.scenes.map((s) => ({
        sceneNumber: s.sceneNumber,
        heading: s.heading,
        setting: s.setting,
        locationName: s.locationName,
        time: s.time,
        characterIds: s.characterIds,
        duration: s.duration,
        shootingDate: s.shootingDate,
        notes: s.notes,
      })),
      characters: project.characters.map((c) => ({
        canonicalName: c.canonicalName,
        id: c.id,
        sceneCount: c.sceneCount,
        dialogueCount: c.dialogueCount,
        scenes: c.scenes,
        actorName: c.actorName,
      })),
      locations: project.locations.map((l) => ({
        id: l.id,
        scriptName: l.scriptName,
        sceneCount: l.sceneCount,
      })),
      team: project.team,
    } : undefined;

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", text: data.text }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: `⚠️ ${err.message ?? "Failed to get response"}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Message history */}
      {messages.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="max-h-48 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] text-white font-bold">G</div>
                )}
                <div className={`rounded-xl px-2.5 py-1.5 text-xs max-w-[85%] ${
                  m.role === "user"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-800 border border-gray-200"
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] text-white font-bold">G</div>
                <div className="rounded-xl px-2.5 py-1.5 bg-gray-50 border border-gray-200">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Suggestion chips — only shown before first message */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => send(s)}
              className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors text-left">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about the script…"
          disabled={loading}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors placeholder-gray-400 disabled:opacity-50 min-w-0"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 px-3 py-1.5 text-xs text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
        >↑</button>
      </div>
    </div>
  );
}
