import type { PotentialReport, RouteResult } from "@/engine";

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 1 });

export function floorsPhrase(r: RouteResult): string {
  const full = r.addedFullFloors;
  const fullTxt = full === 0 ? "" : full === 1 ? "קומה מלאה אחת" : `${full} קומות מלאות`;
  const partTxt = r.partialRoofFraction > 0 ? `קומת גג חלקית (${Math.round(r.partialRoofFraction * 100)}%)` : "";
  if (!fullTxt && !partTxt) return "ללא תוספת קומות";
  return [fullTxt, partTxt].filter(Boolean).join(" ו");
}

/** Deterministic plain-language summary of engine output. No numbers are computed here. */
export function summarize(rep: PotentialReport): string[] {
  return rep.routes.map((r) => {
    if (!r.eligible) {
      const b = r.blockers[0];
      return `${r.title}: לא זמין. ${b.text} (${b.section}).`;
    }
    if (r.route === "demolish") {
      return `${r.title}: קומה טיפוסית מורחבת של ${fmt(r.expandedFloorArea)} מ"ר, סך זכויות כ-${fmt(r.totalRights)} מ"ר, עד ${r.maxFloors} קומות (${r.floorSteps[1]?.section ?? "טבלה 5"}).`;
    }
    const perUnit = r.m2PerUnit ? `תוספת ${r.m2PerUnit} מ"ר ליח"ד, ` : "";
    return `${r.title}: ${perUnit}${floorsPhrase(r)}, תוספת שטח משוערת של כ-${fmt(r.addedArea)} מ"ר (${r.floorSteps[0]?.section ?? "4.1.2"}).`;
  });
}
