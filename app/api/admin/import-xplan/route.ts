import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminCode, isAdmin, unauthorized } from "@/lib/admin";
import { supabase } from "@/lib/supabase";
import { PLAN } from "@/content/plan-meta";

export const maxDuration = 60;

// Official layers of the approved plan, from the Planning Administration's public Xplan service.
const XPLAN = "https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer";

type Feature = { type: "Feature"; geometry: unknown; properties: Record<string, unknown> };

async function query(layer: number, where: string): Promise<Feature[]> {
  const url = new URL(`${XPLAN}/${layer}/query`);
  url.search = new URLSearchParams({
    where,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.000005",
    f: "geojson",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(40_000), cache: "no-store" });
  if (!res.ok) throw new Error(`xplan layer ${layer}: ${res.status}`);
  const d = (await res.json()) as { features?: Feature[] };
  return d.features ?? [];
}

const pick = (fs: Feature[], name: string, props: (f: Feature) => Record<string, unknown>) =>
  fs
    .filter((f) => f.properties.mavat_name === name)
    .map((f) => ({ type: "Feature", geometry: f.geometry, properties: { name, source: "Xplan", objectid: f.properties.objectid, ...props(f) } }));

export async function POST(req: Request) {
  const code = adminCode(req);
  if (!(await isAdmin(code))) return unauthorized();

  const where = `pl_number='${PLAN.number}'`;
  try {
    const [blue, points, lines, polys] = await Promise.all([query(1, where), query(0, where), query(2, where), query(3, where)]);
    const plan = blue[0]?.properties ?? {};
    const layers: Record<string, unknown[]> = {
      plan_boundary: blue.map((f) => ({ type: "Feature", geometry: f.geometry, properties: { name: String(plan.pl_name ?? PLAN.name), source: "Xplan" } })),
      street_class: [
        ...pick(lines, "חזית פעילה", () => ({ class: "activeFrontage", buffer_m: 35 })),
        ...pick(lines, "ציר תחבורה ציבורית", () => ({ class: "massTransit", buffer_m: 35 })),
      ],
      special_guidelines: pick(polys, "הנחיות מיוחדות", () => ({})),
      building_restriction: pick(polys, "גבול מגבלות בניה", () => ({})),
      well_site: pick(points, "בלוק אתר קידוח", () => ({})),
    };

    const db = supabase();
    const counts: Record<string, number> = {};
    for (const [kind, features] of Object.entries(layers)) {
      if (!features.length) continue;
      const { data, error } = await db.rpc("binyanit_admin_replace_layer", { p_code: code, p_kind: kind, p_features: features });
      if (error) throw new Error(`${kind}: ${error.message}`);
      counts[kind] = data as number;
    }

    // Official objectives text, verbatim, as the first searchable source.
    const objectives = String(plan.pl_objectives ?? "")
      .split(/\s*\^\s*|\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (objectives.length) {
      const rows = objectives.map((body, i) => ({ ord: i + 1, kind: i === 0 ? "heading" : /^\d+\./.test(body) ? "item" : "para", section: null, title: null, body }));
      await db.rpc("binyanit_admin_replace_plan_text", { p_code: code, p_source: "מטרות התכנית (מינהל התכנון)", p_rows: rows });
    }

    const date = (v: unknown) => (typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : null);
    revalidatePath("/check");
    revalidatePath("/qa");
    return NextResponse.json({
      counts,
      plan: {
        status: plan.internet_short_status ?? null,
        published: date(plan.pl_date_8),
        approvalHearing: date(plan.pl_date7),
        units: plan.pq_authorised_quantity_120 ?? null,
        unitsAdded: plan.quantity_delta_120 ?? null,
        areaDunam: plan.pl_area_dunam ?? null,
        url: plan.pl_url ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "הייבוא נכשל" }, { status: 502 });
  }
}
