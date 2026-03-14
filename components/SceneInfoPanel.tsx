"use client";

import { useState } from "react";
import type { SceneData, Character, Location, TeamMember, FilmProject } from "@/types/schema";
import ShootingCalendar from "@/components/ShootingCalendar";

const TEAM_ROLES = [
  "Director", "1st AD", "2nd AD", "Script Supervisor",
  "Producer", "Executive Producer", "Line Producer", "Production Assistant",
  "Director of Photography", "Camera Operator", "Focus Puller", "Gaffer", "Best Boy Electric",
  "Electrician", "Sound Engineer", "Boom Operator",
  "Production Designer", "Set Decorator", "Props",
  "Costume Designer", "Wardrobe", "Makeup Artist", "Hair & Makeup",
  "Editor", "VFX", "Colorist",
  "Location Manager", "Transportation", "Catering", "Cleaning Staff",
  "Casting Director", "Other",
] as const;

const CHAR_COLORS = [
  "bg-red-100 text-red-800 border-red-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-orange-100 text-orange-800 border-orange-200",
];

function uid() { return Math.random().toString(36).slice(2, 9); }

interface Props {
  scene: SceneData;
  characters: Character[];
  allCharacters: Character[];
  location?: Location;
  team: TeamMember[];
  film: FilmProject;
  allScenes: SceneData[];
  onUpdateScene: (patch: Partial<SceneData>) => void;
  onUpdateCharacter: (id: string, patch: Partial<Character>) => void;
  onMergeCharacters: (keepId: string, mergeIds: string[]) => void;
  onUpdateLocation: (id: string, patch: Partial<Location>) => void;
  onAddTeamMember: (m: TeamMember) => void;
  onUpdateTeamMember: (id: string, patch: Partial<TeamMember>) => void;
  onRemoveTeamMember: (id: string) => void;
  onUpdateSceneById: (id: string, patch: Partial<SceneData>) => void;
}

function EditField({ value, placeholder, type = "text", onSave }: {
  value?: string; placeholder?: string; type?: string; onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) return (
    <div className="flex gap-1 items-center">
      <input autoFocus type={type} value={draft} placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { onSave(draft); setEditing(false); } }}
        className="flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs text-blue-500">✓</button>
    </div>
  );
  return (
    <button onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="w-full text-left rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors group">
      {value ? <span>{value}</span> : <span className="text-gray-300 italic">{placeholder ?? "—"}</span>}
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-[9px] text-gray-400">✎</span>
    </button>
  );
}

