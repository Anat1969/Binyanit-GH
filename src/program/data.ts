// Single source of truth: src/data/program.json (public needs and capacity appendix, 30.6.2025).
// Every number shown on /program comes from a field here. Nothing is computed except sums for CSV and
// lookups (e.g. a group member reading its group's carrying capacity).

import raw from "@/data/program.json";

export type CapacityClass = "positive" | "partial" | "negative_with_solution" | "none";

export interface Capacity {
  demand: number;
  renewal_demand: number;
  total_demand: number;
  supply: number;
  balance: number;
  class: CapacityClass;
  min_threshold: number | string;
  proposed_solution: string | null;
  added_units_in_table?: number;
}

export interface School {
  name: string;
  home_classes?: number | null;
  occupancy?: number | null;
  special_ed?: number | null;
  free?: number | null;
  new_wing_potential?: number | null;
}

export type Split = { renewal_plans: number; binyanit: number };

export interface Rova {
  id: string;
  name: string;
  pop_general: number;
  pop_haredi: number;
  group?: string;
  units_existing_for_renewal: number;
  added_max_5y: number;
  added_realistic: number;
  added_population: number;
  children: number;
  units?: Record<string, number>;
  assumptions?: Record<string, unknown>;
  classes: Record<string, number>;
  primary_demand?: { renewal_plans: number; binyanit: number; total: number; general?: Split; haredi_boys?: Split; haredi_girls?: Split };
  schools?: School[];
  renewal_projects?: { name: string; added_units: number }[];
  new_schools_proposed?: { name: string; classes: number }[];
  potential?: { binyanit?: number; binyanit_note?: string; renewal?: number; total?: number };
  community_sqm?: Record<string, number | string>;
  community_group?: string;
  carrying_capacity: Capacity | { ref: string } | null;
  summary?: string;
  data_flags?: string[];
  source_pages: number[];
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  units: Record<string, number>;
  assumptions: Record<string, number>;
  primary_demand: { renewal_plans: number; binyanit: number; total: number };
  potential: { binyanit: number; renewal: number; total: number };
  community_sqm: Record<string, number>;
  carrying_capacity: Capacity;
  summary: string;
  data_flags?: string[];
  source_pages: number[];
}

export interface LegendItem {
  key: CapacityClass;
  label: string;
  color: string;
  opacity: number;
  stroke?: string;
}

export interface ProgramDoc {
  id: string;
  title: string;
  date?: string;
  file?: string;
  href?: string | null;
  url?: string | null;
  note?: string;
}

export interface Program {
  meta: {
    plan_number: string;
    plan_name: string;
    source_document: string;
    approval: string;
    data_status: string;
    methodology: {
      realistic_scenario: { units: number; assumptions: string };
      max_5_years: { units: number; assumptions: string };
      full_capacity_units: number;
      limiting_factor: string;
      household: {
        general: { household_size: number; cohort_pct: number; primary_years: number; class_size: number };
        haredi: { household_size: number; cohort_pct: number; primary_years: number; class_size_boys: number; class_size_girls: number };
      };
      guide: string;
      threshold_note: string;
    };
    carrying_capacity_legend: LegendItem[];
    construction_era_legend: { source: string; classes: { label: string; color: string }[]; note: string };
  };
  totals: {
    existing_units_for_renewal: number;
    added_units_max_5y: number;
    added_units_realistic: number;
    added_population_max_5y: number;
    children_max_5y: number;
    education_classes_max_5y: Record<string, number>;
    community_sqm_max_5y: Record<string, number>;
    program_summary: string[];
    ground_floor_note: string;
  };
  rovaim: Rova[];
  groups: Group[];
  unused_classes_tashpag: { source: string; rows: { rova: string; classes: number; schools: string }[] };
  documents: ProgramDoc[];
}

/** Minimal structural validation so a broken data file shows a clear error state instead of a crash. */
export function validate(d: unknown): string[] {
  const errs: string[] = [];
  const p = d as Partial<Program>;
  if (!p || typeof p !== "object") return ["קובץ הנתונים ריק"];
  if (!p.meta?.carrying_capacity_legend?.length) errs.push("חסר מקרא כושר נשיאה");
  if (!p.totals || typeof p.totals.existing_units_for_renewal !== "number") errs.push("חסרים סיכומים");
  if (!Array.isArray(p.rovaim) || p.rovaim.length === 0) errs.push("חסרה רשימת רובעים");
  p.rovaim?.forEach((r, i) => {
    if (!r?.id || !r?.name) errs.push(`רובע ${i + 1}: חסר מזהה או שם`);
    if (typeof r?.added_max_5y !== "number") errs.push(`${r?.name ?? i}: חסרה תוספת יח"ד`);
    if (!Array.isArray(r?.source_pages)) errs.push(`${r?.name ?? i}: חסרים עמודי מקור`);
  });
  if (!Array.isArray(p.documents)) errs.push("חסרה ספריית מסמכים");
  return errs;
}

export const DATA_ERRORS = validate(raw);
export const PROGRAM = raw as unknown as Program;

export const APPENDIX_PDF = "/docs/program-appendix.pdf";
export const pageHref = (n: number) => `${APPENDIX_PDF}#page=${n}`;

/** Appendix pages by topic (as cited in the JSON source_pages and in the appendix itself). */
export const PAGES = { methodology: 3, capacity: 4, unused: 5, education: 14, community: 15, carrying: 16 } as const;

export const LOW_ADDITION_THRESHOLD = 50;

export function groupOf(r: Rova): Group | null {
  return r.group ? PROGRAM.groups.find((g) => g.id === r.group) ?? null : null;
}

/** Carrying capacity for a rova: its own, or its group's when the source computes it per group. */
export function capacityOf(r: Rova): { cap: Capacity | null; viaGroup: Group | null } {
  const c = r.carrying_capacity;
  if (!c) return { cap: null, viaGroup: null };
  if ("ref" in c) {
    const g = groupOf(r);
    return { cap: g?.carrying_capacity ?? null, viaGroup: g };
  }
  return { cap: c, viaGroup: null };
}

export function legendFor(k: CapacityClass | null | undefined): LegendItem | null {
  return k ? PROGRAM.meta.carrying_capacity_legend.find((l) => l.key === k) ?? null : null;
}

export const NULL_STATUS = { label: "ללא נתון", color: "#9AA0A6", opacity: 0.25 };

/** The rova's own slide in the appendix (not the summary tables on pages 4, 14, 15, 16). */
export function rovaSlidePage(r: Rova): number | null {
  return r.source_pages.find((p) => ![PAGES.capacity, PAGES.education, PAGES.community, PAGES.carrying].includes(p as 4 | 14 | 15 | 16)) ?? null;
}

export function rovaIndex(id: string): number {
  return PROGRAM.rovaim.findIndex((r) => r.id === id);
}

export const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("he-IL"));
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n * 100)}%`);
