import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey } from "@/lib/serviceAccount";

// Try models in order until one works
const MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-pro",
];

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { message, context } = await req.json() as { message: string; context?: object };
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const systemPrompt = context
    ? `You are a helpful film production assistant with access to the following script project data:\n\n${JSON.stringify(context, null, 2)}\n\nAnswer questions about the script, characters, scenes, locations, scheduling, and production planning. Be concise and filmmaker-focused. Use bullet points for lists.`
    : "You are a helpful film production assistant. Answer questions about filmmaking, script breakdowns, production planning, and scheduling. Be concise.";

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  // Try each model until one succeeds
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );

      if (res.status === 404) continue; // model not available, try next

      if (!res.ok) {
        const errText = await res.text();
        // If it's an auth/quota error, no point trying other models
        if (res.status === 400 || res.status === 403 || res.status === 429) {
          return NextResponse.json({ error: `Gemini API error (${res.status}): ${errText}` }, { status: 502 });
        }
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) continue;
      return NextResponse.json({ text, model });
    } catch { continue; }
  }

  return NextResponse.json({
    error: "Could not reach any Gemini model. Check that GEMINI_API_KEY is set and valid.",
  }, { status: 502 });
}
