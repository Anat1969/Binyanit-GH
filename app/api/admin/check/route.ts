import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({ code: null }));
  return (await isAdmin(code)) ? NextResponse.json({ ok: true }) : unauthorized();
}
