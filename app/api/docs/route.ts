import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Open editing by Anat's decision (11.10.2026): anyone may add, rename, reclassify or remove documents.
// Removal is soft (archived), so nothing is lost.
const CATS = new Set(["binding", "background", "historical", "indirect"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "יש להזין שם למסמך" }, { status: 400 });
  if (!CATS.has(b?.category)) return NextResponse.json({ error: "סיווג לא תקין" }, { status: 400 });
  const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : null;
  const fileUrl = typeof b.file_url === "string" && /^https:\/\//.test(b.file_url) ? b.file_url : "";
  if (!id && !fileUrl) return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  const { data, error } = await supabase().rpc("binyanit_doc_save", {
    p_id: id,
    p_title: title,
    p_category: b.category,
    p_description: typeof b.description === "string" ? b.description.slice(0, 1000) : "",
    p_file_url: fileUrl,
    p_sort: Number.isInteger(b.sort) ? b.sort : null,
  });
  if (error || !data) return NextResponse.json({ error: "השמירה נכשלה" }, { status: 502 });
  revalidatePath("/documents");
  return NextResponse.json({ id: data });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });
  const { error } = await supabase().rpc("binyanit_doc_archive", { p_id: id });
  if (error) return NextResponse.json({ error: "ההסרה נכשלה" }, { status: 502 });
  revalidatePath("/documents");
  return NextResponse.json({ ok: true });
}
