// Hebrew UI labels for JSON keys. Labels only; no data.

export const CLASS_LABEL: Record<string, string> = {
  daycare: "מעונות יום",
  daycare_special: "מעונות יום חנ\"מ",
  kindergarten: "גני ילדים",
  kindergarten_special: "גני ילדים חנ\"מ",
  primary_state: "יסודי (ממ\"ד+ממ\"ד)",
  primary_special: "יסודי חנ\"מ",
  primary_haredi_boys: "יסודי חרדי בנים",
  primary_haredi_girls: "יסודי חרדי בנות",
  secondary_state: "על יסודי (ממ\"ד+ממ\"ד)",
  secondary_special: "על יסודי חנ\"מ",
  secondary_haredi_boys: "על יסודי חרדי בנים",
  secondary_haredi_girls: "על יסודי חרדי בנות",
};
export const CLASS_KEYS = Object.keys(CLASS_LABEL);

export const COMMUNITY_LABEL: Record<string, string> = {
  community_wing: "אגף קהילה",
  youth_club: "מועדון נוער",
  senior_club: "מועדון לאזרח הוותיק",
  family_health: "תחנה לבריאות המשפחה",
  clinic: "מרפאה שכונתית",
  synagogue: "בית כנסת",
  mikveh: "מקוואות",
};
export const COMMUNITY_KEYS = Object.keys(COMMUNITY_LABEL);

export const UNITS_LABEL: Record<string, string> = {
  existing: "יח\"ד קיימות",
  approved_renewal_plans: "תוכניות התחדשות מאושרות",
  added_by_renewal: "תוספתיות בהתחדשות",
  binyanit_phase_a: "פוטנציאל בניינית שלב א'",
};

export const ASSUMPTION_LABEL: Record<string, string> = {
  added_units: "תוספת יח\"ד",
  household: "גודל משק בית",
  cohort_pct: "אחוז שנתון",
  cohort_size: "גודל שנתון חינוך",
};

export const POP_LABEL = { general: "אוכלוסייה כללית", haredi: "אוכלוסייה חרדית" } as const;
