import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "קואורדינטות לא תקינות" }, { status: 400 });
  }
  const db = supabase();
  const { data, error } = await db.rpc("binyanit_lookup", { p_lon: lon, p_lat: lat });
  if (error) return NextResponse.json({ error: "שגיאה בבדיקה המרחבית" }, { status: 502 });
  let quota = null;
  if (data?.quarter) {
    const { data: q } = await db
      .from("binyanit_quarter_counters")
      .select("threshold, units_used")
      .eq("quarter", data.quarter)
      .maybeSingle();
    if (q?.threshold != null) quota = { threshold: q.threshold, used: q.units_used };
  }
  return NextResponse.json({ ...data, quarter_quota: quota });
}
