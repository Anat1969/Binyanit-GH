import type { PotentialReport, RouteResult, UnitEstimate } from "@/engine";
import { ROUTE_TITLES } from "@/engine";

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

export interface SummaryItem {
  label: string;
  value: string;
  section?: string;
}

export interface SummaryBlock {
  title: string;
  status: string;
  eligible: boolean;
  items: SummaryItem[];
}

/** The same summary as structured blocks: one numbered block per route, label + bold value + section. */
export function summaryBlocks(rep: PotentialReport): SummaryBlock[] {
  return rep.routes.map((r) => {
    if (!r.eligible) {
      return {
        title: r.title,
        status: "לא זמין",
        eligible: false,
        items: r.blockers.map((b) => ({ label: "סיבה", value: b.text, section: b.section })),
      };
    }
    const pa = r.publicAllocation;
    const allocation: SummaryItem = !pa.applies
      ? { label: "הקצאה לצרכי ציבור", value: "לא חלה", section: pa.section }
      : pa.required
        ? { label: "הקצאה לצרכי ציבור", value: `${fmt(pa.area)} מ"ר`, section: pa.section }
        : { label: "הקצאה לצרכי ציבור", value: `פטור: ${pa.exemption}`, section: pa.section };
    const height: SummaryItem[] = r.estimatedHeightM ? [{ label: "גובה משוער", value: `${fmt(r.estimatedHeightM)} מ׳` }] : [];
    if (r.route === "demolish") {
      return {
        title: r.title,
        status: "זכאי לבחינה",
        eligible: true,
        items: [
          { label: "קומה טיפוסית מורחבת", value: `${fmt(r.expandedFloorArea)} מ"ר`, section: r.floorSteps[0]?.section },
          { label: "תוספת קומות", value: `${r.addedFullFloors}`, section: r.floorSteps[1]?.section },
          { label: "סך זכויות", value: `כ-${fmt(r.totalRights)} מ"ר`, section: r.floorSteps[1]?.section },
          { label: "קומות מרביות", value: `${r.maxFloors}`, section: r.floorSteps[1]?.section },
          { label: "תכסית מרבית", value: `${r.coveragePct}%`, section: r.floorSteps[1]?.section },
          ...height,
          allocation,
        ],
      };
    }
    return {
      title: r.title,
      status: "זכאי לבחינה",
      eligible: true,
      items: [
        ...(r.m2PerUnit ? [{ label: 'תוספת ליח"ד', value: `${r.m2PerUnit} מ"ר`, section: r.floorSteps[0]?.section ?? "4.1.2" }] : []),
        { label: "תוספת קומות", value: floorsPhrase(r), section: r.floorSteps[0]?.section ?? "4.1.2" },
        { label: "תוספת שטח משוערת", value: `כ-${fmt(r.addedArea)} מ"ר`, section: r.floorSteps[0]?.section ?? "4.1.2" },
        ...height,
        allocation,
      ],
    };
  });
}

/** One-line comparison of the routes by new apartments. Reads estimateNewUnits output only. */
export function unitsVerdict(est: UnitEstimate[]): { title: string; text: string } {
  const open = est.filter((e) => e.eligible && e.newUnits > 0).sort((a, b) => b.newUnits - a.newUnits);
  if (!open.length) {
    return {
      title: "אף מסלול זמין אינו מוסיף דירות חדשות",
      text: "בבניין זה המסלולים הזמינים מגדילים את הדירות הקיימות בלבד, או שאינם חלים. הפירוט בכרטיסי המסלולים.",
    };
  }
  const best = open[0];
  const retrofit = open.find((e) => e.route === "retrofit");
  if (best.route === "demolish" && retrofit) {
    const gap = best.newUnits - retrofit.newUnits;
    return {
      title: "הריסה ובנייה מחדש מוסיפה יותר דירות, בתמורה לפינוי זמני",
      text: `כ-${best.newUnits} דירות חדשות לעומת כ-${retrofit.newUnits} בחיזוק ומיגון, הפרש של ${gap}. בהריסה ובנייה הדיירים מתפנים לתקופת הבנייה ומקבלים בניין חדש. בחיזוק ומיגון הם נשארים בבניין.`,
    };
  }
  if (open.length === 1) {
    return {
      title: `המסלול היחיד שמוסיף דירות: ${ROUTE_TITLES[best.route]}`,
      text: `כ-${best.newUnits} דירות חדשות, ${best.perExistingUnit.toFixed(2)} לכל דירה קיימת. ${best.residentsStay ? "הדיירים נשארים בבניין." : "הדיירים מתפנים לתקופת הבנייה."}`,
    };
  }
  return {
    title: `המסלול שמוסיף הכי הרבה דירות: ${ROUTE_TITLES[best.route]}`,
    text: `כ-${best.newUnits} דירות חדשות, ${best.perExistingUnit.toFixed(2)} לכל דירה קיימת. ${best.residentsStay ? "הדיירים נשארים בבניין." : "הדיירים מתפנים לתקופת הבנייה."}`,
  };
}
