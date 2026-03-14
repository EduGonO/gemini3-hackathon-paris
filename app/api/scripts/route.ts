import { NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";

export interface ScriptMeta {
  name: string;
  filename: string;
  path: string;
  type: "script" | "project";
}

export async function GET() {
  try {
    const dir = join(process.cwd(), "public", "scripts");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".pdf") || f.endsWith(".txt") || f.endsWith(".fountain") || f.endsWith(".json")
    );
    const scripts: ScriptMeta[] = files.map((filename) => ({
      name: filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      filename,
      path: `/scripts/${encodeURIComponent(filename)}`,
      type: filename.endsWith(".json") ? "project" : "script",
    }));
    return NextResponse.json(scripts);
  } catch {
    return NextResponse.json([]);
  }
}
