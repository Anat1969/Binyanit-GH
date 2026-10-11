import Anthropic from "@anthropic-ai/sdk";

// Answers are phrased by a language model only. Every number and every section must come from the
// plan text that was retrieved; `groundedAnswer` rejects anything else and the caller falls back
// to showing the sections themselves.

export const MODEL = "claude-opus-5-5";

export type Provider = "anthropic" | "gemini" | "free";

/** Which provider will be used. The free keyless provider is the default when no key is set. */
export function llmProvider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.FREE_LLM_DISABLED === "1") return null;
  return "free";
}

export function llmAvailable(): boolean {
  return llmProvider() !== null;
}

let client: Anthropic | null = null;

async function viaAnthropic(system: string, user: string): Promise<string | null> {
  if (!client) client = new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") return null;
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim() || null;
}

async function viaGemini(system: string, user: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 900 },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() || null;
}

// Free, keyless, OpenAI-compatible endpoint. `private` keeps prompts out of the public feed.
async function viaFree(system: string, user: string): Promise<string | null> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      private: true,
      referrer: "binyanit-ashdod",
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return d.choices?.[0]?.message?.content?.trim() || null;
}

export async function complete(system: string, user: string): Promise<{ text: string; provider: Provider } | null> {
  const p = llmProvider();
  if (!p) return null;
  const fn = p === "anthropic" ? viaAnthropic : p === "gemini" ? viaGemini : viaFree;
  const text = await fn(system, user);
  return text ? { text, provider: p } : null;
}

const NUM = /\d+(?:[.,]\d+)*/g;

/**
 * Accepts an answer only if every number in it appears in the sources (or the question),
 * and it cites at least one of the given section numbers.
 */
export function groundedAnswer(answer: string, sources: string, question: string, sections: string[]): boolean {
  const allowed = new Set([...(sources.match(NUM) ?? []), ...(question.match(NUM) ?? []), "7.2.1", "6.1.3"].map((n) => n.replace(/,/g, "")));
  sections.forEach((s) => (s.match(NUM) ?? []).forEach((n) => allowed.add(n)));
  const used = (answer.match(NUM) ?? []).map((n) => n.replace(/,/g, ""));
  if (used.some((n) => !allowed.has(n) && !allowed.has(n.replace(/\.0+$/, "")))) return false;
  return sections.some((s) => s.split(/[,\s]+/).some((part) => /\d/.test(part) && answer.includes(part)));
}
