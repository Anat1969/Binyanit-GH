// All numeric parameters of the plan in one place, so a planner can audit them against
// Table 5 and section 4.1.2 without reading engine code.

import type { StreetClass } from "./types";

export const DISCLAIMER =
  "פוטנציאל תכנוני ראשוני בלבד. אינו מקנה זכויות מוקנות וכפוף לשיקול דעת הוועדה המקומית (סעיפים 7.2.1, 6.1.3).";

export const SEC = {
  table5: "טבלה 5",
  rules: "4.1.2",
  demolish: "4.1.2, טבלה 5",
  retrofit: "4.1.2",
  protection: "4.1.2",
  smallBuildings: "4.1.2",
  nonResidential: "4.1.2",
  publicAllocation: "4.1.2, תשריט: הנחיות מיוחדות",
  searchZone: "תשריט: הנחיות מיוחדות ב׳",
  discretion: "7.2.1, 6.1.3",
  exclusions: "7.2",
  tama38: "7.2.4",
  retrofitDef: 'הגדרות, לפי תמ"א 38 (לאימות)',
} as const;

/**
 * "Needs earthquake retrofit" is derived from the building permit year, not chosen by the user.
 * Assumption to verify against the plan's definitions: as in TAMA 38, a building whose permit was
 * issued before 1.1.1980 is treated as needing retrofit.
 */
export const RETROFIT_PERMIT_BEFORE_YEAR = 1980;

/** Floor-count band used by Table 5. */
export type FloorBand = "2" | "3" | "4-5" | "6+";

export function floorBand(existingFloors: number): FloorBand {
  if (existingFloors <= 2) return "2";
  if (existingFloors === 3) return "3";
  if (existingFloors <= 5) return "4-5";
  return "6+";
}

type StreetGroup = "cityWide" | "activeOrTransit";
export function streetGroup(s: StreetClass): StreetGroup {
  return s === "cityWide" ? "cityWide" : "activeOrTransit";
}

/** Table 5: floors added on demolish + rebuild, by street group and existing floor band. */
export const DEMOLISH_ADD_FLOORS: Record<StreetGroup, Record<FloorBand, number>> = {
  cityWide: { "2": 4, "3": 5, "4-5": 6, "6+": 6 },
  activeOrTransit: { "2": 5, "3": 6, "4-5": 7, "6+": 7 },
};

/** Table 5: maximum number of floors on demolish + rebuild. */
export const DEMOLISH_MAX_FLOORS: Record<StreetGroup, Record<FloorBand, number>> = {
  cityWide: { "2": 8, "3": 10, "4-5": 13, "6+": 16 },
  activeOrTransit: { "2": 10, "3": 12, "4-5": 15, "6+": 16 },
};

/** Maximum coverage (percent of plot) on demolish + rebuild. */
export const DEMOLISH_COVERAGE_PCT: Record<StreetGroup, number> = {
  cityWide: 60,
  activeOrTransit: 70,
};

export const DEMOLISH_M2_PER_UNIT = 35;
export const DEMOLISH_EDUCATION_BONUS_FLOORS = 1;
export const UNIT_MIX = { upTo55Pct: 20, upTo80Pct: 10 };

export const RETROFIT_M2_PER_UNIT = 25;
export const RETROFIT_BASE_FULL_FLOORS = 2;
export const PROTECTION_M2_PER_UNIT = 13;
export const PROTECTION_BASE_FULL_FLOORS = 1;
export const PARTIAL_ROOF_FRACTION = 0.7;

export const SMALL_BUILDING = { maxFloors: 2, maxBuiltArea: 400, m2PerUnit: 25 };

export const NON_RESIDENTIAL_FLOORS = { protection: 1, retrofit: 2 };

export const PUBLIC_ALLOCATION = {
  groundFloorPct: 30,
  minArea: 50,
  maxPctOfRights: 15,
  minFrontageM: 15,
};

/** Used only to translate floors into an indicative height. Not a plan parameter. */
export const ASSUMED_FLOOR_HEIGHT_M = 3.3;
