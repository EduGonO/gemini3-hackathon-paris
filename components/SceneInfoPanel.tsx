"use client";

import { useState } from "react";
import type { SceneData, Character, Location, TeamMember } from "@/types/schema";

// ─── Extended role list ───────────────────────────────────────────────────────────────────────────

const TEAM_ROLES = [
  // Direction
  "Director", "1st AD", "2nd AD", "Script Supervisor",
  // Production
  "Producer", "Executive Producer", "Line Producer", "Production Assistant",
  // Camera
  "Director of Photography", "Camera Operator", "Focus Puller", "Gaffer",
  // Lighting & Electrical
  "Electrician", "Best Boy Electric",
  // Sound
  "Sound Engineer", "Boom Operator",
  // Art
  "Production Designer", "Set Decorator", "Props",
  // Wardrobe & Makeup
  "Costume Designer", "Wardrobe", "Makeup Artist", "Hair & Makeup",
  // Post
  "Editor", "VFX", "Colorist",
  // Logistics
  "Location Manager", "Transportation", "Catering", "Cleaning Staff",
  // Casting
  "Casting Director",
  // Other
  "Other",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

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

// ─── Props ────────────────────────────────────────────────────────────────────────────────────

interface Props {
  scene: SceneData;
  characters: Character[];
  allCharacters: Character[];
  location?: Location;
  team: TeamMember[];
  onUpdateScene: (patch: Partial<SceneData>) => void;
  onUpdateCharacter: (id: string, patch: Partial<Character>) => void;
  onMergeCharacters: (keepId: string, mergeIds: string[]) => void;
  onUpdateLocation: (id: string, patch: Partial<Location>) => void;
  onAddTeamMember: (m: TeamMember) => void;
  onUpdateTeamMember: (id: string, patch: Partial<TeamMember>) => void;
  onRemoveTeamMember: (id: string) => void;
}

// ─── Inline editable field ────────────────────────────────────────────────────────────────────────────

function EditField({
  value,
  placeholder,
  onSave,
}: {
  value?: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  if (editing) return (
    <div className="flex gap-1 items-center">
      <input
        autoFocus
        className="flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs text-blue-500 hover:text-blue-700">✓</button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
    </div>
  );

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="w-full text-left rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors group"
    >
      {value
        ? <span>{value}</span>
        : <span className="text-gray-300 italic">{placeholder ?? "—"}</span>
      }
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-[9px] text-gray-400">✎</span>
    </button>
  );
}

// ─── Character card ───────────────────────────────────────────────────────────────────────────────────

function CharacterCard({
  char,
  colorClass,
  allCharacters,
  onUpdate,
  onMerge,
}: {
  char: Character;
  colorClass: string;
  allCharacters: Character[];
  onUpdate: (patch: Partial<Character>) => void;
  onMerge: (keepId: string, mergeIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  return (
    <div className={`rounded-lg border p-2 text-xs ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold truncate">{char.canonicalName}</span>
          {char.aliases.length > 0 && (
            <span className="text-[9px] opacity-60">+{char.aliases.length} alias</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Merge trigger */}
          <button
            onClick={() => { setShowMerge((v) => !v); setExpanded(true); }}
            title="Merge characters"
            className="opacity-50 hover:opacity-100 text-[10px] px-1 rounded hover:bg-white/40 transition"
          >⇄</button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="opacity-50 hover:opacity-100 text-[10px] px-1 rounded hover:bg-white/40 transition"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      <div className="opacity-60 mt-0.5">{char.dialogueCount} lines · {char.sceneCount} scenes</div>

      {char.actorName && (
        <div className="mt-0.5 text-[10px] opacity-70">↳ {char.actorName}</div>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-current/10 pt-2">
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase tracking-wider opacity-50">actor</div>
            <EditField value={char.actorName} placeholder="actor name" onSave={(v) => onUpdate({ actorName: v })} />
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase tracking-wider opacity-50">email</div>
            <EditField value={char.actorEmail} placeholder="actor@email.com" onSave={(v) => onUpdate({ actorEmail: v })} />
          </div>
          {char.aliases.length > 0 && (
            <div className="space-y-0.5">
              <div className="text-[9px] uppercase tracking-wider opacity-50">aliases</div>
              <div className="flex flex-wrap gap-0.5">
                {char.aliases.map((a) => (
                  <span key={a} className="rounded bg-white/40 px-1 text-[9px]">{a}</span>
                ))}
              </div>
            </div>
          )}
          {showMerge && (
            <div className="space-y-1 border-t border-current/10 pt-1.5">
              <div className="text-[9px] uppercase tracking-wider opacity-50">merge another character here</div>
              <div className="flex gap-1">
                <select
                  value={mergeTarget}
                  onChange={(e) => setMergeTarget(e.target.value)}
                  className="flex-1 rounded border border-current/20 bg-white/60 px-1 py-0.5 text-[10px] outline-none"
                >
                  <option value="">select…</option>
                  {allCharacters.filter((c) => c.id !== char.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.canonicalName} ({c.dialogueCount} lines)</option>
                  ))}
                </select>
                <button
                  disabled={!mergeTarget}
                  onClick={() => { onMerge(char.id, [mergeTarget]); setMergeTarget(""); setShowMerge(false); }}
                  className="rounded bg-white/60 px-2 text-[10px] font-medium hover:bg-white/80 disabled:opacity-30 transition"
                >merge</button>
              </div>
            </div>
          )}
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase tracking-wider opacity-50">notes</div>
            <EditField value={char.notes} placeholder="add note…" onSave={(v) => onUpdate({ notes: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team member row ──────────────────────────────────────────────────────────────────────────────────

function TeamMemberRow({
  member,
  onUpdate,
  onRemove,
}: {
  member: TeamMember;
  onUpdate: (patch: Partial<TeamMember>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="font-medium text-gray-800">{member.name}</span>
          <span className="ml-1.5 text-[10px] text-gray-400">{member.role}</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 text-[10px] px-1">{expanded ? "▲" : "▼"}</button>
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 text-[10px] px-1 transition-colors">✕</button>
        </div>
      </div>
      {member.email && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{member.email}</div>}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2">
          <EditField value={member.name} placeholder="name" onSave={(v) => onUpdate({ name: v })} />
          <EditField value={member.email} placeholder="email" onSave={(v) => onUpdate({ email: v })} />
          <EditField value={member.phone} placeholder="phone" onSave={(v) => onUpdate({ phone: v })} />
          <EditField value={member.notes} placeholder="notes" onSave={(v) => onUpdate({ notes: v })} />
        </div>
      )}
    </div>
  );
}

// ─── Add crew form ────────────────────────────────────────────────────────────────────────────────

function AddCrewForm({ onAdd }: { onAdd: (m: TeamMember) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Director");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);

  function submit() {
    if (!name.trim()) return;
    if (!email.trim()) { setEmailError(true); return; }
    onAdd({ id: uid(), name: name.trim(), role, email: email.trim() });
    setName(""); setEmail(""); setEmailError(false); setOpen(false);
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="w-full rounded border border-dashed border-gray-300 py-1.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
    >
      + add crew member
    </button>
  );

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 space-y-1.5 text-xs">
      <input
        placeholder="Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs bg-white outline-none focus:border-blue-400"
      >
        {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div>
        <input
          placeholder="Email *"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
          className={`w-full rounded border px-2 py-1 text-xs outline-none focus:border-blue-400 ${emailError ? "border-red-400 bg-red-50" : "border-gray-300"}`}
        />
        {emailError && <div className="text-[10px] text-red-500 mt-0.5">Email is required</div>}
      </div>
      <div className="flex gap-1 justify-end pt-0.5">
        <button onClick={() => { setOpen(false); setEmailError(false); }} className="rounded px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200">cancel</button>
        <button onClick={submit} className="rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white hover:bg-blue-600">add</button>
      </div>
    </div>
  );
}

// ─── Import from JSON modal ────────────────────────────────────────────────────────────────────────

function ImportPeopleModal({
  onImport,
  onClose,
}: {
  onImport: (members: TeamMember[]) => void;
  onClose: () => void;
}) {
  const [json, setJson] = useState("");
  const [error, setError] = useState("");

  function handleImport() {
    try {
      const data = JSON.parse(json);
      const arr = Array.isArray(data) ? data : data.team ?? data.crew ?? data.people ?? [];
      if (!arr.length) { setError("No people found in JSON. Expected an array or object with team/crew/people key."); return; }
      const members: TeamMember[] = arr.map((item: any) => ({
        id: uid(),
        name: item.name ?? item.actorName ?? "Unknown",
        role: item.role ?? item.position ?? "Other",
        email: item.email ?? item.actorEmail ?? undefined,
        phone: item.phone ?? undefined,
        notes: item.notes ?? undefined,
      }));
      onImport(members);
      onClose();
    } catch {
      setError("Invalid JSON — paste a valid JSON array or object.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Import people from JSON</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Paste a JSON array of people, or an object with a <code className="bg-gray-100 px-1 rounded">team</code>, <code className="bg-gray-100 px-1 rounded">crew</code>, or <code className="bg-gray-100 px-1 rounded">people</code> key. Each entry should have <code className="bg-gray-100 px-1 rounded">name</code>, <code className="bg-gray-100 px-1 rounded">role</code>, and optionally <code className="bg-gray-100 px-1 rounded">email</code>.
          </p>
          <textarea
            value={json}
            onChange={(e) => { setJson(e.target.value); setError(""); }}
            placeholder={'{"name":"Alice","role":"Director","email":"alice@film.com"}'}
            rows={6}
            className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-mono outline-none focus:border-blue-400 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">cancel</button>
            <button onClick={handleImport} className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600">import</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────────────────────────

type PanelTab = "people" | "scene";

export default function SceneInfoPanel({
  scene, characters, allCharacters, location, team,
  onUpdateScene, onUpdateCharacter, onMergeCharacters,
  onUpdateLocation, onAddTeamMember, onUpdateTeamMember, onRemoveTeamMember,
}: Props) {
  const [tab, setTab] = useState<PanelTab>("people");
  const [showImport, setShowImport] = useState(false);

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function handleImport(members: TeamMember[]) {
    members.forEach((m) => onAddTeamMember(m));
  }

  const tabBtn = (t: PanelTab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors ${
        tab === t ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 text-sm h-full flex flex-col">

      {/* Scene header */}
      <div className="flex-shrink-0">
        <div className="flex gap-1 flex-wrap items-center">
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">{scene.setting}</span>
          {scene.time && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{scene.time}</span>}
          <span className="text-[10px] text-gray-400 ml-auto">{formatDuration(scene.duration)}</span>
        </div>
        <div className="mt-1 text-xs font-medium text-gray-700 truncate">{scene.locationName}</div>
        {location?.realWorldAddress && (
          <div className="text-[10px] text-gray-400 truncate">{location.realWorldAddress}</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-shrink-0 border-b border-gray-200 pb-1">
        <div className="flex gap-1">
          {tabBtn("people", `people (${characters.length + team.length})`)}
          {tabBtn("scene", "scene")}
        </div>
        {tab === "people" && (
          <button
            onClick={() => setShowImport(true)}
            className="text-[10px] text-gray-400 hover:text-blue-500 transition-colors px-1"
            title="Import from JSON"
          >
            ↓ import
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* PEOPLE TAB — cast + crew combined */}
        {tab === "people" && (
          <div className="space-y-2">

            {/* Cast section */}
            {characters.length > 0 && (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 px-0.5">
                  Cast · {characters.length}
                </div>
                {characters.map((c, i) => (
                  <CharacterCard
                    key={c.id}
                    char={c}
                    colorClass={CHAR_COLORS[i % CHAR_COLORS.length]}
                    allCharacters={allCharacters}
                    onUpdate={(patch) => onUpdateCharacter(c.id, patch)}
                    onMerge={onMergeCharacters}
                  />
                ))}
              </>
            )}

            {/* Separator when both sections have content */}
            {characters.length > 0 && (
              <div className="border-t border-gray-200 pt-2">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 px-0.5 mb-2">
                  Crew · {team.length}
                </div>
              </div>
            )}
            {characters.length === 0 && (
              <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 px-0.5 mb-2">
                Crew · {team.length}
              </div>
            )}

            {/* Crew section */}
            {team.map((m) => (
              <TeamMemberRow
                key={m.id}
                member={m}
                onUpdate={(patch) => onUpdateTeamMember(m.id, patch)}
                onRemove={() => onRemoveTeamMember(m.id)}
              />
            ))}

            <AddCrewForm onAdd={onAddTeamMember} />
          </div>
        )}

        {/* SCENE TAB */}
        {tab === "scene" && (
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">location</div>
              <div className="text-gray-700">{scene.locationName}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">real-world address</div>
              <EditField
                value={location?.realWorldAddress}
                placeholder="add address…"
                onSave={(v) => location && onUpdateLocation(location.id, { realWorldAddress: v })}
              />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">call time</div>
              <EditField value={scene.callTime} placeholder="09:00" onSave={(v) => onUpdateScene({ callTime: v })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">duration (est.)</div>
              <div className="text-gray-700">{formatDuration(scene.duration)}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">notes</div>
              <EditField value={scene.notes} placeholder="add notes…" onSave={(v) => onUpdateScene({ notes: v })} />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">shooting dates</div>
              {scene.shootingDates.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {scene.shootingDates.map((d) => (
                    <span key={d} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{d}</span>
                  ))}
                </div>
              ) : <span className="text-gray-300 italic">not scheduled</span>}
            </div>
            <div className="rounded border border-dashed border-gray-200 p-2.5 text-[10px] text-gray-400">
              📅 calendar integration — coming soon
            </div>
            <div className="rounded border border-dashed border-gray-200 p-2.5 text-[10px] text-gray-400">
              🌤 weather forecast — coming soon
            </div>
          </div>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportPeopleModal onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
