import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminCode, isAdmin, unauthorized } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

const CATS = new Set(["binding", "background", "historical", "indirect"]);

export async function GET(req: Request) {
  const code = adminCode(req);
  if (!(await isAdmin(code))) return unauthorized();
  const { data, error } = await supabase().rpc("binyanit_admin_docs", { p_code: code });
  if (error) return NextResponse.json({ error: "שגיאה בטעינה" }, { status: 502 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const code = adminCode(req);
  if (!(await isAdmin(code))) return unauthorized();
  const b = await req.json().catch(() => null);
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "יש להזין שם למסמך" }, { status: 400 });
  if (!CATS.has(b?.category)) return NextResponse.json({ error: "סיווג לא תקין" }, { status: 400 });
  const url = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v : "");
  const { data, error } = await supabase().rpc("binyanit_admin_doc_save", {
    p_code: code,
    p_id: typeof b.id === "string" ? b.id : null,
    p_title: title,
    p_category: b.category,
    p_description: typeof b.description === "string" ? b.description.slice(0, 1000) : "",
    p_file_url: url(b.file_url),
    p_source_url: url(b.source_url),
    p_sort: Number.isInteger(b.sort) ? b.sort : null,
    p_published: typeof b.published === "boolean" ? b.published : true,
  });
  if (error) return NextResponse.json({ error: "השמירה נכשלה" }, { status: 502 });
  revalidatePath("/documents");
  return NextResponse.json({ id: data });
}

export async function DELETE(req: Request) {
  const code = adminCode(req);
  if (!(await isAdmin(code))) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });
  const { error } = await supabase().rpc("binyanit_admin_doc_archive", { p_code: code, p_id: id });
  if (error) return NextResponse.json({ error: "ההסרה נכשלה" }, { status: 502 });
  revalidatePath("/documents");
  return NextResponse.json({ ok: true });
}
