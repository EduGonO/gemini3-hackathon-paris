import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServiceAccount } from "@/lib/serviceAccount";
import type { ProjectState } from "@/types/schema";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export async function POST(req: NextRequest) {
  try {
    const sa = getServiceAccount();
    const { project } = await req.json() as { project: ProjectState };
    if (!project?.film) {
      return NextResponse.json({ error: "Project data required" }, { status: 400 });
    }

    // Authenticate with Google APIs using service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: sa.type,
        project_id: sa.project_id,
        private_key_id: sa.private_key_id,
        private_key: sa.private_key,
        client_email: sa.client_email,
        client_id: sa.client_id,
      } as any,
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    const docs = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    const { film, scenes, characters, locations, team } = project;
    const charMap = new Map(characters.map((c) => [c.id, c]));
    const locMap = new Map(locations.map((l) => [l.id, l]));

    // ─── Build document content ──────────────────────────────────────────────────────────────────────────

    const title = `${film.title || "Untitled"} — Callsheet`;

    // Create the document
    const doc = await docs.documents.create({ requestBody: { title } });
    const docId = doc.data.documentId!;

    // Make document shareable
    await drive.permissions.create({
      fileId: docId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Build text content
    const lines: Array<{ text: string; style?: "TITLE" | "HEADING_1" | "HEADING_2" | "NORMAL_TEXT" | "HEADING_3" }> = [];

    lines.push({ text: title, style: "TITLE" });
    lines.push({ text: `Generated: ${new Date().toLocaleString()}`, style: "NORMAL_TEXT" });
    lines.push({ text: " ", style: "NORMAL_TEXT" });

    // Project info
    lines.push({ text: "PRODUCTION INFO", style: "HEADING_1" });
    if (film.author) lines.push({ text: `Written by: ${film.author}`, style: "NORMAL_TEXT" });
    if (film.shootingDateRange) lines.push({ text: `Shooting: ${film.shootingDateRange.startDate} → ${film.shootingDateRange.endDate}`, style: "NORMAL_TEXT" });
    if (film.generalLocation) lines.push({ text: `Location: ${film.generalLocation.city}${film.generalLocation.address ? `, ${film.generalLocation.address}` : ""}`, style: "NORMAL_TEXT" });
    if (film.defaultCallTime) lines.push({ text: `Default Call Time: ${film.defaultCallTime}`, style: "NORMAL_TEXT" });
    lines.push({ text: `Total Scenes: ${film.totalScenes}  |  Total Runtime: ${fmt(film.totalDuration)}`, style: "NORMAL_TEXT" });
    lines.push({ text: " ", style: "NORMAL_TEXT" });

    // Cast list
    if (characters.length > 0) {
      lines.push({ text: "CAST", style: "HEADING_1" });
      for (const c of characters) {
        const actorInfo = c.actorName
          ? `${c.actorName}${c.actorEmail ? ` <${c.actorEmail}>` : ""}`
          : "— unassigned";
        lines.push({ text: `${c.canonicalName}: ${actorInfo}  (${c.dialogueCount} lines, ${c.sceneCount} scenes)`, style: "NORMAL_TEXT" });
      }
      lines.push({ text: " ", style: "NORMAL_TEXT" });
    }

    // Crew list
    if (team.length > 0) {
      lines.push({ text: "CREW", style: "HEADING_1" });
      for (const m of team) {
        lines.push({ text: `${m.role}: ${m.name}${m.email ? ` <${m.email}>` : ""}${m.phone ? ` · ${m.phone}` : ""}`, style: "NORMAL_TEXT" });
      }
      lines.push({ text: " ", style: "NORMAL_TEXT" });
    }

    // Scene breakdown
    lines.push({ text: "SCENE BREAKDOWN", style: "HEADING_1" });
    for (const s of scenes) {
      const loc = locMap.get(s.locationId);
      const address = s.locationOverride ?? loc?.realWorldAddress ?? "";
      const castNames = s.characterIds.map((id) => charMap.get(id)?.canonicalName ?? id).join(", ");
      const callTime = s.callTime ?? film.defaultCallTime ?? "";
      const shootDate = s.shootingDate ?? "";

      lines.push({ text: `Scene ${s.sceneNumber} — ${s.heading}`, style: "HEADING_2" });
      lines.push({ text: `Setting: ${s.setting}  |  Time: ${s.time || "—"}  |  Duration: ${fmt(s.duration)}`, style: "NORMAL_TEXT" });
      lines.push({ text: `Location: ${s.locationName}${address ? ` (${address})` : ""}`, style: "NORMAL_TEXT" });
      if (shootDate) lines.push({ text: `Shoot Date: ${shootDate}${callTime ? `  |  Call: ${callTime}` : ""}`, style: "NORMAL_TEXT" });
      if (castNames) lines.push({ text: `Cast: ${castNames}`, style: "NORMAL_TEXT" });
      if (s.notes) lines.push({ text: `Notes: ${s.notes}`, style: "NORMAL_TEXT" });
      lines.push({ text: " ", style: "NORMAL_TEXT" });
    }

    // Build batch update requests to insert and style content
    const requests: any[] = [];
    let index = 1; // Google Docs starts at index 1

    for (const line of lines) {
      const text = line.text + "\n";
      requests.push({
        insertText: { location: { index }, text },
      });
      if (line.style && line.style !== "NORMAL_TEXT") {
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: index, endIndex: index + text.length },
            paragraphStyle: { namedStyleType: line.style },
            fields: "namedStyleType",
          },
        });
      }
      index += text.length;
    }

    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    return NextResponse.json({ docUrl, docId, title });
  } catch (err: any) {
    console.error("Callsheet generation error:", err);
    return NextResponse.json({ error: err.message ?? "Failed to generate callsheet" }, { status: 500 });
  }
}
