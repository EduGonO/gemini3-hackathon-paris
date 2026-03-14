import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey } from "@/lib/serviceAccount";

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();
    const { message, context } = await req.json() as {
      message: string;
      context?: object;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build system context from project data
    const systemPrompt = context
      ? `You are a helpful film production assistant with access to the following script project data:\n\n${JSON.stringify(context, null, 2)}\n\nAnswer questions about the script, characters, scenes, locations, scheduling, and production planning. Be concise and filmmaker-focused.`
      : "You are a helpful film production assistant. Answer questions about filmmaking, script breakdowns, production planning, and scheduling.";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini API error: ${res.status} ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
