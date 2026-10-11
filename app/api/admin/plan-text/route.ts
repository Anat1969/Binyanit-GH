import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminCode, isAdmin, unauthorized } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

// Loads a verbatim transcription (array of {ord, kind, section, title, body, page}) for one source document.
export async function POST(req: Request) {
  const code = adminCode(req);
  if (!(await isAdmin(code))) return unauthorized();
  const b = await req.json().catch(() => null);
  if (typeof b?.source !== "string" || !Array.isArray(b?.rows)) return NextResponse.json({ error: "מבנה לא תקין" }, { status: 400 });
  const { data, error } = await supabase().rpc("binyanit_admin_replace_plan_text", { p_code: code, p_source: b.source.slice(0, 120), p_rows: b.rows });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  revalidatePath("/qa");
  return NextResponse.json({ rows: data });
}
