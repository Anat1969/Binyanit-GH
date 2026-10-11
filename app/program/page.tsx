import type { Metadata } from "next";
import { DATA_ERRORS } from "@/program/data";
import { DataErrorState } from "@/program/ui";
import ProgramClient from "./ProgramClient";

export const metadata: Metadata = {
  title: "צורכי ציבור לפי רובע | התחדשות בניינית אשדוד",
  description: "כושר נשיאה, צורכי חינוך וקהילה ל-14 הרובעים בתכנית 603-0972307, לפי נספח הפרוגרמה.",
};

export default function Page() {
  if (DATA_ERRORS.length) return <DataErrorState errors={DATA_ERRORS} />;
  return <ProgramClient />;
}
