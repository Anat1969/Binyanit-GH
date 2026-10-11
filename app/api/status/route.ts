import { NextResponse } from "next/server";
import { llmAvailable, llmProvider } from "@/lib/llm";

export async function GET() {
  return NextResponse.json({ llm: llmAvailable(), provider: llmProvider() });
}
