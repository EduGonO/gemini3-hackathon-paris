import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey, getOpenAiKey } from "@/lib/serviceAccount";

const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-pro",
];

const OPENAI_MODELS = ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"];

export async function POST(req: NextRequest) {
  const { message, context } = await req.json() as { message: string; context?: object };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const systemPrompt = context
    ? `You are a helpful film production assistant with access to the following script project data:\n\n${JSON.stringify(context, null, 2)}\n\nAnswer questions about the script, characters, scenes, locations, scheduling, and production planning. Be concise and filmmaker-focused. Use bullet points for lists.`
    : "You are a helpful film production assistant. Answer questions about filmmaking, script breakdowns, production planning, and scheduling. Be concise.";

  // ─── 1. Try Gemini ────────────────────────────────────────────────────────

  let geminiKey: string | null = null;
  try { geminiKey = getGeminiApiKey(); } catch { /* no key — skip Gemini */ }

  if (geminiKey) {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    };

    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );

        if (res.status === 404) continue;

        // Auth / quota errors — stop trying Gemini entirely
        if (res.status === 400 || res.status === 403 || res.status === 429) {
          const errText = await res.text();
          console.warn(`Gemini ${model} rejected (${res.status}): ${errText}`);
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!text) continue;

        return NextResponse.json({ text, model, provider: "gemini" });
      } catch { continue; }
    }
  }

  // ─── 2. Fall back to OpenAI ───────────────────────────────────────────────

  const openAiKey = getOpenAiKey();

  if (openAiKey) {
    for (const model of OPENAI_MODELS) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });

        // Model not available for this account — try next
        if (res.status === 404) continue;

        // Auth / quota errors — stop trying OpenAI entirely
        if (res.status === 401 || res.status === 429) {
          const errText = await res.text();
          console.warn(`OpenAI ${model} rejected (${res.status}): ${errText}`);
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content ?? "";
        if (!text) continue;

        return NextResponse.json({ text, model, provider: "openai" });
      } catch { continue; }
    }
  }

  // ─── 3. Both failed ───────────────────────────────────────────────────────

  const missing: string[] = [];
  if (!geminiKey) missing.push("GEMINI_API_KEY");
  if (!openAiKey) missing.push("OPENAI_KEY");

  return NextResponse.json({
    error: missing.length
      ? `No API keys configured. Add ${missing.join(" and/or ")} to .env.local to enable AI features.`
      : "All AI models are currently unavailable. Check your API keys and quota.",
  }, { status: 502 });
}
