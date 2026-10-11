import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Anonymous usage statistics. No address, no coordinates, no personal data.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const row = {
      quarter: typeof b.quarter === "string" ? b.quarter.slice(0, 10) : null,
      in_plan: typeof b.in_plan === "boolean" ? b.in_plan : null,
      street_class: ["cityWide", "activeFrontage", "massTransit"].includes(b.street_class) ? b.street_class : null,
      existing_floors: Number.isInteger(b.existing_floors) ? b.existing_floors : null,
      existing_units: Number.isInteger(b.existing_units) ? b.existing_units : null,
      eligible_routes: Array.isArray(b.eligible_routes) ? b.eligible_routes.slice(0, 3).map(String) : [],
    };
    const { error } = await supabase().from("binyanit_address_checks").insert(row);
    return NextResponse.json({ ok: !error });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
