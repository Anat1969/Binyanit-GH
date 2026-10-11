import { NextResponse } from "next/server";
import { getQuarters } from "@/lib/data";

export async function GET() {
  const { data, error } = await getQuarters();
  if (error) return NextResponse.json({ error: "שגיאה בטעינת המכסות" }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
