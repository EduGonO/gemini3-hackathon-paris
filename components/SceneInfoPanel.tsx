"use client";

import { useState } from "react";
import type { SceneData, Character, Location, TeamMember, TeamRole } from "@/types/schema";

const TEAM_ROLES: TeamRole[] = [
  "Director", "Producer", "Executive Producer",
  "Director of Photography", "1st AD", "2nd AD",
  "Production Designer", "Costume Designer", "Hair & Makeup",
  "Sound", "Editor", "VFX", "Script Supervisor",
  "Location Manager", "Casting Director", "Other",
];

function uid() { return Math.random().toString(36).slice(2, 9); }

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

// ─── Inline editable field ─────────────────────────────────────────────────────────────────────────────
function EditField({ label, value, onSave }: { label: string; value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) return (
    <div className="flex gap-1 items-center">
      <input
        autoFocus
        className="flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs outline-none focus:border-blue-400"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-xs text-blue-500 hover:text-blue-700">✓</button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-1 group">
      <span className="text-gray-600">{value || <span className="text-gray-300 italic">—</span>}</span>
      <button onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 hover:text-blue-500 transition-opacity">edit</button>
    </div>
  );
}

// ─── Character card ───────────────────────────────────────────────────────────────────────────────────
function CharacterCard({ char, allCharacters, onUpdate, onMerge }: {
  char: Character;
  allCharacters: Character[];
  onUpdate: (patch: Partial<Character>) => void;
  onMerge: (keepId: string, mergeIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-800">{char.canonicalName}</span>
        <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 text-[10px]">
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      <div className="text-gray-400 mt-0.5">{char.dialogueCount} lines · {char.sceneCount} scenes</div>
      {char.aliases.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {char.aliases.map((a) => (
            <span key={a} className="rounded bg-gray-200 px-1 text-[10px] text-gray-600">{a}</span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">actor name</div>
            <EditField label="actor" value={char.actorName} onSave={(v) => onUpdate({ actorName: v })} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">actor email</div>
            <EditField label="email" value={char.actorEmail} onSave={(v) => onUpdate({ actorEmail: v })} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">notes</div>
            <EditField label="notes" value={char.notes} onSave={(v) => onUpdate({ notes: v })} />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 mb-0.5">merge into this character</div>
            <div className="flex gap-1">
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-[10px]"
              >
                <option value="">select character…</option>
                {allCharacters.filter((c) => c.id !== char.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.canonicalName}</option>
                ))}
              </select>
              <button
                disabled={!mergeTarget}
                onClick={() => { onMerge(char.id, [mergeTarget]); setMergeTarget(""); }}
                className="rounded bg-orange-100 px-2 text-[10px] text-orange-700 hover:bg-orange-200 disabled:opacity-40"
              >
                merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Team member row ──────────────────────────────────────────────────────────────────────────────────
function TeamMemberRow({ member, onUpdate, onRemove }: {
  member: TeamMember;
  onUpdate: (patch: Partial<TeamMember>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-gray-800">{member.name}</span>
          <span className="ml-1.5 text-gray-400">{member.role}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setExpanded((v) => !v)} className="text-gray-400 hover:text-gray-600 text-[10px]">{expanded ? "▲" : "▼"}</button>
          <button onClick={onRemove} className="text-red-300 hover:text-red-500 text-[10px]">✕</button>
        </div>
      </div>
      {member.email && <div className="text-gray-400 text-[10px] mt-0.5">{member.email}</div>}
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2">
          <EditField label="name" value={member.name} onSave={(v) => onUpdate({ name: v })} />
          <EditField label="email" value={member.email} onSave={(v) => onUpdate({ email: v })} />
          <EditField label="phone" value={member.phone} onSave={(v) => onUpdate({ phone: v })} />
        </div>
      )}
    </div>
  );
}

// ─── Add team member form ───────────────────────────────────────────────────────────────────────────────
function AddTeamMemberForm({ onAdd }: { onAdd: (m: TeamMember) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Director");
  const [email, setEmail] = useState("");

  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full rounded border border-dashed border-gray-300 py-1.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
      + add crew member
    </button>
  );

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 space-y-1.5 text-xs">
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
      <select value={role} onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
        {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400" />
      <div className="flex gap-1 justify-end">
        <button onClick={() => setOpen(false)} className="rounded px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200">cancel</button>
        <button
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ id: uid(), name: name.trim(), role, email: email.trim() || undefined });
            setName(""); setEmail(""); setOpen(false);
          }}
          className="rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white hover:bg-blue-600 disabled:opacity-40"
        >
          add
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────────────────────────
type PanelTab = "cast" | "crew" | "scene";

export default function SceneInfoPanel({
  scene, characters, allCharacters, location, team,
  onUpdateScene, onUpdateCharacter, onMergeCharacters,
  onUpdateLocation, onAddTeamMember, onUpdateTeamMember, onRemoveTeamMember,
}: Props) {
  const [tab, setTab] = useState<PanelTab>("cast");

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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
      <div className="flex gap-1 flex-shrink-0 border-b border-gray-200 pb-1">
        {tabBtn("cast", `cast (${characters.length})`)}
        {tabBtn("crew", `crew (${team.length})`)}
        {tabBtn("scene", "scene")}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">

        {/* CAST TAB */}
        {tab === "cast" && (
          characters.length > 0 ? (
            characters.map((c) => (
              <CharacterCard
                key={c.id}
                char={c}
                allCharacters={allCharacters}
                onUpdate={(patch) => onUpdateCharacter(c.id, patch)}
                onMerge={onMergeCharacters}
              />
            ))
          ) : (
            <p className="text-xs text-gray-400 italic">No characters in this scene</p>
          )
        )}

        {/* CREW TAB */}
        {tab === "crew" && (
          <div className="space-y-2">
            {team.map((m) => (
              <TeamMemberRow
                key={m.id}
                member={m}
                onUpdate={(patch) => onUpdateTeamMember(m.id, patch)}
                onRemove={() => onRemoveTeamMember(m.id)}
              />
            ))}
            <AddTeamMemberForm onAdd={onAddTeamMember} />
          </div>
        )}

        {/* SCENE TAB */}
        {tab === "scene" && (
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">location (script)</div>
              <div className="text-gray-700">{scene.locationName}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">real-world address</div>
              <EditField label="address" value={location?.realWorldAddress} onSave={(v) => location && onUpdateLocation(location.id, { realWorldAddress: v })} />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">call time</div>
              <EditField label="callTime" value={scene.callTime} onSave={(v) => onUpdateScene({ callTime: v })} />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">notes</div>
              <EditField label="notes" value={scene.notes} onSave={(v) => onUpdateScene({ notes: v })} />
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">duration (estimated)</div>
              <div className="text-gray-700">{formatDuration(scene.duration)}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 mb-0.5">shooting dates</div>
              {scene.shootingDates.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {scene.shootingDates.map((d) => (
                    <span key={d} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{d}</span>
                  ))}
                </div>
              ) : <span className="text-gray-300 italic text-[10px]">not scheduled</span>}
            </div>
            <div className="rounded border border-dashed border-gray-200 p-3 text-[10px] text-gray-400">
              📅 calendar integration — coming soon
            </div>
            <div className="rounded border border-dashed border-gray-200 p-3 text-[10px] text-gray-400">
              🌤 weather forecast — coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
