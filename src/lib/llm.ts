import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Single grounded call. Returns null when the model declines or no text is produced. */
export async function complete(system: string, user: string): Promise<string | null> {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  return text || null;
}
