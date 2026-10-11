import {
  ASSUMED_FLOOR_HEIGHT_M,
  ASSUMED_NEW_UNIT_AREA_M2,
  DEMOLISH_ADD_FLOORS,
  DEMOLISH_COVERAGE_PCT,
  DEMOLISH_EDUCATION_BONUS_FLOORS,
  DEMOLISH_M2_PER_UNIT,
  DEMOLISH_MAX_FLOORS,
  DISCLAIMER,
  NEW_UNIT_AREA_RANGE,
  NON_RESIDENTIAL_FLOORS,
  PARTIAL_ROOF_FRACTION,
  PROTECTION_BASE_FULL_FLOORS,
  PROTECTION_M2_PER_UNIT,
  PUBLIC_ALLOCATION,
  RETROFIT_PERMIT_BEFORE_YEAR,
  RETROFIT_BASE_FULL_FLOORS,
  RETROFIT_M2_PER_UNIT,
  SEC,
  SMALL_BUILDING,
  UNIT_MIX,
  floorBand,
  streetGroup,
} from "./config";
import type {
  BuildingInput,
  Citation,
  FloorStep,
  PotentialReport,
  PublicAllocation,
  RouteId,
  RouteResult,
  SiteContext,
  UnitEstimate,
} from "./types";

export const ROUTE_TITLES: Record<RouteId, string> = {
  protection: "מיגון בלבד",
  retrofit: "חיזוק ומיגון",
  demolish: "הריסה ובנייה מחדש",
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const c = (text: string, section: string): Citation => ({ text, section });

export class InputError extends Error {}

export function validateInput(b: BuildingInput): string[] {
  const errors: string[] = [];
  const posInt = (v: number) => Number.isInteger(v) && v > 0;
  if (!posInt(b.existingFloors)) errors.push("מספר הקומות הקיימות חייב להיות מספר שלם חיובי");
  if (b.residential && !posInt(b.existingUnits)) errors.push("מספר יחידות הדיור חייב להיות מספר שלם חיובי");
  if (!b.residential && (!Number.isInteger(b.existingUnits) || b.existingUnits < 0))
    errors.push("מספר היחידות חייב להיות מספר שלם");
  if (!(b.typicalFloorArea > 0)) errors.push("שטח קומה טיפוסית חייב להיות גדול מאפס");
  if (!(b.plotArea > 0)) errors.push("שטח המגרש חייב להיות גדול מאפס");
  if (b.frontageLength != null && !(b.frontageLength > 0)) errors.push("אורך החזית חייב להיות גדול מאפס");
  if (b.permitYear != null && !(Number.isInteger(b.permitYear) && b.permitYear >= 1900 && b.permitYear <= 2100))
    errors.push("שנת היתר הבנייה חייבת להיות שנה בת 4 ספרות");
  if (b.permitYear == null && b.retrofitNeeded == null) errors.push("יש להזין את שנת היתר הבנייה");
  return errors;
}

/** Retrofit status follows from the permit year (see RETROFIT_PERMIT_BEFORE_YEAR). */
export function needsRetrofit(b: BuildingInput): boolean {
  if (b.permitYear != null) return b.permitYear < RETROFIT_PERMIT_BEFORE_YEAR;
  return Boolean(b.retrofitNeeded);
}

export function isSmallBuilding(b: BuildingInput): boolean {
  return (
    b.residential &&
    b.existingFloors <= SMALL_BUILDING.maxFloors &&
    b.typicalFloorArea * b.existingFloors <= SMALL_BUILDING.maxBuiltArea
  );
}

export function unitsPerTypicalFloor(b: BuildingInput): number {
  return b.existingUnits / b.existingFloors;
}

export function publicAllocation(
  route: RouteId,
  b: BuildingInput,
  site: SiteContext,
  groundFloorArea: number,
  totalRights: number,
): PublicAllocation {
  const section = SEC.publicAllocation;
  if (!site.publicAllocationZone) {
    return { applies: false, required: false, area: 0, exemption: null, section };
  }
  let exemption: string | null = null;
  if (route !== "demolish" && !b.newWing) exemption = "קומת הקרקע אינה מתפנה ולא מוקם אגף חדש";
  else if (b.frontageLength != null && b.frontageLength < PUBLIC_ALLOCATION.minFrontageM)
    exemption = `חזית המגרש קצרה מ-${PUBLIC_ALLOCATION.minFrontageM} מ׳`;
  else if (site.wellRadius) exemption = "המגרש בתחום רדיוס מגן של קידוח";
  else if (site.streetClass === "massTransit") exemption = "המגרש על ציר הסעת המונים";
  if (exemption) return { applies: true, required: false, area: 0, exemption, section };

  const byGround = Math.max(
    (groundFloorArea * PUBLIC_ALLOCATION.groundFloorPct) / 100,
    PUBLIC_ALLOCATION.minArea,
  );
  const cap = (totalRights * PUBLIC_ALLOCATION.maxPctOfRights) / 100;
  return { applies: true, required: true, area: r1(Math.min(byGround, cap)), exemption: null, section };
}

function baseResult(route: RouteId): RouteResult {
  return {
    route,
    title: ROUTE_TITLES[route],
    eligible: true,
    blockers: [],
    notes: [],
    m2PerUnit: 0,
    addedFullFloors: 0,
    partialRoofFraction: 0,
    floorSteps: [],
    expandedFloorArea: 0,
    footprintArea: 0,
    addedArea: 0,
    totalRights: 0,
    resultingFloors: 0,
    maxFloors: null,
    estimatedHeightM: null,
    coveragePct: null,
    publicAllocation: { applies: false, required: false, area: 0, exemption: null, section: SEC.publicAllocation },
    addsUnits: false,
  };
}

function finishAdditive(
  res: RouteResult,
  b: BuildingInput,
  site: SiteContext,
  m2PerUnit: number,
  steps: FloorStep[],
  partial: number,
) {
  const perFloorUnits = b.residential ? unitsPerTypicalFloor(b) : 0;
  const expanded = b.typicalFloorArea + m2PerUnit * perFloorUnits;
  const full = steps.reduce((s, x) => s + x.floors, 0);
  res.m2PerUnit = m2PerUnit;
  res.floorSteps = partial > 0 ? [...steps, { label: "קומת גג חלקית", floors: partial, section: steps[0]?.section ?? SEC.rules }] : steps;
  res.addedFullFloors = full;
  res.partialRoofFraction = partial;
  res.expandedFloorArea = r1(expanded);
  res.footprintArea = r1(expanded);
  res.addedArea = r1(b.existingUnits * m2PerUnit * (b.residential ? 1 : 0) + (full + partial) * expanded);
  res.totalRights = r1(b.typicalFloorArea * b.existingFloors + res.addedArea);
  res.resultingFloors = b.existingFloors + full + (partial > 0 ? 1 : 0);
  const pilotis = b.groundFloor === "pilotis" ? 1 : 0;
  res.estimatedHeightM = r1((res.resultingFloors + pilotis) * ASSUMED_FLOOR_HEIGHT_M);
  res.addsUnits = full + partial > 0;
  res.publicAllocation = publicAllocation(res.route, b, site, b.typicalFloorArea, res.totalRights);
}

export function computeProtection(b: BuildingInput, site: SiteContext): RouteResult {
  const res = baseResult("protection");
  if (b.protectedSpaces === "full") {
    res.blockers.push(c("לכל הדירות בבניין קיים מרחב מוגן, ולכן מסלול מיגון אינו רלוונטי", SEC.protection));
  }
  if (!b.residential) {
    const steps: FloorStep[] = [
      { label: "תוספת למבנה שאינו למגורים", floors: NON_RESIDENTIAL_FLOORS.protection, section: SEC.nonResidential },
    ];
    finishAdditive(res, b, site, 0, steps, 0);
    return res;
  }
  if (isSmallBuilding(b)) {
    finishAdditive(res, b, site, SMALL_BUILDING.m2PerUnit, [], 0);
    res.addsUnits = false;
    res.notes.push(c(`מבנה עד ${SMALL_BUILDING.maxFloors} קומות ועד ${SMALL_BUILDING.maxBuiltArea} מ"ר: תוספת ${SMALL_BUILDING.m2PerUnit} מ"ר ליח"ד בלבד, ללא יח"ד חדשות`, SEC.smallBuildings));
    return res;
  }
  const steps: FloorStep[] = [
    { label: "קומה מלאה בסיסית", floors: PROTECTION_BASE_FULL_FLOORS, section: SEC.protection },
  ];
  const active = streetGroup(site.streetClass) === "activeOrTransit";
  if (b.groundFloor === "built" && b.activeGroundUses && active) {
    steps.push({ label: "הסבת קומת קרקע בנויה לשימושים פעילים", floors: 1, section: SEC.protection });
  }
  finishAdditive(res, b, site, PROTECTION_M2_PER_UNIT, steps, PARTIAL_ROOF_FRACTION);
  if (b.protectedSpaces === "partial") {
    res.notes.push(c("בבניין קיימים מרחבים מוגנים בחלק מהדירות. התוספת ליח\"ד חלה על דירות ללא מרחב מוגן, לפי בדיקת הוועדה", SEC.protection));
  }
  return res;
}

export function computeRetrofit(b: BuildingInput, site: SiteContext): RouteResult {
  const res = baseResult("retrofit");
  if (!needsRetrofit(b)) {
    res.blockers.push(
      b.permitYear != null
        ? c(`היתר הבנייה ניתן ב-${b.permitYear}, אחרי 1.1.${RETROFIT_PERMIT_BEFORE_YEAR}, ולכן הבניין אינו טעון חיזוק מפני רעידות אדמה`, SEC.retrofitDef)
        : c("הבניין אינו טעון חיזוק מפני רעידות אדמה", SEC.retrofit),
    );
  }
  if (!b.residential) {
    const steps: FloorStep[] = [
      { label: "תוספת למבנה שאינו למגורים", floors: NON_RESIDENTIAL_FLOORS.retrofit, section: SEC.nonResidential },
    ];
    finishAdditive(res, b, site, 0, steps, 0);
    return res;
  }
  if (isSmallBuilding(b)) {
    finishAdditive(res, b, site, SMALL_BUILDING.m2PerUnit, [], 0);
    res.addsUnits = false;
    res.notes.push(c(`מבנה עד ${SMALL_BUILDING.maxFloors} קומות ועד ${SMALL_BUILDING.maxBuiltArea} מ"ר: תוספת ${SMALL_BUILDING.m2PerUnit} מ"ר ליח"ד בלבד, ללא יח"ד חדשות`, SEC.smallBuildings));
    return res;
  }
  const steps: FloorStep[] = [
    { label: "קומות מלאות בסיסיות", floors: RETROFIT_BASE_FULL_FLOORS, section: SEC.retrofit },
  ];
  const active = streetGroup(site.streetClass) === "activeOrTransit";
  if (active && b.activeGroundUses) {
    steps.push({ label: "שימושים פעילים בקומת הקרקע ברחוב פעיל / ציר הסעת המונים", floors: 1, section: SEC.retrofit });
  }
  if (b.groundFloor === "built") {
    steps.push({ label: "קומת קרקע בנויה", floors: 1, section: SEC.retrofit });
  }
  if (b.existingFloors >= 6) {
    steps.push({ label: "בניין בן 6 קומות ומעלה", floors: 1, section: SEC.retrofit });
    if (b.relocateGroundFloorUnits) {
      steps.push({ label: "העתקת יח\"ד מקומת הקרקע", floors: 1, section: SEC.retrofit });
    }
  }
  finishAdditive(res, b, site, RETROFIT_M2_PER_UNIT, steps, PARTIAL_ROOF_FRACTION);
  if (b.protectedSpaces === "full") {
    res.notes.push(c("בבניין קיימים מרחבים מוגנים לכל הדירות. רכיב המיגון כבר מתקיים", SEC.retrofit));
  }
  return res;
}

export function computeDemolish(b: BuildingInput, site: SiteContext): RouteResult {
  const res = baseResult("demolish");
  res.addsUnits = true;
  if (!b.residential) {
    res.blockers.push(c("טבלה 5 מגדירה הריסה ובנייה מחדש למבני מגורים בלבד. מבנה שאינו למגורים ייבחן בוועדה", SEC.table5));
    return res;
  }
  if (isSmallBuilding(b)) {
    res.blockers.push(c(`מבנה עד ${SMALL_BUILDING.maxFloors} קומות ועד ${SMALL_BUILDING.maxBuiltArea} מ"ר: חלה תוספת ${SMALL_BUILDING.m2PerUnit} מ"ר ליח"ד בלבד, ללא יח"ד חדשות`, SEC.smallBuildings));
    return res;
  }
  const group = streetGroup(site.streetClass);
  const band = floorBand(b.existingFloors);
  const add = DEMOLISH_ADD_FLOORS[group][band];
  const max = DEMOLISH_MAX_FLOORS[group][band];
  const coverage = DEMOLISH_COVERAGE_PCT[group];
  const bonus = b.publicEducation && b.publicEducation !== "none" ? DEMOLISH_EDUCATION_BONUS_FLOORS : 0;

  const expanded = b.typicalFloorArea + DEMOLISH_M2_PER_UNIT * unitsPerTypicalFloor(b);
  const rightsFloors = b.existingFloors + add + bonus;
  const totalRights = expanded * rightsFloors;

  const steps: FloorStep[] = [
    { label: "קומות קיימות בבנייה מחדש (קומה מורחבת)", floors: b.existingFloors, section: SEC.demolish },
    { label: `תוספת קומות לפי טבלה 5 (${b.existingFloors} קומות קיימות)`, floors: add, section: SEC.table5 },
  ];
  if (bonus) steps.push({ label: "קומת חישוב נוספת עבור כיתות גן / מעון", floors: bonus, section: SEC.demolish });

  const footprintCap = (b.plotArea * coverage) / 100;
  const footprint = Math.min(expanded, footprintCap);
  const exactFloors = totalRights / footprint;
  const full = Math.floor(exactFloors + 1e-9);
  const partial = r1(exactFloors - full) >= 0.1 ? r1(exactFloors - full) : 0;

  res.m2PerUnit = DEMOLISH_M2_PER_UNIT;
  res.floorSteps = steps;
  res.addedFullFloors = add + bonus;
  res.partialRoofFraction = 0;
  res.expandedFloorArea = r1(expanded);
  res.footprintArea = r1(footprint);
  res.totalRights = r1(totalRights);
  res.addedArea = r1(totalRights - b.typicalFloorArea * b.existingFloors);
  res.resultingFloors = full + (partial > 0 ? 1 : 0);
  res.maxFloors = max;
  res.coveragePct = coverage;
  res.estimatedHeightM = r1(Math.min(res.resultingFloors, max) * ASSUMED_FLOOR_HEIGHT_M);
  res.publicAllocation = publicAllocation("demolish", b, site, footprint, totalRights);

  if (footprint < expanded) {
    res.notes.push(c(`תכסית מרבית ${coverage}% מגבילה את הקומה ל-${r1(footprint)} מ"ר, ולכן הזכויות מתפרסות על יותר קומות`, SEC.table5));
  }
  if (res.resultingFloors > max) {
    res.notes.push(c(`פריסת הזכויות דורשת ${res.resultingFloors} קומות, מעל המרבי (${max}). לא ניתן לממש את מלוא הזכויות`, SEC.table5));
  }
  res.notes.push(c(`תמהיל חובה: ${UNIT_MIX.upTo55Pct}% מהדירות עד 55 מ"ר ו-${UNIT_MIX.upTo80Pct}% עד 80 מ"ר`, SEC.demolish));
  if (!bonus) {
    res.notes.push(c("אפשר לקבל קומת חישוב נוספת אם הפרויקט כולל 2 כיתות גן או 3 כיתות מעון", SEC.demolish));
  }
  return res;
}

export function computePotential(b: BuildingInput, site: SiteContext): PotentialReport {
  const errors = validateInput(b);
  if (errors.length) throw new InputError(errors.join("; "));

  const globalBlockers: Citation[] = [];
  const assumptions: string[] = [];
  if (site.inPlan === false) globalBlockers.push(c("הכתובת נמצאת מחוץ לגבול התכנית", "תשריט"));
  if (site.inPlan === null) assumptions.push("גבול התכנית לא אומת עבור כתובת זו. התוצאה מניחה שהמגרש בתחום התכנית.");
  const ex = b.exclusions ?? {};
  if (ex.slatedForDemolition) globalBlockers.push(c("המבנה מיועד להריסה", SEC.exclusions));
  if (ex.approvedPinuiBinui) globalBlockers.push(c("חלה על המגרש תכנית פינוי-בינוי מאושרת, והיא גוברת", SEC.exclusions));
  if (ex.tama38Transition) globalBlockers.push(c("הבקשה כפופה להוראות המעבר של תמ\"א 38", SEC.tama38));

  const routes = [computeProtection(b, site), computeRetrofit(b, site), computeDemolish(b, site)];

  for (const r of routes) {
    if (site.urbanRenewalSearchZone) {
      r.notes.push(c("המגרש באזור לבחינת התחדשות עירונית (הנחיות מיוחדות ב׳). מומלץ תיאום מוקדם עם מחלקת התכנון", SEC.searchZone));
    }
    const q = site.quarterQuota;
    if (q && r.addsUnits) {
      if (q.used == null) {
        r.notes.push(c(`ברובע ${site.quarter} חלה מכסה של ${q.threshold.toLocaleString("he-IL")} יח"ד. נתוני מימוש טרם דווחו`, SEC.rules));
      } else if (q.used >= q.threshold) {
        r.blockers.push(c(`מכסת יח"ד ברובע ${site.quarter} (${q.threshold.toLocaleString("he-IL")}) מוצתה`, SEC.rules));
      } else if (q.used >= q.threshold * 0.9) {
        r.notes.push(c(`מכסת יח"ד ברובע ${site.quarter} קרובה למיצוי: ${q.used} מתוך ${q.threshold}`, SEC.rules));
      }
    }
    r.blockers.unshift(...globalBlockers);
    r.eligible = r.blockers.length === 0;
  }

  assumptions.push(
    'יח"ד בקומה טיפוסית = יח"ד קיימות חלקי מספר הקומות הקיימות. התוספת למ"ר ליח"ד מחושבת לפי יח"ד בקומה.',
    `גובה משוער = מספר קומות × ${ASSUMED_FLOOR_HEIGHT_M} מ׳. אינו גובה מחייב.`,
    'שטח בנוי למבחן "מבנה קטן" = שטח קומה טיפוסית × מספר קומות.',
  );

  if (b.permitYear != null) {
    assumptions.push(
      `טעון חיזוק נגזר משנת ההיתר: היתר לפני 1.1.${RETROFIT_PERMIT_BEFORE_YEAR} = טעון חיזוק, כמו בתמ"א 38. לאימות מול הגדרות התכנית ומול חוות דעת מהנדס.`,
    );
  }

  return { input: { ...b, retrofitNeeded: needsRetrofit(b) }, site, globalBlockers, routes, assumptions, disclaimer: DISCLAIMER };
}

/**
 * Indicative number of new apartments a route yields, for comparing routes only.
 * Existing apartments keep their area plus the route's m2 per unit; the rest of the realizable
 * rights, less the public allocation, is divided by an assumed average new-apartment area.
 */
export function estimateNewUnits(
  r: RouteResult,
  b: BuildingInput,
  avgNewUnitArea: number = ASSUMED_NEW_UNIT_AREA_M2,
): UnitEstimate {
  const avg = Math.min(NEW_UNIT_AREA_RANGE.max, Math.max(NEW_UNIT_AREA_RANGE.min, avgNewUnitArea || ASSUMED_NEW_UNIT_AREA_M2));
  const units = b.residential ? b.existingUnits : 0;
  const returned = b.typicalFloorArea * b.existingFloors + r.m2PerUnit * units;
  const cap = r.maxFloors != null && r.footprintArea > 0 ? r.footprintArea * r.maxFloors : Infinity;
  const realizable = Math.min(r.totalRights, cap);
  const usable = b.residential && r.addsUnits && r.totalRights > 0;
  const saleable = usable ? Math.max(0, realizable - returned - r.publicAllocation.area) : 0;
  const newUnits = Math.floor(saleable / avg + 1e-9);
  return {
    route: r.route,
    eligible: r.eligible,
    returnedArea: r1(returned),
    realizableRights: r1(usable ? realizable : 0),
    saleableArea: r1(saleable),
    newUnits,
    perExistingUnit: units > 0 ? Math.round((newUnits / units) * 100) / 100 : 0,
    residentsStay: r.route !== "demolish",
  };
}