function CharacterCard({ char, colorClass, allCharacters, onUpdate, onMerge }: {
  char: Character; colorClass: string; allCharacters: Character[];
  onUpdate: (p: Partial<Character>) => void; onMerge: (k: string, m: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  return (
    <div className={`rounded-lg border p-2 text-xs ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold truncate">{char.canonicalName}</span>
          {char.aliases.length > 0 && <span className="text-[9px] opacity-60">+{char.aliases.length}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => { setShowMerge((v) => !v); setExpanded(true); }} title="Merge" className="opacity-50 hover:opacity-100 text-[10px] px-1 rounded hover:bg-white/40">⇄</button>
          <button onClick={() => setExpanded((v) => !v)} className="opacity-50 hover:opacity-100 text-[10px] px-1">{expanded ? "▲" : "▼"}</button>
        </div>
      </div>
      <div className="opacity-60 mt-0.5">{char.dialogueCount} lines · {char.sceneCount} scenes</div>
      {char.actorName && <div className="mt-0.5 text-[10px] opacity-70">↳ {char.actorName}</div>}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-current/10 pt-2">
          <div><div className="text-[9px] uppercase opacity-50 mb-0.5">actor</div>
            <EditField value={char.actorName} placeholder="actor name" onSave={(v) => onUpdate({ actorName: v })} /></div>
          <div><div className="text-[9px] uppercase opacity-50 mb-0.5">email</div>
            <EditField value={char.actorEmail} placeholder="email" onSave={(v) => onUpdate({ actorEmail: v })} /></div>
          {showMerge && (
            <div className="space-y-1 border-t border-current/10 pt-1.5">
              <div className="text-[9px] uppercase opacity-50">merge into this character</div>
              <div className="flex gap-1">
                <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}
                  className="flex-1 rounded border border-current/20 bg-white/60 px-1 py-0.5 text-[10px] outline-none">
                  <option value="">select…</option>
                  {allCharacters.filter((c) => c.id !== char.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.canonicalName} ({c.dialogueCount})</option>
                  ))}
                </select>
                <button disabled={!mergeTarget} onClick={() => { onMerge(char.id, [mergeTarget]); setMergeTarget(""); setShowMerge(false); }}
                  className="rounded bg-white/60 px-2 text-[10px] hover:bg-white/80 disabled:opacity-30">merge</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamMemberRow({ member, assigned, onToggleAssign, onUpdate, onRemove }: {
  member: TeamMember; assigned: boolean;
  onToggleAssign: () => void; onUpdate: (p: Partial<TeamMember>) => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border p-2 text-xs transition-colors ${assigned ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={assigned} onChange={onToggleAssign}
          className="rounded border-gray-300 text-blue-500 cursor-pointer flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-gray-800">{member.name}</span>
          <span className="ml-1.5 text-[10px] text-gray-400">{member.role}</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 text-[10px]">{expanded ? "▲" : "▼"}</button>
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-[10px] transition-colors">✕</button>
        </div>
      </div>
      {member.email && <div className="text-[10px] text-gray-400 ml-5 truncate">{member.email}</div>}
      {expanded && (
        <div className="mt-2 space-y-1 border-t border-gray-200 pt-2 ml-5">
          <EditField value={member.name} placeholder="name" onSave={(v) => onUpdate({ name: v })} />
          <EditField value={member.email} placeholder="email" onSave={(v) => onUpdate({ email: v })} />
          <EditField value={member.phone} placeholder="phone" onSave={(v) => onUpdate({ phone: v })} />
        </div>
      )}
    </div>
  );
}

function AddCrewForm({ onAdd }: { onAdd: (m: TeamMember) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [role, setRole] = useState("Director");
  const [email, setEmail] = useState(""); const [emailError, setEmailError] = useState(false);
  function submit() {
    if (!name.trim()) return;
    if (!email.trim()) { setEmailError(true); return; }
    onAdd({ id: uid(), name: name.trim(), role, email: email.trim() });
    setName(""); setEmail(""); setEmailError(false); setOpen(false);
  }
  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full rounded border border-dashed border-gray-300 py-1.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
      + add crew member
    </button>
  );
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 space-y-1.5 text-xs">
      <input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
      <select value={role} onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs bg-white outline-none">
        {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div>
        <input placeholder="Email *" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
          className={`w-full rounded border px-2 py-1 text-xs outline-none focus:border-blue-400 ${emailError ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
        {emailError && <div className="text-[10px] text-red-500 mt-0.5">Email required</div>}
      </div>
      <div className="flex gap-1 justify-end">
        <button onClick={() => { setOpen(false); setEmailError(false); }} className="rounded px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200">cancel</button>
        <button onClick={submit} className="rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white hover:bg-blue-600">add</button>
      </div>
    </div>
  );
}

function ImportPeopleModal({ onImport, onClose }: { onImport: (m: TeamMember[]) => void; onClose: () => void }) {
  const [json, setJson] = useState(""); const [error, setError] = useState("");
  function handle() {
    try {
      const data = JSON.parse(json);
      const arr = Array.isArray(data) ? data : data.team ?? data.crew ?? data.people ?? [];
      if (!arr.length) { setError("No people found."); return; }
      onImport(arr.map((item: any) => ({ id: uid(), name: item.name ?? "Unknown", role: item.role ?? "Other", email: item.email ?? undefined, phone: item.phone ?? undefined })));
      onClose();
    } catch { setError("Invalid JSON"); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Import from JSON</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">Paste a JSON array with <code className="bg-gray-100 px-0.5 rounded">name</code>, <code className="bg-gray-100 px-0.5 rounded">role</code>, <code className="bg-gray-100 px-0.5 rounded">email</code> fields, or an object with a <code className="bg-gray-100 px-0.5 rounded">team</code> / <code className="bg-gray-100 px-0.5 rounded">crew</code> key.</p>
          <textarea value={json} onChange={(e) => { setJson(e.target.value); setError(""); }} rows={5}
            placeholder={'{"name":"Alice","role":"Director","email":"a@film.com"}'}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono outline-none focus:border-blue-400 resize-none" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">cancel</button>
            <button onClick={handle} className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600">import</button>
          </div>
        </div>
      </div>
    </div>
  );
}

type PanelTab = "people" | "scene" | "calendar";

export default function SceneInfoPanel({
  scene, characters, allCharacters, location, team, film, allScenes,
  onUpdateScene, onUpdateCharacter, onMergeCharacters, onUpdateLocation,
  onAddTeamMember, onUpdateTeamMember, onRemoveTeamMember, onUpdateSceneById,
}: Props) {
  const [tab, setTab] = useState<PanelTab>("people");
  const [showImport, setShowImport] = useState(false);

  const assignedCrew = scene.assignedCrew ?? [];

  function toggleCrewAssign(memberId: string) {
    const next = assignedCrew.includes(memberId)
      ? assignedCrew.filter((id) => id !== memberId)
      : [...assignedCrew, memberId];
    onUpdateScene({ assignedCrew: next });
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const effectiveCallTime = scene.callTime ?? film.defaultCallTime;

  const tabBtn = (t: PanelTab, label: string) => (
    <button onClick={() => setTab(t)}
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
        tab === t ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"}`}>
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col space-y-2">
      {/* Scene header */}
      <div className="flex-shrink-0">
        <div className="flex gap-1 flex-wrap items-center">
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">{scene.setting}</span>
          {scene.time && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{scene.time}</span>}
          <span className="text-[10px] text-gray-400 ml-auto">{formatDuration(scene.duration)}</span>
        </div>
        <div className="mt-0.5 text-xs font-medium text-gray-700 truncate">{scene.locationName}</div>
        {scene.shootingDate && (
          <div className="text-[10px] text-blue-500 mt-0.5">
            📅 {scene.shootingDate}{effectiveCallTime ? ` · call ${effectiveCallTime}` : ""}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-shrink-0 border-b border-gray-200 pb-1">
        <div className="flex gap-1">
          {tabBtn("people", `people (${characters.length + team.length})`)}
          {tabBtn("scene", "scene")}
          {tabBtn("calendar", "📅")}
        </div>
        {tab === "people" && (
          <button onClick={() => setShowImport(true)} className="text-[10px] text-gray-400 hover:text-blue-500 px-1">↓ import</button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">

        {/* PEOPLE */}
        {tab === "people" && (
          <>
            {characters.length > 0 && (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Cast · {characters.length}</div>
                {characters.map((c, i) => (
                  <CharacterCard key={c.id} char={c} colorClass={CHAR_COLORS[i % CHAR_COLORS.length]}
                    allCharacters={allCharacters}
                    onUpdate={(p) => onUpdateCharacter(c.id, p)}
                    onMerge={onMergeCharacters} />
                ))}
                <div className="border-t border-gray-200 pt-2">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Crew · {team.length}</div>
                </div>
              </>
            )}
            {characters.length === 0 && (
              <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Crew · {team.length}</div>
            )}
            {team.map((m) => (
              <TeamMemberRow key={m.id} member={m} assigned={assignedCrew.includes(m.id)}
                onToggleAssign={() => toggleCrewAssign(m.id)}
                onUpdate={(p) => onUpdateTeamMember(m.id, p)}
                onRemove={() => onRemoveTeamMember(m.id)} />
            ))}
            <AddCrewForm onAdd={onAddTeamMember} />
          </>
        )}

        {/* SCENE */}
        {tab === "scene" && (
          <div className="space-y-2.5 text-xs">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">shooting date</div>
              <EditField value={scene.shootingDate} placeholder="YYYY-MM-DD" type="date" onSave={(v) => onUpdateScene({ shootingDate: v || undefined })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">call time {!scene.callTime && film.defaultCallTime ? `(default: ${film.defaultCallTime})` : ""}</div>
              <EditField value={scene.callTime} placeholder={film.defaultCallTime ?? "HH:MM"} type="time" onSave={(v) => onUpdateScene({ callTime: v || undefined })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">location override {!scene.locationOverride ? "(using script location)" : ""}</div>
              <EditField value={scene.locationOverride} placeholder={location?.realWorldAddress ?? film.generalLocation?.city ?? "address or location"} onSave={(v) => onUpdateScene({ locationOverride: v || undefined })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">real-world address</div>
              <EditField value={location?.realWorldAddress} placeholder="add address…" onSave={(v) => location && onUpdateLocation(location.id, { realWorldAddress: v })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">duration (est.)</div>
              <div className="px-1.5 text-gray-700">{formatDuration(scene.duration)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">notes</div>
              <EditField value={scene.notes} placeholder="add notes…" onSave={(v) => onUpdateScene({ notes: v })} />
            </div>
          </div>
        )}

        {/* CALENDAR */}
        {tab === "calendar" && (
          <ShootingCalendar
            film={film}
            scenes={allScenes}
            onUpdateScene={onUpdateSceneById}
          />
        )}
      </div>

      {showImport && (
        <ImportPeopleModal onImport={(ms) => ms.forEach(onAddTeamMember)} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
