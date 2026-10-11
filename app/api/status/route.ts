import { NextResponse } from "next/server";
import { llmAvailable } from "@/lib/llm";

export async function GET() {
  return NextResponse.json({ llm: llmAvailable() });
}
