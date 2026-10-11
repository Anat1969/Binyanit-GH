// Types for the deterministic rules engine of plan 603-0972307 (Ashdod building renewal).
// The engine is the only place where numbers are produced. The LLM only explains its output.

export type StreetClass = "cityWide" | "activeFrontage" | "massTransit";
export type ProtectedSpaces = "none" | "partial" | "full";
export type GroundFloor = "built" | "pilotis";
export type PublicEducation = "none" | "kindergarten2" | "daycare3";
export type RouteId = "protection" | "retrofit" | "demolish";

export interface BuildingInput {
  existingFloors: number; // above ground, including ground floor
  existingUnits: number;
  typicalFloorArea: number; // m2, gross area of a typical floor
  groundFloor: GroundFloor; // built (>=50%) or pilotis
  retrofitNeeded: boolean; // earthquake retrofit required
  protectedSpaces: ProtectedSpaces;
  residential: boolean;
  plotArea: number; // m2
  frontageLength?: number | null; // m, plot frontage along the street
  activeGroundUses?: boolean; // project converts / designs ground floor for active uses
  relocateGroundFloorUnits?: boolean; // 6+ floor buildings: relocating ground floor units upward
  newWing?: boolean; // retrofit / protection adds a new wing (affects public-allocation exemption)
  publicEducation?: PublicEducation; // 2 kindergarten classes or 3 daycare classes
  exclusions?: {
    slatedForDemolition?: boolean;
    approvedPinuiBinui?: boolean;
    tama38Transition?: boolean;
  };
}

export interface SiteContext {
  inPlan: boolean | null; // null = boundary layer not loaded, cannot verify
  streetClass: StreetClass;
  publicAllocationZone: boolean; // "special guidelines"
  urbanRenewalSearchZone: boolean; // "special guidelines B"
  wellRadius: boolean;
  quarter: string | null;
  quarterQuota?: { threshold: number; used: number | null } | null;
}

export interface Citation {
  text: string;
  section: string;
}

export interface FloorStep {
  label: string;
  floors: number; // may be fractional for a partial roof floor
  section: string;
}

export interface PublicAllocation {
  applies: boolean; // the site is inside a marked zone
  required: boolean;
  area: number; // m2, 0 if not required
  exemption: string | null;
  section: string;
}

export interface RouteResult {
  route: RouteId;
  title: string;
  eligible: boolean;
  blockers: Citation[];
  notes: Citation[];
  m2PerUnit: number;
  addedFullFloors: number;
  partialRoofFraction: number; // 0 or e.g. 0.7
  floorSteps: FloorStep[];
  expandedFloorArea: number; // m2 per typical floor after expansion
  footprintArea: number; // m2 of the floor plate used to lay out the building form
  addedArea: number; // m2 added over existing (protection / retrofit); for demolish = rights - existing
  totalRights: number; // m2 total above-ground main area after the route
  resultingFloors: number; // number of storeys including a partial roof storey
  maxFloors: number | null;
  estimatedHeightM: number | null;
  coveragePct: number | null;
  publicAllocation: PublicAllocation;
  addsUnits: boolean;
}

export interface PotentialReport {
  input: BuildingInput;
  site: SiteContext;
  globalBlockers: Citation[];
  routes: RouteResult[];
  assumptions: string[];
  disclaimer: string;
}

/** Indicative count of new apartments per route. Derived from RouteResult, never from the plan text. */
export interface UnitEstimate {
  route: RouteId;
  eligible: boolean;
  returnedArea: number; // m2 kept by the existing apartments, including the per-unit addition
  realizableRights: number; // m2 of rights that fit under the maximum floor count
  saleableArea: number; // m2 left for new apartments after the public allocation
  newUnits: number; // whole apartments, rounded down
  perExistingUnit: number; // newUnits / existingUnits, 2 decimals
  residentsStay: boolean; // false on demolish + rebuild: temporary relocation
}
