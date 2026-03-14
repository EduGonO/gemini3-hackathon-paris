import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";

export async function POST(req: NextRequest) {
  try {
    const { file } = await req.json() as { file?: string };
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const buffer = Buffer.from(file, "base64");
    const data = await pdf(buffer);
    return NextResponse.json({ text: data.text, pages: data.numpages });
  } catch (err) {
    console.error("OCR error", err);
    return NextResponse.json({ error: "Failed to read PDF" }, { status: 500 });
  }
}
