import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const KINDS = new Set(["plan_boundary", "street_class", "public_allocation_zone", "urban_renewal_search_zone", "well_radius", "quarter"]);

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) return NextResponse.json({ error: "שכבה לא מוכרת" }, { status: 404 });
  const { data, error } = await supabase().rpc("binyanit_layer_geojson", { p_kind: kind });
  if (error) return NextResponse.json({ error: "שגיאה בטעינת השכבה" }, { status: 502 });
  return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=600" } });
}
