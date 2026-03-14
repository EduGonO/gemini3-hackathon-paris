import { NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";

export interface ScriptMeta {
  name: string;        // display name (filename without extension)
  filename: string;    // full filename e.g. "my-script.pdf"
  path: string;        // public URL path e.g. "/scripts/my-script.pdf"
}

export async function GET() {
  try {
    const dir = join(process.cwd(), "public", "scripts");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".pdf") || f.endsWith(".txt") || f.endsWith(".fountain")
    );
    const scripts: ScriptMeta[] = files.map((filename) => ({
      name: filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      filename,
      path: `/scripts/${encodeURIComponent(filename)}`,
    }));
    return NextResponse.json(scripts);
  } catch {
    // Directory doesn't exist or unreadable — return empty list
    return NextResponse.json([]);
  }
}
